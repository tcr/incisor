var yaml = require('js-yaml');
var fs = require('fs');
var jp = require('json-pointer')
var difflet = require('difflet');

var data = yaml.safeLoad(fs.readFileSync(__dirname + '/test/molar.yml', 'utf-8'))

var ci = {};

function augment (a, b) {
  for (var k in b) {
    a[k] = b[k];
  }
}

jp.get(data, '/builds').map(function (build) {
  if (build.os == 'windows') {
    var env;
    jp.set(ci, '/appveyor/environment/global', env = {});
    augment(env, jp.get(build, '/env'));
    augment(env, jp.get(data, '/common/env'));

    if (jp.has(build, '/git')) {
      Object.keys(jp.get(build, '/git')).map(function (key) {
        if (key == 'autocrlf') {
          jp.set(ci, '/appveyor/init', []);
          jp.get(ci, '/appveyor/init').push('git config --global core.autocrlf ' + jp.get(build, '/git/autocrlf'))
        }
      })
    }

    if (jp.has(build, '/stages/setup')) {
      jp.set(ci, '/appveyor/install', jp.get(build, '/stages/setup'));
    }
    if (jp.has(build, '/stages/build')) {
      jp.set(ci, '/appveyor/build_script', jp.get(build, '/stages/build'));
    }
  }
})

if (jp.has(ci, '/appveyor')) {
  // To match Circle CI
  jp.set(ci, '/appveyor/clone_depth', 10);

  // Cache Cygwin files to speed up build
  jp.set(ci, '/appveyor/cache', [
    '%CYG_CACHE%'
  ]);

  // Disable tests for now.
  jp.set(ci, '/appveyor/test', 'off');

  // Build only master branch.
  jp.set(ci, '/appveyor/branches/only', ['master']);

  // Convert cygwin steps
  jp.set(ci, '/appveyor/build_script', jp.get(ci, '/appveyor/build_script').map(function (item) {
    if (jp.has(item, '/cygwin')) {
      return '%CYG_BASH% -lc "exec 0</dev/null; ' + item.cygwin.replace(/"/g, '""').slice(0, -1) + ' "\n'
    } else {
      return item;
    }
  }));
}

// console.log(require('util').inspect(ci, null, null));
var s = difflet.compare(ci.appveyor, yaml.safeLoad(fs.readFileSync(__dirname + '/test/appveyor.yml', 'utf-8')));
process.stdout.write(s);
