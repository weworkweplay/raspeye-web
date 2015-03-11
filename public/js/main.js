(function () {
  "use strict";

  var bindTimeline,
      checkQueue,
      clearTimelineSelection,
      loadTimeline,
      timelineData,
      render,
      renderTimeline,
      renderTimelineSelection,
      timelapseStart,
      timelapseEnd;

  // Render all images for a specific timestamp
  renderTimeline = function (day) {
    var el = document.getElementById('timeline-' + day),
        date = new Date(parseInt(day, 10)),
        dayPrefix = date.getDate() + '/' + (date.getMonth() + 1) + ' &mdash; ',
        fragment = document.createDocumentFragment(),
        files = timelineData[day];

    if (el.hasAttribute('data-is-rendered')) {
      return false;
    }

    if (files) {
      for (var i = 0; i < files.length; i++) {
        // Result HTML
        // li.timeline-item > a[href=#timestamp]{date} + img[src=loading.png][data-src=filepath]
        var li = document.createElement('li'),
            img = document.createElement('img'),
            a = document.createElement('a'),
            timestamp = parseInt(files[i].slice(0, -4), 10),
            date = new Date(timestamp);

        li.className = 'timeline-item';

        a.href = '#' + timestamp;
        a.innerHTML = dayPrefix + date.getHours() + ':' + (date.getMinutes() < 10 ? '0' : '') + (date.getMinutes());

        // Lazy loading so we don't hit the server too hard
        img.src = '/img/loading.png';
        img.setAttribute('data-src', '/thumbnails/' + files[i]);

        // Only the first 9 images get loaded by default
        if (i < 9) {
          img.src = img.getAttribute('data-src');
        }

        img.onload = function (e) {
          lzld(this);
        };

        li.appendChild(img);
        li.appendChild(a);

        // Work with DOM Fragments, no unneccessary DOM modifications
        fragment.appendChild(li);
      }

      el.appendChild(fragment);
      el.setAttribute('data-is-rendered', 'data-is-rendered');
    }
  };

  // Render all element containers
  render = function () {
    var el = document.getElementById('timeline'),
        today = new Date(),
        days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
        fragment = document.createDocumentFragment();

    today.setHours(0, 0, 0, 0);

    for (var i = 0; i < timelineData.days.length; i++) {
      // Result HTML
      // (h2>a.js-toggle-day[href=#timestamp]{date}) + ul#timeline-timestamp[data-is-closed]
      var day = new Date(timelineData.days[i]),
          h2 = document.createElement('h2'),
          a = document.createElement('a'),
          ul = document.createElement('ul');

      a.innerHTML = ((day.getTime() === today.getTime()) ? 'Today' : days[day.getDay()]) + ' &mdash; ' + day.getDate() + '/' + (day.getMonth() + 1);
      a.setAttribute('href', '#' + timelineData.days[i]);
      a.className = 'js-toggle-day';
      ul.setAttribute('data-day', timelineData.days[i]);
      ul.className = 'timeline';
      ul.setAttribute('id', 'timeline-' + timelineData.days[i]);
      if (i > 0) {
        ul.setAttribute('data-is-closed', 'data-is-closed');
      }
      h2.appendChild(a);
      fragment.appendChild(h2);
      fragment.appendChild(ul);
    }

    el.appendChild(fragment);

    renderTimeline(timelineData.days[0]);
  };

  // Load timeline info from JSON
  loadTimeline = function () {
    var r = new XMLHttpRequest();
    r.open('GET', '/timeline/', true);
    r.onreadystatechange = function () {
      if (r.readyState != 4 || r.status != 200) return;
      timelineData = JSON.parse(r.responseText);
      render();
      bindTimeline();
    };
    r.send();
  };

  renderTimelineSelection = function (invert) {
    var items = document.getElementById('timeline').getElementsByTagName('li'),
        btn = document.getElementById('btn-generate-timelapse'),
        isInTimelapse = false,
        timelapseCount;

    if (invert) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.hasAttribute('data-timelapse-end')) {
          item.removeAttribute('data-timelapse-end');
          item.setAttribute('data-timelapse-start', 'data-timelapse-start');
          break;
        }
      }

      for (var j = 0; j < i; j++) {
        var item = items[j];
        if (item.hasAttribute('data-timelapse-start')) {
          item.removeAttribute('data-timelapse-start');
          item.setAttribute('data-timelapse-end', 'data-timelapse-end');
        }
      }
    }

    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      if (item.hasAttribute('data-timelapse-end')) {
        isInTimelapse = true;
        timelapseCount = 0;
      }

      if (isInTimelapse) {
        item.setAttribute('data-timelapse-part', 'data-timelapse-part');
        timelapseCount++;
      }

      if (item.hasAttribute('data-timelapse-start')) {
        isInTimelapse = false;
      }
    }

    btn.removeAttribute('data-is-hidden');
    btn.href = '/generate/' + timelapseStart + '/' + timelapseEnd + '/';
    btn.innerHTML = 'Generate timelapse (' + timelapseCount + ')';
  };

  clearTimelineSelection = function () {
    var items = document.getElementById('timeline').getElementsByTagName('li'),
        btn = document.getElementById('btn-generate-timelapse');

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item.hasAttribute('data-timelapse-part')) {
        item.removeAttribute('data-timelapse-part');
      }

      if (item.hasAttribute('data-timelapse-end')) {
        item.removeAttribute('data-timelapse-end');
      }

      if (item.hasAttribute('data-timelapse-start')) {
        item.removeAttribute('data-timelapse-start');
      }
    }

    btn.setAttribute('data-is-hidden', 'data-is-hidden');
  };

  bindTimeline = function () {
    var el = document.getElementById('timeline');

    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (e.target.parentNode.className === 'timeline-item') {
        // No timelapse started or new timelapse needed
        if ((timelapseStart && timelapseEnd) || !timelapseEnd) {
          clearTimelineSelection();
          // Because the timelapse get rendered new to old, first click is actually the timelapse end
          timelapseEnd = e.target.getAttribute('href').substr(1);
          timelapseStart = null;
          e.target.parentNode.setAttribute('data-timelapse-end', 'data-timelapse-end');
        } else if (!timelapseStart) {
          var invert = false;

          if (e.target.parentNode.hasAttribute('data-timelapse-end')) {
            return false;
          }

          // Because the timelapse get rendered new to old, second click is actually the timelapse start
          timelapseStart = e.target.getAttribute('href').substr(1);
          if (timelapseEnd < timelapseStart) {
            // Clicking before the end should invert start and end
            invert = true;
            timelapseEnd = timelapseStart;
            timelapseStart = e.target.getAttribute('href').substr(1);
          }
          e.target.parentNode.setAttribute('data-timelapse-start', 'data-timelapse-start');
          renderTimelineSelection(invert);
        }
      } else if (e.target.className === 'js-toggle-day') {
        var day = e.target.getAttribute('href').substr(1),
            timeline = document.getElementById('timeline-' + day);

        if (timeline.hasAttribute('data-is-closed')) {
          timeline.removeAttribute('data-is-closed');
          renderTimeline(day);
        } else {
          timeline.setAttribute('data-is-closed', 'data-is-closed');
        }
      }
    });
  };

  // To check the queue,
  // a AJAX HEAD request gets sent every 5 seconds
  // until it returns a 200 OK, meaning the file exists
  checkQueue = function (start, end) {
    var r = new XMLHttpRequest();
    r.open('HEAD', '/timelapse/' + start + '-' + end + '.mp4', false);
    r.onreadystatechange = function () {
      if (r.readyState === 4) {
        if (r.status === 404) {
          setTimeout(function () {
            checkQueue(start, end);
          }, 5000);
        } else if (r.status === 200) {
          document.getElementsByClassName('intro')[0].style.display = 'none';
          document.getElementsByClassName('loading')[0].style.display = 'none';
          document.getElementsByClassName('done')[0].style.display = 'block';
          document.getElementById('btn-download').href = '/timelapse/' + start + '-' + end + '.mp4';
        }
      }
      if (console.clear) {
        console.clear();
      }
    }
    r.send();
  };

  if (document.getElementById('timeline')) {
    loadTimeline();
  }

  if (document.getElementById('queue')) {
    var params = location.search.substr(1).split('&'),
        filtered = {};

    for (var i = 0; i < params.length; i++) {
      var param = params[i],
          pos = param.indexOf('='),
          key = param.slice(0, pos),
          value = param.substr(pos + 1);

      filtered[key] = value;
    }

    checkQueue(filtered.start, filtered.end);
  }

  // Socket.io real-time communication
  // works on two events
  // image:initial sends the relative path to the latest image known to the server
  // image:live sends live update
  if (document.getElementById('live')) {
    var socket = io.connect('http://url.to.api/'),
        el = document.getElementById('live');

    socket.on('image:initial', function (data) {
      el.src = data.url;
    });

    socket.on('image:live', function (data) {
      el.src = '';
      el.src = './live.jpg?t='+new Date().getTime();
    });

    socket.on('connections:count', function (data) {
      document.getElementById('live-connections').innerHTML = data.count;
    });
  }

})();
