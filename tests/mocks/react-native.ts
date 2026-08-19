export const Platform = {
  OS: 'web' as const,
  select: <T,>(spec: { web?: T; default?: T; ios?: T; android?: T }) =>
    spec.web ?? spec.default,
}

export const Linking = {
  canOpenURL: async (_url: string) => true,
  openURL: async (_url: string) => {},
  getInitialURL: async () => null as string | null,
  addEventListener: (_type: string, _handler: (event: { url: string }) => void) => ({
    remove: () => {},
  }),
}
