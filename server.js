var express = require('express'),
    app = express(),
    gm = require('gm'),
    fs = require('fs'),
    multiparty = require('multiparty'),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    easyimg = require('easyimage'),
    lastSave = 0,
    connectionCount,
    checkStatusOnUpload = false,
    settings;

settings = {
    checkForPanic: true,
    httpAuth: {
      username: 'demo',
      password: 'demo'
    },
    moveNightImages: true,
    timeBetweenSaves: 180000,
    timeBeforePanic: 1200000,
    timeBetweenChecks: 300000
};

app.use(express.compress());

app.use(express.urlencoded());
app.use(express.json());

app.use(express.static('./public'));

server.listen(1337);

// Methods
function checkStatus () {
    fs.readdir('./images/', function (err, files) {
        if (!err) {
            var latest = files[files.length - 1],
                now = new Date().getTime();

            if (now - parseInt(latest.slice(0, -4), 10) > settings.timeBeforePanic) {
                checkStatusOnUpload = true;
                panic();
            } else {
                setTimeout(checkStatus, settings.timeBetweenChecks);
            }
        }
    });
}

function panic () {
    console.log('Panic! This will get executed when the RaspEye is down.');
}

setTimeout(checkStatus, settings.timeBetweenChecks);


// Routes

// Get all image paths, sorted by date
// Gets cached for three minutes
app.get('/timeline/', function (req, res) {
    var cachePath = './data/timeline.json',
        buildCache = function (callback) {
            var getDayStamp = function (timestamp) {
                var day = new Date(parseInt(timestamp, 10));
                day.setHours(0, 0, 0, 0);

                return day.getTime();
            };

            fs.readdir('./images/', function (err, files) {
                if (err) return res.send(500);

                files.reverse();

                var days = [],
                    sorted = {};

                dayStamp = getDayStamp(files[0].slice(0, -4));
                days.push(dayStamp);
                sorted[dayStamp] = [];

                // Sort all by day
                for (var i = 0; i < files.length; i++) {
                    var timestamp = parseInt(files[i].slice(0, -4), 10);
                    if (timestamp >= dayStamp) {
                        sorted[dayStamp].push(files[i]);
                    } else {
                        dayStamp = getDayStamp(timestamp);
                        days.push(dayStamp);
                        sorted[dayStamp] = [];
                    }
                }

                // Dirty: write the whole part to a JSON file
                // We need a WriteStream because the JSON file could get pretty big
                var cache = fs.createWriteStream(cachePath);
                cache.on('close', callback);
                cache.write('{\n\t');

                cache.write('"days": [');
                cache.write(days.join(','));
                cache.write('],\n\t');

                for (var j = 0; j < days.length; j++) {
                    var day = days[j],
                        s = sorted[day];

                    cache.write('"' + day + '": [\n');

                    for (var k = 0; k < s.length - 1; k++) {
                        cache.write('\t\t"' + s[k] + '",\n');
                    }

                    cache.write('\t\t"' + s[s.length - 1] + '"\n');
                    cache.write('\t]');

                    if (j < days.length - 1) {
                        cache.write(',\n\t');
                    }
                }
                cache.write('\n}');
                cache.end();

            });
        }

    fs.open(cachePath, 'r', function (err, fd) {
        if (err) return res.send(500);

        fs.fstat(fd, function (err, stats) {
            if (err) return res.send(500);

            // Cache results for 3 minutes
            if (new Date().getTime() - stats.mtime.getTime() < 180000) {
                res.sendfile(cachePath);
            } else {
                buildCache(function () {
                    res.sendfile(cachePath);
                });
            }
        });
    });
});

// Send static full resolution images
app.get('/images/*.jpg', function (req, res) {
    res.sendfile(__dirname + req.path);
});

// Send static live image
app.get('/live.jpg', function (req, res) {
    fs.readdir(__dirname + '/live/', function (err, files) {
        if (!err) {
            res.sendfile(__dirname + '/live/' + files[files.length - 1]);
        }
    });
});

// Send thumbnails
app.get('/thumbnails/*.jpg', function (req, res) {
    res.sendfile(__dirname + req.path);
});

// Receive post uploads
app.post('/upload/', express.basicAuth(settings.httpAuth.username, settings.httpAuth.password), function (req, res) {
    var now = new Date().getTime(),
        liveStream = fs.createWriteStream(__dirname + '/live/' + now + '.jpg');

    // request pipes the file from the Raspberry Pi, just blindly write it to the file system (could be dangerous!)
    req.pipe(liveStream);

    req.on('end', function () {
        io.sockets.emit('image:live');

        if (now - lastSave >= settings.timeBetweenSaves) {
            gm(__dirname + '/live/' + now + '.jpg').color(function (err, color) {
                if (!err) {
                    var targetFolder = (Settings.moveNightImages && color < 10000 && color > 0) ? '/night' : '';
                }

                fs.renameSync(__dirname + '/live/' + now + '.jpg', __dirname + targetFolder + '/images/' + now + '.jpg');

                fs.readdir(__dirname + '/live/', function (err, files) {
                    // Don't delete the current file or the livestream will be black
                    for (var i = 0; i < files.length - 1; i++) {
                        fs.unlink(__dirname + '/live/' + files[i]);
                    }
                });

                easyimg.resize({
                    src: __dirname + targetFolder + '/images/' + now + '.jpg',
                    dst: __dirname + targetFolder + '/thumbnails/'  + now + '.jpg',
                    width: 600,
                    height: 338,
                    quality: 50
                }, function (err, image) {});

                lastSave = now;

                if (checkStatusOnUpload) {
                    setTimeout(checkStatus, 60000);
                    checkStatusOnUpload = false;
                }
            });
        }
    });
});

// Parse timelapse generation request
app.get('/generate/:start/:end/', function (req, res) {
    var start = parseInt(req.params.start, 10),
        end = parseInt(req.params.end, 10),
        timelapseName = req.params.start + '-' + req.params.end;

    fs.exists('./timelapses/' + timelapseName + '.mp4', function (exists) {
        if (exists) {
            // If the timelapse already exists, force download
            res.download('./timelapses/' + timelapseName + '.mp4', 'timelapse.mp4');
            return;
        }

        fs.readdir('./images/', function (err, files) {
            if (err) return res.send(500);

            // Create a .txt file formatted "file: 'path.jpg'" that ffmpeg can parse
            var cache = fs.createWriteStream('./queue/' + timelapseName + '.txt');

            files.filter(function(file) {
                var timestamp = parseInt(file.slice(0, -4), 10);
                return (timestamp >= start && timestamp <= end);
            }).forEach(function (v) {
                cache.write('file \'../images/' + v + '\'\n');
            });

            cache.end();
        });

        // Redirect to a waiting page that will poll the image generation
        res.redirect('/queue.html?start=' + start + '&end=' + end);
    });
});

// Static timelapse download
app.get('/timelapse/:start-:end.mp4', function (req, res) {
    var start = parseInt(req.params.start, 10),
        end = parseInt(req.params.end, 10),
        timelapseName = req.params.start + '-' + req.params.end;

    fs.exists('./timelapses/' + timelapseName + '.mp4', function (exists) {
        if (exists) {
            res.download('./timelapses/' + timelapseName + '.mp4', 'timelapse.mp4');
            return;
        }

        res.send(404);
    });
});

io.sockets.on('connection', function (socket) {
    connectionCount++;
    io.sockets.emit('connections:count', {count: connectionCount});

    fs.readdir('./images/', function (err, files) {
        socket.emit('image:initial', {url: '/images/' + files[files.length - 1]});
    });

    socket.on('disconnect', function () {
        connectionCount--;
        io.sockets.emit('connections:count', {count: connectionCount});
    });
});
