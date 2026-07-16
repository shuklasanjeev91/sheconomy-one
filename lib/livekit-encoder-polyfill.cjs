/**
 * Load LiveKit TextEncoder/TextDecoder polyfill without using a package
 * "exports" subpath (Vite/oxc and Node both reject the deep import).
 */
const path = require('node:path')

require(
  path.join(
    __dirname,
    '../node_modules/@livekit/react-native/lib/commonjs/polyfills/EncoderDecoderTogether.min.js',
  ),
)
