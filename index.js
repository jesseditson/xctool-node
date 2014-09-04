#!/usr/bin/env node

var xctool = require('./lib/xctool');
var terminalmenu = require('terminal-menu');
var fs = require('fs');
var path = require('path');
var async = require('async');

var args = process.argv.slice(2);
var hasArg = function(regex){
  var match = args.join(' ').match(regex);
  return match;
}
var pbcopy = function(data) { var proc = require('child_process').spawn('pbcopy'); proc.stdin.write(data); proc.stdin.end(); }

var printUsage = function(){
  console.log('usage: xctool-node [OPTIONS]');
  console.log('Options:');
  console.log('    xctool-node [-h|--help]              Print this help.');
  console.log('    xctool-node [-s|--silent]            Run silently. this will not show a prompt, just run the test suite.');
  console.log('    xctool-node [-S|--suite]             Runs test suites instead of specific tests between resets. If in console mode, will execute selected suite instead of selected test.');
  console.log('    xctool-node [-b|--build]             Rebuild the target before running the suite.');
  console.log('    xctool-node [-t|--target]            Specify a target to run, optionally specifying a suite and test as well, in the format: SomeTestTarget:SomeTestClass/testSomeMethod (only available with the -s flag)');
  console.log('    xctool-node [-o|--output]            Output results to a file.');
}

if (hasArg(/(^|[^\w])(-h|--help)([^\w]|$)/)) {
  // print usage
  printUsage();
  return;
}

var runSuite = hasArg(/(^|[^\w])(-S|--suite)([^\w]|$)/);
var rebuild = hasArg(/(^|[^\w])(-b|--build)([^\w]|$)/);
var testTarget = hasArg(/(?:^|[^\w])(?:-t|--target)[\s]+([^:]+)?:?([^\/]+)?\/?([^\s]+)?/);
testTarget = testTarget ? testTarget.slice(1) : false;
var output = hasArg(/(?:^|[^\w])(?:-o|--output)[\s]+([^\s]+)/);
output = output ? output[1] : false;
var silent = hasArg(/(^|[^\w])(-s|--silent)([^\w]|$)/);

var menuInfo = { width: 40, x: 4, y: 4 };
var menu;
var currentObj;
var currentDepth = [];
var tests = {};

var getObjectWithDepth = function(depth,o){
  o = o || tests;
  if (!depth.length) {
    return o;
  } else {
    var k = depth.shift();
    return getObjectWithDepth(depth,o[k]);
  }
}

var runXCToolCommand = function(){
  var args = Array.prototype.slice.call(arguments);
  var cbType = (typeof args[args.length-1]);
  if(cbType == 'function' || cbType == 'undefined'){
    var callback = args.pop();
  }
  var test = xctool.apply(null,args);
  test.stdout.pipe(process.stdout);
  test.stderr.pipe(process.stderr);
  test.on('close',function(code,signal){
    if(callback) callback();
  });
  if (output) {
    var file = fs.createWriteStream(output,{mode:0755});
    test.stdout.pipe(file);
  }
  return test;
};

var runTests = function(args,callback){
  //SomeTestTarget:SomeTestClass/testSomeMethod
  var onlyArg = args.slice(0,2).join(':');
  if(args.length == 3){
    onlyArg += '/' + args[2];
  } else if(!args.length || args.length > 3) {
    throw new Error('Bad number of arguments passed to runTests: ',args);
  }
  if(rebuild){
    runXCToolCommand('build-tests',function(){
      runXCToolCommand('run-tests','-freshSimulator','-freshInstall','-only',onlyArg,callback);
    });
  } else {
    runXCToolCommand('run-tests','-freshSimulator','-freshInstall','-only',onlyArg,callback);
  }
  return onlyArg;
}

if(silent && testTarget){
  runTests(testTarget);
  return;
}

var runningTest;

var menuSelected = function(label) {
  menu.reset();
  menu.close();
  menu = terminalmenu(menuInfo);
  if (label == 'REBUILD TESTS') {
    menu.reset();
    menu.close();
    runXCToolCommand('build-tests');
    return;
  } else if (label == 'HELP') {
    menu.reset();
    menu.close();
    printUsage();
    return;
  } else if (label == 'EXIT') {
    menu.reset();
    menu.close();
    return;
  } else if (label == 'BACK') {
    // TODO: this is broken
    currentObj = getObjectWithDepth(currentDepth);
    menuSelected();
    return;
  } else if (label == 'REBUILD FIRST' || label == 'DON\'T REBUILD') {
    menu.reset();
    menu.close();
    rebuild = label != 'DON\'T REBUILD';
    var targetArg = runTests(currentDepth.concat(runningTest));
    var cmd = 'xctool-node -s ' +(rebuild ? '-b ' : '')+ '-t ' + targetArg.replace(/\s/g,'\\ ') + ' ' + (output ? '-o ' + output : '');
    console.log('Run again with:\n' + cmd);
    var historyFile = process.env['HISTFILE'] || (process.env['HOME'] + '/.bash_history');
    fs.appendFile(historyFile,cmd);
    pbcopy(cmd);
    return;
  } else {
    menu.write(label+'\n');
    menu.write('-------------------------\n');
    // menu.add('BACK');
    if(runningTest){
      menu.add('REBUILD FIRST');
      menu.add('DON\'T REBUILD');
    } else if (currentObj[label] === true || (runSuite && currentDepth.length == 1)) {
      runningTest = label;
      menuSelected('RUN ' + runningTest);
      return;
    } else {
      Object.keys(currentObj[label] ? currentObj[label] : currentObj).forEach(function(test){
        menu.add(test);
      });
      currentDepth.push(label);
      currentObj = currentObj[label];
    }
  }
  menu.add('EXIT');
  menu.on('select',menuSelected);
  menu.createStream().pipe(process.stdout);
}

var currentTests;
var m;
xctool('run-tests','-listTestsOnly',function(data){
  var line = data.toString().trim();
  var runTestRegEx = /run-test\s+([^\(]+)/g;
  while(m = runTestRegEx.exec(line)){
    var testsName = m[1].replace(/\.(o|x)ctest/i,'').trim();
    tests[testsName] = {};
    currentTests = testsName;
  }
  if(currentTests){
    var testRegEx = /~ -\[([^\s]+)\s*([^\]]+)?\]/g;
    while(m = testRegEx.exec(line)){
      var suite = m[1];
      tests[currentTests][suite] = tests[currentTests][suite] || {};
      tests[currentTests][suite][m[2]] = true;
    }
  }
},function(err){
  if (err) {
    console.error(err);
  } else if(!silent){
    // show the gui
      menu = terminalmenu(menuInfo);
      currentObj = tests;
      menu.reset();
      menu.write('~~~~   XCODE TESTS   ~~~~\n');
      menu.write('-------------------------\n');
      Object.keys(tests).forEach(function(test){
        menu.add(test);
      });
      menu.add('REBUILD TESTS');
      menu.add('HELP');
      menu.add('EXIT');
      menu.on('select',menuSelected);
      menu.createStream().pipe(process.stdout);
  } else {
    // cli interface
    var runnables = [];
    Object.keys(tests).forEach(function(target){
      Object.keys(tests[target]).forEach(function(suite){
        if (runSuite) {
          runnables.push([target,suite]);
        } else {
          Object.keys(tests[target][suite]).forEach(function(test){
            runnables.push([target,suite,test]);
          });
        }
      });
    });
    async.series(runnables.map(function(arr){
      return runTests.bind(null,arr);
    }),function(){
      console.log('done.');
    });
  }
});
