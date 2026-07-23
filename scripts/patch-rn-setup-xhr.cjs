/**
 * Patch RN setUpXHR for Hermes on Android.
 *
 * Hermes may expose Request/fetch on globalThis in a way that `typeof global.X`
 * is wrong while the property is still non-configurable — use descriptors and
 * never replace existing fetch-family globals.
 */
const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'Libraries',
  'Core',
  'setUpXHR.js',
)

const MARKER = 'SHECONOMY: descriptor-safe fetch polyfills'

const patched = `/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

'use strict';

const {polyfillGlobal} = require('../Utilities/PolyfillFunctions');

/**
 * Set up XMLHttpRequest. The native XMLHttpRequest in Chrome dev tools is CORS
 * aware and won't let you fetch anything from the internet.
 *
 * You can use this module directly, or just require InitializeCore.
 *
 * ${MARKER}.
 */
polyfillGlobal(
  'XMLHttpRequest',
  () => require('../Network/XMLHttpRequest').default,
);
polyfillGlobal('FormData', () => require('../Network/FormData').default);

function hasFetchGlobal(name) {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  if (typeof g[name] === 'function' || typeof global[name] === 'function') {
    return true;
  }
  return !!(
    Object.getOwnPropertyDescriptor(g, name) ||
    Object.getOwnPropertyDescriptor(global, name)
  );
}

function polyfillFetchGlobalIfMissing(name, getValue) {
  if (!hasFetchGlobal(name)) {
    polyfillGlobal(name, getValue);
  }
}

polyfillFetchGlobalIfMissing('fetch', () => require('../Network/fetch').fetch);
polyfillFetchGlobalIfMissing('Headers', () => require('../Network/fetch').Headers);
polyfillFetchGlobalIfMissing('Request', () => require('../Network/fetch').Request);
polyfillFetchGlobalIfMissing('Response', () => require('../Network/fetch').Response);

polyfillGlobal('WebSocket', () => require('../WebSocket/WebSocket').default);
polyfillGlobal('Blob', () => require('../Blob/Blob').default);
polyfillGlobal('File', () => require('../Blob/File').default);
polyfillGlobal('FileReader', () => require('../Blob/FileReader').default);

if (typeof global.URL !== 'function') {
  polyfillGlobal('URL', () => require('../Blob/URL').URL);
}
if (typeof global.URLSearchParams !== 'function') {
  polyfillGlobal('URLSearchParams', () => require('../Blob/URL').URLSearchParams);
}

if (typeof global.AbortController !== 'function') {
  polyfillGlobal(
    'AbortController',
    () => require('abort-controller/dist/abort-controller').AbortController, // flowlint-line untyped-import:off
  );
}
if (typeof global.AbortSignal !== 'function') {
  polyfillGlobal(
    'AbortSignal',
    () => require('abort-controller/dist/abort-controller').AbortSignal, // flowlint-line untyped-import:off
  );
}
`

if (!fs.existsSync(target)) {
  console.warn('[patch-rn-setup-xhr] skip — file missing:', target)
  process.exit(0)
}

fs.writeFileSync(target, patched)
console.log('[patch-rn-setup-xhr] patched', path.relative(process.cwd(), target))
