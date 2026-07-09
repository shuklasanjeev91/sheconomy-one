/**
 * Native entry polyfills (injected before createApp via One setupFile).
 * One's dist/createApp.native.js omits polyfills-mobile; load them here instead.
 */
globalThis.global = globalThis

import '@azure/core-asynciterator-polyfill'
import 'core-js/actual/url'
import 'core-js/actual/url-search-params'
