var glob = require('glob');
var path = require('path');

var findXCodeDir = function(dir){
  if(glob.sync(path.join(dir,'*.xcworkspace'))){
    return dir;
  } else {
    return findXCodeDir(path.join(__dirname, '..'));
  }
}

module.exports = findXCodeDir(process.cwd());
