var fs = require('fs');
var jp = require('json-pointer')
var difflet = require('difflet');
var quote = require('shell-quote').quote;

;(function () {
  var safe = jp.get;

  jp.get = function (root, path, def) {
    if (arguments.length > 2 && !jp.has(root, path)) {
      return def;
    }
    return safe(root, path);
  }
})();

function convert (data) {
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
      augment(env, jp.get(build, '/env', {}));
      augment(env, jp.get(data, '/common/env', {}));

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

    if (build.os == 'osx') {
      var env = {};
      augment(env, jp.get(build, '/env', {}));
      augment(env, jp.get(data, '/common/env', {}));

      jp.set(ci, '/travis/env/global', Object.keys(env).map(function (key) {
        return key + '=' + quote([env[key]]);
      }));

      // TODO git autocrlf

      if (jp.has(build, '/stages/setup')) {
        jp.set(ci, '/travis/install', jp.get(build, '/stages/setup'));
      }
      if (jp.has(build, '/stages/build')) {
        jp.set(ci, '/travis/script', jp.get(build, '/stages/build'));
      }
    }

    if (build.os == 'linux') {
      var env;
      jp.set(ci, '/circle/machine/environment', env = {});
      augment(env, jp.get(build, '/env', {}));
      augment(env, jp.get(data, '/common/env', {}));

      // TODO git autocrlf

      jp.set(ci, '/circle/dependencies/override', []);
      if (jp.has(build, '/stages/setup')) {
        jp.set(ci, '/circle/dependencies/override', jp.get(build, '/stages/setup'));
      }
      if (jp.has(build, '/stages/build')) {
        // TODO is 'test' the right thing here
        jp.set(ci, '/circle/test/override', jp.get(build, '/stages/build'));
      }
    }
  });

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

  if (jp.has(ci, '/travis')) {
    // Force OS X.
    jp.set(ci, '/travis/language', 'objective-c');

    // Is this necessary?
    jp.set(ci, '/travis/notifications/email', false)

    // Force cancellation on command failure
    jp.set(ci, '/travis/matrix/fast_finish', true)
  }

  if (jp.has(ci, '/circle')) {
    // Set current build dir
    // TODO necessary?
    jp.set(ci, '/circle/general/build_dir', '.')
  }

  return ci;
}

// console.log(require('util').inspect(ci, null, null));
// var s = difflet.compare(ci.appveyor, yaml.safeLoad(fs.readFileSync(__dirname + '/test/appveyor.yml', 'utf-8')));
// var cmp = yaml.safeLoad(fs.readFileSync(__dirname + '/test/circle.yml', 'utf-8'));
// var s = difflet.compare(ci.circle, cmp);
// process.stdout.write(s);

exports.convert = convert;
