import { Separator as TSeparator, styled } from 'tamagui'

/** Hairline divider that respects the current theme's border color. */
export const Separator = styled(TSeparator, {
  name: 'Separator',
  borderColor: '$borderColor',
  opacity: 0.65,
})