import { forwardRef } from 'react'
import type { GetProps } from 'tamagui'
import { Tabs as TTabs, styled } from 'tamagui'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'

export const Tabs = forwardRef<any, GetProps<typeof TTabs>>(function Tabs(props, ref) {
  return <TTabs ref={ref} theme={BRAND_THEME} {...props} />
})
Tabs.displayName = 'Tabs'

export const TabsList = styled(TTabs.List, {
  name: 'TabsList',
  backgroundColor: '$color3',
  borderRadius: '$6',
  padding: '$1',
  gap: '$1',
})

// `variants` are declared on their own inner styled() layer so their type stays
// exact — the outer layer below (which needs an `any` cast to add
// `animation`/`fontWeight', unsupported in this version's prop types despite
// working at runtime) inherits `active' from this layer's GetProps instead of
// re-declaring it, so it can't be widened away by the cast.
const TabsTriggerBase = styled(TTabs.Trigger, {
  name: 'TabsTriggerBase',
  variants: {
    /** pass `active={value === currentTab}` — Tabs.Trigger has no built-in selected state */
    active: {
      true: {
        backgroundColor: '$background',
        ...getShadowStyle('sm'),
      },
    },
  } as const,
})

export const TabsTrigger = styled(
  TabsTriggerBase,
  {
    name: 'TabsTrigger',
    backgroundColor: 'transparent',
    borderRadius: '$5',
    borderWidth: 0,
    fontWeight: '600',
    animation: 'quick',
    hoverStyle: { backgroundColor: '$color4' },
  } as any
)

export const TabsContent = styled(TTabs.Content, {
  name: 'TabsContent',
  paddingTop: '$4',
})