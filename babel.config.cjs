// you own this file. edit freely — `one` will not regenerate it.
// delegates to one/babel-preset which holds the canonical plugin chain.

const oneBabelPreset = require('one/babel-preset')
const preset = oneBabelPreset.default || oneBabelPreset
const oneBundlerOptions = {
  "routerRoot": "app",
  "linking": {
    "scheme": "sheconomy",
    "prefixes": [
      "sheconomy://",
      "https://sheconomy.in",
      "https://www.sheconomy.in"
    ]
  },
  "setupFile": {
    "native": "./lib/polyfills.ts"
  }
}

module.exports = function (api) {
  return preset(api, oneBundlerOptions)
}
