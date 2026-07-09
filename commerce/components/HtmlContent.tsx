import { createElement } from 'react'
import { Platform } from 'react-native'

import { Paragraph, Text, YStack } from '~/components/ui'
import { htmlToPlainText, sanitizeListingHtml } from '~/lib/listing-html'
import { useAppUi } from '~/lib/theme/useAppUi'

type HtmlContentProps = {
  html: string
  emptyMessage?: string
}

export function HtmlContent({
  html,
  emptyMessage = 'No description provided for this listing.',
}: HtmlContentProps) {
  const ui = useAppUi()
  const sanitized = sanitizeListingHtml(html)

  if (!sanitized) {
    return (
      <Paragraph color={ui.textSecondary} fontSize={14} lineHeight={22}>
        {emptyMessage}
      </Paragraph>
    )
  }

  if (Platform.OS === 'web') {
    return createElement('div', {
      className: 'listing-html-content',
      dangerouslySetInnerHTML: { __html: sanitized },
    })
  }

  return (
    <YStack gap="$2">
      <Text color={ui.text} fontSize={14} lineHeight={22} whiteSpace="pre-wrap">
        {htmlToPlainText(sanitized)}
      </Text>
    </YStack>
  )
}