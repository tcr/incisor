# incisor

CI integration shouldn't be like pulling teeth!

[![Windows Build status](https://img.shields.io/appveyor/ci/tcr/incisor.svg?label=windows)](https://ci.appveyor.com/project/tcr/incisor/branch/master)
[![OS X Build Status](https://img.shields.io/travis/tcr/incisor.svg?label=os%20x)](https://travis-ci.org/tcr/incisor)
[![Linux Build Status](https://img.shields.io/circleci/project/tcr/incisor.svg?label=linux)](https://circleci.com/gh/tcr/incisor)

install:

```
npm install -g incisor
```

usage:

```
incisor init
incisor generate
incisor badges >> README.md
```

## how to use

stages:

* setup
* build
* test (not currently implemented.)

All commands run in separate subshells.

Secret key should be saved in your CI system's UI as `ENV_SECRET`.

TODO: document the rest

## how do the ci systems differ?

OSes:

* appveyor: windows
* circle: linux
* travis: osx

submodules

* appveyor: http://help.appveyor.com/discussions/problems/930-git-checkout-and-submodules
* circle: https://circleci.com/docs/configuration#checkout
* travis: http://docs.travis-ci.com/user/customizing-the-build/#Git-Submodules

commit depth:

* appveyor: full, configurable
* circle: 10 (from all tips), not configurable (except with complete override)
* travis: 50, configurable

shells:

* appveyor: ps, cmd, cygwin
* circle: bash?
* travis: bash?

env:

* appveyor: literals in yaml
* circle: literals in yaml, but interpreted in encrypted ui
* travis: literals in yaml

folder:

* appveyor: folder preserved between commands (same shell)
* circle: folder not preserved between commands (separate subshells)
* travis: folder preserved between commands (same shell)

secure variables:

* appveyor: encrypted through ui, specified in yaml
* circle: encrypted through ui, automatically in env
* travis: encrypted through ui, automatically in env
