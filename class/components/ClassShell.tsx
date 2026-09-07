import type { ReactNode } from 'react'

// import { ClassMediaTabs } from '~/class/components/ClassMediaTabs'
import { AppPageHeader } from '~/components/layout/AppPageHeader'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { YStack } from '~/components/ui'

type ClassShellProps = {
  children: ReactNode
  onRefresh?: () => void | Promise<void>
  refreshing?: boolean
}

export function ClassShell({ children, onRefresh, refreshing }: ClassShellProps) {
  return (
    <FullWidthLayout scroll onRefresh={onRefresh} refreshing={refreshing}>
      <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
          <YStack gap="$5" {...LAYOUT_STRETCH}>
            {children}
          </YStack>
      </PageSection>
    </FullWidthLayout>
  )
}