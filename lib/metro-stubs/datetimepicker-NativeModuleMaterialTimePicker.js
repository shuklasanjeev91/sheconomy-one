/** Metro-only stub — real TurboModule is bundled by VxRN for Archive. */
module.exports = {
  dismiss: async () => false,
  open: async () => ({ action: 'dismissedAction', timestamp: 0, utcOffset: 0 }),
}
