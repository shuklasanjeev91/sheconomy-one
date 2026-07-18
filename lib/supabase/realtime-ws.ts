/** Client / native — browser & RN already provide WebSocket. */
export function getRealtimeTransport(): typeof WebSocket | undefined {
  return undefined
}
