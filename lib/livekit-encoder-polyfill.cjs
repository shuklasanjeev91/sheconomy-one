/**
 * Load LiveKit TextEncoder/TextDecoder polyfill without using a package
 * "exports" subpath (Vite/oxc reject the deep import).
 *
 * Metro requires a static string here — dynamic require(path.join(...)) fails
 * with "Invalid call" during transform.
 */
require('../node_modules/@livekit/react-native/lib/commonjs/polyfills/EncoderDecoderTogether.min.js')
