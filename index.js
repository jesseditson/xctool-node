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

var printUsage = function(){
  console.log('usage: xctool-node [OPTIONS]');
  console.log('Options:');
  console.log('    xctool-node [-h|--help]              Print this help.');
  console.log('    xctool-node [-s|--silent]            Run one of the silent commands - this will not show a prompt, just run.');
  console.log('    xctool-node [-S|--suite]             Runs test suites instead of specific tests between resets. If in console mode, will execute selected suite instead of selected test.');
  console.log('    xctool-node [-t|--target]            Specify a target to run.');
}

if (hasArg(/(^|[^\w])(-h|--help)([^\w]|$)/)) {
  // print usage
  printUsage();
  return;
}

var runSuite = hasArg(/(^|[^\w])(-S|--suite)([^\w]|$)/);
var target = hasArg(/(?:^|[^\w])(?:-t|--target)[[^\w]\s]+([^-]+)/);
target = target ? target[1] : false;

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

var runTests = function(args,callback){
  //SomeTestTarget:SomeTestClass/testSomeMethod
  var onlyArg = args.slice(0,2).join(':');
  if(args.length == 3){
    onlyArg += '/' + args[2];
  } else if(args.length != 2) {
    throw new Error('Bad number of arguments passed to runTests - must be 2 or 3, had',args);
  }
  var test = xctool('run-tests','-freshSimulator','-freshInstall','-only',onlyArg);
  test.stdout.pipe(process.stdout);
  test.stderr.pipe(process.stderr);
  test.on('close',function(code,signal){
    callback();
  });
}

var menuSelected = function(label) {
  menu.reset();
  menu.close();
  menu = terminalmenu(menuInfo);
  if (label == 'HELP') {
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
  } else {
    menu.write('~~~~   '+label+'   ~~~~\n');
    menu.write('-------------------------\n');
    // menu.add('BACK');
    if (currentObj[label] === true || (runSuite && currentDepth.length == 1)) {
      menu.reset();
      menu.close();
      runTests(currentDepth.concat(label));
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
  } else if(!hasArg(/(^|[^\w])(-s|--silent)([^\w]|$)/)){
    // show the gui
      menu = terminalmenu(menuInfo);
      currentObj = tests;
      menu.reset();
      menu.write('~~~~   XCODE TESTS   ~~~~\n');
      menu.write('-------------------------\n');
      menu.add('HELP');
      menu.add('EXIT');
      Object.keys(tests).forEach(function(test){
        menu.add(test);
      });
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
