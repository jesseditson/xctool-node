#!/usr/bin/env node

var xctool = require('./lib/xctool');
var terminalmenu = require('terminal-menu');
var fs = require('fs');
var path = require('path');

var args = process.argv.slice(2);
var hasArg = function(regex){
  return regex.test(args.join(' '));
}

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

var menuSelected = function(label) {
  menu.reset();
  menu.close();
  menu = terminalmenu(menuInfo);
  if (label == 'EXIT') {
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
    var runSuite = hasArg(/(^|\b)(-S|--suite)(\b|$)/);
    if (currentObj[label] === true || (runSuite && currentDepth.length == 1)) {
      menu.reset();
      menu.close();
      //SomeTestTarget:SomeTestClass/testSomeMethod
      var onlyArg = currentDepth.join(':') + (runSuite ? ':' : '/') + label;
      var test = xctool('run-tests','-freshSimulator','-freshInstall','-only',onlyArg);
      test.stdout.pipe(process.stdout);
      test.stderr.pipe(process.stderr);
      return;
    } else {
      Object.keys(currentObj[label] ? currentObj[label] : currentObj).forEach(function(test){
        menu.add(test);
      });
      currentDepth.push(label);
      currentObj = currentObj[label];
    }
  }
  menu.on('select',menuSelected);
  menu.createStream().pipe(process.stdout);
}

if(!hasArg(/(^|\b)(-s|--silent)(\b|$)/)){
  // show the gui
  var currentTests;
  var m;
  xctool('run-tests','-listTestsOnly',function(data){
    var line = data.toString().trim();
    if(m = line.match(/^run-test\s+([^\(]+)/)){
      var testsName = m[1].replace(/\.(o|x)ctest/i,'').trim();
      tests[testsName] = {};
      currentTests = testsName;
    } else if(currentTests){
      var testRegEx = /~ -\[([^\s]+)\s*([^\]]+)?\]/g;
      while(m = testRegEx.exec(line)){
        var suite = m[1];
        tests[currentTests][suite] = tests[currentTests][suite] || {};
        tests[currentTests][suite][m[2]] = true;
      }
    }
  },function(){
    menu = terminalmenu(menuInfo);
    currentObj = tests;
    menu.reset();
    menu.write('~~~~   XCODE TESTS   ~~~~\n');
    menu.write('-------------------------\n');
    Object.keys(tests).forEach(function(test){
      menu.add(test);
    });
    menu.on('select',menuSelected);
    menu.createStream().pipe(process.stdout);
  });
} else if (!args.length || hasArg(/(^|\b)(-h|--help)(\b|$)/)) {
  // print usage
  // TODO
} else {
  // cli interface
  // TODO
}
