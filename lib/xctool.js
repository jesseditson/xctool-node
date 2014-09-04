var spawn = require('child_process').spawn;
var sh = require('execSync');
var path = require('path');
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
  xctoolArgs.unshift('-reporter','plain');
  // console.log('running',path.join(xctoolDir,'/xctool.sh'),xctoolArgs);
  var x = spawn(path.join(xctoolDir,'/xctool.sh'),xctoolArgs);
  var stdout = '';
  var stderr = '';
  x.stdout.on('data',function(data){
    stdout += data.toString();
    // console.log('stdout:',data.toString());
    if(callbacks.length > 1 && typeof callbacks[0] == 'function'){
      callbacks[0].apply(this,arguments);
    }
  });
  x.stderr.on('data',function(data){
    stderr += data.toString();
    // console.warn('stderr:',data.toString());
    if(callbacks.length == 2 && typeof callbacks[0] == 'function'){
      callbacks[0].apply(this,arguments);
    } else if(callbacks.length == 3 && typeof callbacks[1] == 'function'){
      callbacks[1].apply(this,arguments);
    }
  });
  x.on('close',function(){
    var args = Array.prototype.slice.call(arguments);
    args.unshift(stdout);
    args.unshift(stderr ? new Error(stderr) : null,stdout);
    // console.log('xctool exited with code',code);
    if(callbacks.length == 1 && typeof callbacks[0] == 'function'){
      callbacks[0].apply(this,args);
    } else if (callbacks.length == 2 && typeof callbacks[1] == 'function') {
      callbacks[1].apply(this,args);
    } else if(callbacks.length == 3 && typeof callbacks[2] == 'function'){
      callbacks[2].apply(this,args);
    }
  });
  return x;
}

xctool.dir = xctoolDir;
xctool.rev = sh.exec('git --git-dir="'+xctoolDir+'/.git" log -n 1 --format=%h 2> /dev/null || echo "."').stdout.trim();
xctool.build = path.join(xctoolDir,'/build/' + xctool.rev + '/Products/Release/');

module.exports = xctool;
