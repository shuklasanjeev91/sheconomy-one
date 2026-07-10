/**
 * Expo's `expo/virtual/streams.js` polyfill is babel-transformed into a global
 * script that calls bare `require()` — Hermes has no global `require`, so iOS
 * crashes with "Property 'require' doesn't exist" before the app boots.
 * RN 0.83+ provides Web Streams natively; skip this polyfill on native.
 */
function withoutExpoStreamsPolyfillOnNative(config) {
  const original = config?.serializer?.getPolyfills
  if (!original) return config

  return {
    ...config,
    serializer: {
      ...config.serializer,
      getPolyfills(ctx) {
        const polyfills = original(ctx)
        if (ctx.platform === 'ios' || ctx.platform === 'android') {
          return polyfills.filter((p) => !String(p).includes('expo/virtual/streams'))
        }
        return polyfills
      },
    },
  }
}

module.exports = { withoutExpoStreamsPolyfillOnNative }
