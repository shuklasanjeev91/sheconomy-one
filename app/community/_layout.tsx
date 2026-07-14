import { Slot } from 'one'

import { CommunityComposerHost } from '~/community/components/CommunityComposerHost'

export default function CommunityLayout() {
  return (
    <>
      <Slot />
      <CommunityComposerHost />
    </>
  )
}
