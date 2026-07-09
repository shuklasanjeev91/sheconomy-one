import type { ReactNode } from 'react'

import { ClassMediaTabs } from '~/class/components/ClassMediaTabs'
import { Text, YStack, useMedia } from '~/components/ui'
import { FullWidthLayout, PageRail, PageSection } from '~/components/layout'
import { LAYOUT_STRETCH } from '~/lib/layout/styles'
import { useAppUi } from '~/lib/theme/useAppUi'

type ClassShellProps = {
  children: ReactNode
}

export function ClassShell({ children }: ClassShellProps) {
  const ui = useAppUi()
  const media = useMedia()

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
        <PageRail {...LAYOUT_STRETCH}>
          <YStack gap="$5" {...LAYOUT_STRETCH}>
            {media.gtMd ? (
              <YStack gap="$3" width="100%">
                <Text fontSize={28} fontWeight="700" color={ui.text} letterSpacing={-0.5}>
                  Classes
                </Text>
                <ClassMediaTabs />
              </YStack>
            ) : null}

            {children}
          </YStack>
        </PageRail>
      </PageSection>
    </FullWidthLayout>
  )
}