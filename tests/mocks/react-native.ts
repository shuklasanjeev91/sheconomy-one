export const Platform = {
  OS: 'web' as const,
  select: <T,>(spec: { web?: T; default?: T; ios?: T; android?: T }) =>
    spec.web ?? spec.default,
}
