xctool-node
===========

Node wrapper around XCTool (experimental)


#What it is

This is a wrapper for adding some convenience around running XCode tests via the command line (with xctool).
It provides:
- A simple console style test runner interface, for just running tests quickly.
- A command-line tool for running tests via a CI system.
- The ability to run suites or tests in series with a simulator reset in between.

#What it is not

This is not meant to be a replacement or complete wrapper in any way around xctool.
While this contains some building blocks, around running xctool via node, it's single purpose right now is to simplify setting up & running specific tests & suites via a CI.
This is not an includeable node module, and is meant to be installed via the `-g` flag only. (`npm install -g xctool-node`)

#How to use it

- `npm install -g node-xctool`
- Add an `.xctool-args` file to your XCode project base directory, with your testing scheme and project pre-filled. For instance:
```json
[
  "-workspace", "WeHeartIt.xcworkspace",
  "-scheme", "Efron CI Test",
  "-configuration", "Debug",
  "-sdk", "iphonesimulator",
  "-arch", "i386"
]
```
Note that if you specify a reporter, it will currently be ignored, as this wrapper relies on the plain reporter.
- run `xctool-node` from the root directory of your project.
