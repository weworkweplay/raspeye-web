# RaspEye server
An example server and front-end web application setup for the [RaspEye](https://github.com/weworkweplay/raspeye-rpi).

All source code is decently commented to help you build your own integration.

## Setup
 1. Clone this repository
 2. `$ npm install`
 3. Run both `server.js` and `queueHandler.js` in a background thread (I recommend [forever](https://github.com/nodejitsu/forever)).

For timelapse and thumbnail generation the script require `ffmpeg` (a more recent version with `-i concat` support) and `imagemagick`.

## Server
Tiny REST API that also generates timelapses and thumbnails for the images it receives from the RaspEye.

### Endpoints

 * `GET /timeline/` - Returns a JSON file with all image filenames sorted by day
 * `POST /upload/` - Receives and handles file input from the RaspEye
 * `GET /generate/:start/:end/` - Accepts and queues requests for timelapse generation between start and end timestamps

Available file paths: `/thumbnails/timestamp.jpg`, `/images/timestamp.jpg`, `/timelapse/start-end.mp4`.

## Front-end
Lives in the `/public/` folder of this repository.

It's very simple, the main magic happens in these three pages:
 * `index.html` - Showing the latest available image, with live updates through socket.io. Could serve as a livestream.
 * `timeline.html` - Showing all images ever uploaded, sorted by day. Today is expanded by default, the rest gets loaded by request. Also implemented lazy loading to not overload our own server. Clicking two thumbnails creates a timespan that you can generate a timelapse for.
 * `queue.html` - A waiting page that polls the server to see if the requested .mp4 has already been created.

Take a look at the Javascript, it's pretty self-explanatory.
