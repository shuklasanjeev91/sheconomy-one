import { createElement, useEffect, useState } from 'react'
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

  return <NativeHtmlContent html={sanitized} />
}

function NativeHtmlContent({ html }: { html: string }) {
  const ui = useAppUi()
  const [WebViewComponent, setWebViewComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebViewComponent(() => module.WebView))
  }, [])

  if (!WebViewComponent) {
    return (
      <Text color={ui.text} fontSize={14} lineHeight={22} whiteSpace="pre-wrap">
        {htmlToPlainText(html)}
      </Text>
    )
  }

  const WebView = WebViewComponent
  const wrappedHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    body { margin: 0; padding: 0; font-family: -apple-system, system-ui, sans-serif; font-size: 14px; line-height: 1.7; color: ${ui.text}; background: transparent; }
    img { max-width: 100%; border-radius: 8px; }
    a { color: ${ui.brand}; }
    p { margin: 0 0 14px; }
  </style></head><body>${html}</body></html>`

  return (
    <YStack width="100%" minHeight={120}>
      <WebView
        originWhitelist={['*']}
        source={{ html: wrappedHtml }}
        style={{ flex: 1, minHeight: 120, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        onMessage={() => undefined}
      />
    </YStack>
  )
}
