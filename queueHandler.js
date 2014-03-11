var fs = require('fs'),
    child = require('child_process'),
    spawn,
    generateNextTimelapse;

generateNextTimelapse = function () {
  fs.readdir('./queue/', function (err, files) {
    if (!err && files.length > 0) {
      var file = files[0],
          timelapseName = file.slice(0, -4) + '.mp4',
          src = __dirname + '/queue/' + file,
          tmp = __dirname + '/timelapses/tmp/' + timelapseName,
          dest = __dirname + '/timelapses/' + timelapseName;

      child.exec('ffmpeg -r 30 -f concat -i ' + src + ' -c:v libx264 -r 30 -pix_fmt yuv420p ' + tmp + '; echo 0;', function (err, stdin, stdout) {
        if (!err) {
          fs.unlink(src);
          fs.renameSync(tmp, dest);
          generateNextTimelapse();
        }
      });
    } else {
      setTimeout(generateNextTimelapse, 1000);
    }
  });
};

generateNextTimelapse();
