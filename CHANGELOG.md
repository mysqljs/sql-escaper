# Changelog

## [1.2.0](https://github.com/wellwelwel/sql-escaper/compare/v1.1.2...v1.2.0) (2026-02-05)


### Features

* add support for `BigInt` ([#11](https://github.com/wellwelwel/sql-escaper/issues/11)) ([b07edbe](https://github.com/wellwelwel/sql-escaper/commit/b07edbe36cc0cf8ef08ff1f1547126470fd4dd17))
* add support for `Uint8Array` ([#9](https://github.com/wellwelwel/sql-escaper/issues/9)) ([84d859b](https://github.com/wellwelwel/sql-escaper/commit/84d859bbc1bedbbfe81c2aa071684d55614e5e22))


### Bug Fixes

* preserve `JSON` path expressions ([#12](https://github.com/wellwelwel/sql-escaper/issues/12)) ([f580956](https://github.com/wellwelwel/sql-escaper/commit/f580956767c8edd45b7e95ffce3dec795722c0be))

## [1.1.2](https://github.com/wellwelwel/sql-escaper/compare/v1.1.1...v1.1.2) (2026-02-05)


### Bug Fixes

* limit object expansion to immediate placeholder ([#7](https://github.com/wellwelwel/sql-escaper/issues/7)) ([7ac70f3](https://github.com/wellwelwel/sql-escaper/commit/7ac70f3c33da09680c37d6fc0445a6368c012bb6))

## [1.1.1](https://github.com/wellwelwel/sql-escaper/compare/v1.1.0...v1.1.1) (2026-02-05)


### Bug Fixes

* prevent object expansion in placeholders after `SET` clause ([#5](https://github.com/wellwelwel/sql-escaper/issues/5)) ([557bd7f](https://github.com/wellwelwel/sql-escaper/commit/557bd7fe17b92dc2b36235721ee4f45afa3101b4))

## [1.1.0](https://github.com/wellwelwel/sql-escaper/compare/v1.0.0...v1.1.0) (2026-02-05)


### Features

* use an AST-based approach to map keywords ([#3](https://github.com/wellwelwel/sql-escaper/issues/3)) ([f7cde0a](https://github.com/wellwelwel/sql-escaper/commit/f7cde0a445bf1e0d3a4c681f195551247ce9673d))

## 1.0.0 (2026-02-04)


### Features

* SQL Escaper's birth ([139eb60](https://github.com/wellwelwel/sql-escaper/commit/139eb6036180e214794e24526214f5e76f346c28))
