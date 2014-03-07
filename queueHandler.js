var fs = require('fs'),
    child = require('child_process'),
    spawn,
    runQueue;

runQueue = function () {
  fs.readdir('./queue/', function (err, files) {
    if (!err) {
      files.forEach(function (file) {
        var src = __dirname + '/queue/' + file,
            dest = __dirname + '/timelapses/' + file.slice(0, -4) + '.mp4';

        spawn = child.exec(
          'ffmpeg -r 30 -f concat -i ' + src + ' -c:v libx264 -r 30 -pix_fmt yuv420p ' + dest,
          function (err, stdin, stdout) {
            if (!err) fs.unlink(src);
          }
        );
      });
    }

    setTimeout(runQueue, 60000);
  });
};

runQueue();
