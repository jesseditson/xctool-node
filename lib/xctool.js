var spawn = require('child_process').spawn;
var sh = require('execSync');
var path = require('path');
var ffi = require('ffi');
var xcodeDir = require('./xcodedir');

var xctoolDir = path.join(__dirname,'../xctool');

var xctool = function(){
  var args = Array.prototype.slice.call(arguments);
  var callbacks = [];
  var xctoolArgs = args.filter(function(arg){
    if (typeof arg == 'function') {
      callbacks.push(arg);
      return false;
    }
    return true;
  });
  // console.log(path.join(xctoolDir,'/xctool.sh'),xctoolArgs);
  var x = spawn(path.join(xctoolDir,'/xctool.sh'),xctoolArgs);
  var stdout = '';
  var stderr = '';
  x.stdout.on('data',function(data){
    stdout += data.toString();
    if(callbacks.length > 1 && typeof callbacks[0] == 'function'){
      callbacks[0].apply(this,arguments);
    } else {
      //console.log('stdout:',data.toString());
    }
  });
  x.stderr.on('data',function(data){
    stderr += data.toString();
    if(callbacks.length == 2 && typeof callbacks[0] == 'function'){
      callbacks[0].apply(this,arguments);
    } else if(callbacks.length == 3 && typeof callbacks[1] == 'function'){
      callbacks[1].apply(this,arguments);
    } else {
      //console.warn('stderr:',data.toString());
    }
  });
  x.on('close',function(code){
    if(callbacks.length == 1 && typeof callbacks[0] == 'function'){
      callbacks[0](new Error(stderr),stdout,code);
    } else if (callbacks.length == 2 && typeof callbacks[1] == 'function') {
      callbacks[1].apply(this,arguments);
    } else if(callbacks.length == 3 && typeof callbacks[2] == 'function'){
      callbacks[2].apply(this,arguments);
    } else {
      //console.log('xctool exited with code',code);
    }
  });
  return x;
}

xctool.dir = xctoolDir;
xctool.rev = sh.exec('git --git-dir="'+xctoolDir+'/.git" log -n 1 --format=%h 2> /dev/null || echo "."').stdout.trim();
xctool.build = path.join(xctoolDir,'/build/' + xctool.rev + '/Products/Release/');

// OtestQuery

// process.env['OtestQueryBundlePath'] = xcodeDir;
//
// var OtestQueryiOS = new ffi.Library(path.join(xctool.build,'otest-query-lib-ios'));
//
// console.log(OtestQueryiOS);

module.exports = xctool;
