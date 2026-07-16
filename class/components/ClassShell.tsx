import type { ReactNode } from 'react'

import { ClassMediaTabs } from '~/class/components/ClassMediaTabs'
import { AppPageHeader } from '~/components/layout/AppPageHeader'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { YStack, useMedia } from '~/components/ui'

type ClassShellProps = {
  children: ReactNode
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function ClassShell({ children, onRefresh, refreshing }: ClassShellProps) {
  const media = useMedia()

  return (
    <FullWidthLayout scroll onRefresh={onRefresh} refreshing={refreshing}>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
          <YStack gap="$5" {...LAYOUT_STRETCH}>
            {media.gtMd ? (
              <YStack gap="$4" width="100%">
                <AppPageHeader
                  title="Classes"
                  subtitle="Video programs and audio sessions from the community"
                />
                <ClassMediaTabs />
              </YStack>
            ) : null}

            {children}
          </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}