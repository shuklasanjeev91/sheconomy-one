/** Native meetings use system immersive chrome — no browser Fullscreen API. */
export function useMeetingFullscreen(_target?: unknown) {
  return {
    supported: false,
    active: false,
    toggle: async () => {},
    unsupportedMessage: 'Full screen is managed by the device on iOS and Android.',
  }
}
