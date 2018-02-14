var _ = require('lodash');
var config = require('./config.js');
var fs = require('fs');
var argv = require('boring')();
var request = require('request-promise');
var Promise = require('bluebird');

var sitesByVersion = {
  '2.x': [],
  '0.x': [],
  '1.x': [],
  'NOT APOSTROPHE': []
};

var errors = [];

var preprodUrls = [];

fetchAllMonitors()
.then(function(monitors) {
  return Promise.map(monitors, oneMonitor, { concurrency: 100 });
  function oneMonitor(monitor) {
    return request(monitor.url)
    .then(function(html) {
      if (html.match(/data\-apos\-widget\-id/)) {
        sitesByVersion['2.x'].push(monitor.friendly_name);
      } else if (html.match(/apos-widget/)) {
        sitesByVersion['0.x'].push(monitor.friendly_name);
      } else if (html.match(/apostrophe\.ready/)) {
        sitesByVersion['1.x'].push(monitor.friendly_name);
      } else {
        sitesByVersion['NOT APOSTROPHE'].push(monitor.friendly_name);
      }
      if (monitor.url.match(/punkave\.net/)) {
        preprodUrls.push(monitor.url);
      }
    })
    .catch(function(err) {
      errors.push(monitor.friendly_name + ': ' + monitor.url);
    });
  }
})
.then(function() {
  _.each(sitesByVersion, function(val, key) {
    val.sort(sortInsensitively);
  });
  preprodUrls.sort(sortInsensitively);
  errors.sort(sortInsensitively);
  console.log(JSON.stringify(sitesByVersion, null, '  '));
  console.log('\n\nPRE-PRODUCTION URLS\n\n');
  console.log(preprodUrls);
  console.log('\n\nERRORS\n\n');
  console.log(errors);
})
.catch(function(err) {
  throw err;
});

function sortInsensitively(a, b) {
  if (a.toLowerCase() < b.toLowerCase()) {
    return -1;
  } else if (a.toLowerCase() >= b.toLowerCase()) {
    return 1;
  } else {
    return 0;
  }
}

function fetchAllMonitors(offset) {
  var monitors = [];
  return request('https://api.uptimerobot.com/v2/getMonitors', {
    method: 'POST',
    formData: {
      api_key: config.uptimeRobotApiKey,
      limit: 50,
      offset: offset || 0
    },
    json: true
  })
  .then(function(data) {
    if (data.monitors.length === 0) {
      return monitors;
    }
    monitors = monitors.concat(data.monitors);
    return fetchAllMonitors((offset || 0) + 50)
    .then(function(_monitors) {
      monitors = monitors.concat(_monitors);
      return monitors;
    });
  });
}