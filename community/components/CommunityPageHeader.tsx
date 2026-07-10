import type { ReactNode } from 'react'

import { useCommunityUi } from '~/community/lib/community-theme'
import { AppPageHeader } from '~/components/layout/AppPageHeader'

type CommunityPageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** Community section page title — LinkedIn-blue accent rail. */
export function CommunityPageHeader({ title, subtitle, actions }: CommunityPageHeaderProps) {
  const communityUi = useCommunityUi()

  return (
    <AppPageHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      accentColor={communityUi.brand}
      size="md"
    />
  )
}
