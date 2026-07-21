/**
 * RN 0.83 setUpXHR + Hermes: fill missing fetch globals only.
 * Use property descriptors — typeof on global can lie for Hermes builtins.
 */
'use strict'

const {polyfillGlobal} = require('react-native/Libraries/Utilities/PolyfillFunctions')

function hasFetchGlobal(name) {
  const g = typeof globalThis !== 'undefined' ? globalThis : global
  if (typeof g[name] === 'function' || typeof global[name] === 'function') {
    return true
  }
  return !!(
    Object.getOwnPropertyDescriptor(g, name) ||
    Object.getOwnPropertyDescriptor(global, name)
  )
}

function polyfillFetchGlobalIfMissing(name, getValue) {
  if (!hasFetchGlobal(name)) {
    polyfillGlobal(name, getValue)
  }
}

polyfillGlobal(
  'XMLHttpRequest',
  () => require('react-native/Libraries/Network/XMLHttpRequest').default,
)
polyfillGlobal('FormData', () => require('react-native/Libraries/Network/FormData').default)

polyfillFetchGlobalIfMissing('fetch', () => require('react-native/Libraries/Network/fetch').fetch)
polyfillFetchGlobalIfMissing(
  'Headers',
  () => require('react-native/Libraries/Network/fetch').Headers,
)
polyfillFetchGlobalIfMissing(
  'Request',
  () => require('react-native/Libraries/Network/fetch').Request,
)
polyfillFetchGlobalIfMissing(
  'Response',
  () => require('react-native/Libraries/Network/fetch').Response,
)

polyfillGlobal('WebSocket', () => require('react-native/Libraries/WebSocket/WebSocket').default)
polyfillGlobal('Blob', () => require('react-native/Libraries/Blob/Blob').default)
polyfillGlobal('File', () => require('react-native/Libraries/Blob/File').default)
polyfillGlobal('FileReader', () => require('react-native/Libraries/Blob/FileReader').default)

if (!hasFetchGlobal('URL')) {
  polyfillGlobal('URL', () => require('react-native/Libraries/Blob/URL').URL)
}
if (!hasFetchGlobal('URLSearchParams')) {
  polyfillGlobal(
    'URLSearchParams',
    () => require('react-native/Libraries/Blob/URL').URLSearchParams,
  )
}

if (!hasFetchGlobal('AbortController')) {
  polyfillGlobal(
    'AbortController',
    () => require('abort-controller/dist/abort-controller').AbortController,
  )
}
if (!hasFetchGlobal('AbortSignal')) {
  polyfillGlobal(
    'AbortSignal',
    () => require('abort-controller/dist/abort-controller').AbortSignal,
  )
}
