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

function concatter (list, arg) {
  if (!Array.isArray(list)) {
    return concatter([String(list)], arg);
  }
  return list.join(arg);
}

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
      augment(env, jp.get(data, '/common/secret_env', {}));

      jp.has(ci, '/appveyor/init') || jp.set(ci, '/appveyor/init', []);
      var secrets = jp.get(data, '/common/secret_env', {})
      Object.keys(secrets).map(function (key) {
        jp.get(ci, '/appveyor/init').push({
          ps: '$env:' + key + ' = echo $env:' + key + ' | openssl enc -aes-128-cbc -a -d -salt -pass pass:$env:ENV_SECRET'
        })
      });

      if (jp.has(build, '/git')) {
        Object.keys(jp.get(build, '/git')).map(function (key) {
          if (key == 'autocrlf') {
            jp.has(ci, '/appveyor/init') || jp.set(ci, '/appveyor/init', []);
            jp.get(ci, '/appveyor/init').push('git config --global core.autocrlf ' + jp.get(build, '/git/autocrlf'))
          }
        })
      }

      var formatcmd = function (item) {
        if (typeof item == 'string') {
          return formatcmd({cmd: item});
        }
        if ('cmd' in item) {
          return {cmd: 'setlocal & ' + concatter(item.cmd, ' & ') + ' & endlocal'};
        }
        if ('ps' in item) {
          return {ps: 'powershell{ ' + concatter(item.ps, '; ') + ' }'};
        } 
        if ('cygwin' in item) {
          return '%CYG_BASH% -lc "exec 0</dev/null; ' + concatter(item.cygwin, '; ').replace(/"/g, '""').slice(0, -1) + ' "\n'
        }
        return item;
      }

      if (jp.has(build, '/stages/setup')) {
        jp.set(ci, '/appveyor/install', jp.get(build, '/stages/setup').map(formatcmd));
      }
      if (jp.has(build, '/stages/build')) {
        jp.set(ci, '/appveyor/build_script', jp.get(build, '/stages/build').map(formatcmd));
      }
    }

    if (build.os == 'osx') {
      var env = {};
      augment(env, jp.get(build, '/env', {}));
      augment(env, jp.get(data, '/common/env', {}));
      augment(env, jp.get(data, '/common/secret_env', {}));

      jp.has(ci, '/travis/before_install') || jp.set(ci, '/travis/before_install', []);
      var secrets = jp.get(data, '/common/secret_env', {})
      Object.keys(secrets).map(function (key) {
        jp.get(ci, '/travis/before_install').push(
          'export ' + key + '=$(echo $' + key + ' | openssl enc -aes-128-cbc -a -d -salt -pass pass:$ENV_SECRET)'
        )
      });

      jp.set(ci, '/travis/env/global', Object.keys(env).map(function (key) {
        return key + '=' + quote([env[key]]);
      }));

      // TODO git autocrlf

      var formatcmd = function (item) {
        return '(a; ' + concatter(item, '; ') + ' );z';
      }

      if (jp.has(build, '/stages/setup')) {
        jp.set(ci, '/travis/install', [
          'a() { set -e; }',
          'z() { E=$?; test $E -eq 0 && return 0; printf "\\n\\033[1;31mThe command failed with exit code $?.\\033[0m"; set -e; return $E; }',
        ].concat(jp.get(build, '/stages/setup').map(formatcmd)));
      }
      if (jp.has(build, '/stages/build')) {
        jp.set(ci, '/travis/script', jp.get(build, '/stages/build').map(formatcmd));
      }
    }

    if (build.os == 'linux') {
      var env;
      jp.set(ci, '/circle/machine/environment', env = {});
      augment(env, jp.get(build, '/env', {}));
      augment(env, jp.get(data, '/common/env', {}));
      augment(env, jp.get(data, '/common/secret_env', {}));

      var secrets = jp.get(data, '/common/secret_env', {})
      var percommand = {
        environment: {}
      };
      Object.keys(secrets).map(function (key) {
        percommand.environment[key] = '$(echo $' + key + ' | openssl enc -aes-128-cbc -a -d -salt -pass pass:$ENV_SECRET)'
      });
      
        // environment: HELLO: $(echo U2FsdGVkX1940igK3ga6hIrpkZZgQShveatTFrIx0Gc= | openssl enc -aes-128-cbc -a -d -salt -pass pass:$ENV_SECRET)

      // TODO git autocrlf

      jp.set(ci, '/circle/dependencies/override', [
        'true'
      ]);
      if (jp.has(build, '/stages/setup')) {
        jp.set(ci, '/circle/dependencies/pre', jp.get(build, '/stages/setup').map(function (item) {
          var k = concatter(item, '; ');
          var out = {}
          out[k] = JSON.parse(JSON.stringify(percommand));
          return out;
        }));
      }
      if (jp.has(build, '/stages/build')) {
        // TODO is 'test' the right thing here
        jp.set(ci, '/circle/dependencies/override', jp.get(build, '/stages/build').map(function (item) {
          var k = concatter(item, '; ');
          var out = {}
          out[k] = JSON.parse(JSON.stringify(percommand));
          return out;
        }));
      }

      jp.set(ci, '/circle/test/override', [
        'true'
      ]);
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
  }

  if (jp.has(ci, '/travis')) {
    // To match Circle CI
    jp.set(ci, '/travis/git/depth', 10);

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
