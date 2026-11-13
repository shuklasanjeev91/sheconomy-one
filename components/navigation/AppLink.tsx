import { Link } from 'one'
import type { Href } from 'one'
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'

import { XStack } from '~/components/ui'
import { navigateApp } from '~/lib/platform/navigate'
import { inAppPathFromUrl, openExternalUrl } from '~/lib/platform/openUrl'

type AppLinkProps = {
  href: Href | string
  children: ReactNode
  /**
   * @deprecated Ignored on native (always push). Still forwarded to One `Link` on web.
   */
  replace?: boolean
  asChild?: boolean
  /** Force external open (new tab / OS), even if path looks in-app. */
  external?: boolean
}

function childComponentName(child: ReactElement): string {
  const type = child.type
  if (typeof type === 'string') return type
  if (typeof type === 'function' || typeof type === 'object') {
    const maybe = type as { displayName?: string; name?: string }
    return maybe.displayName || maybe.name || ''
  }
  return ''
}

/**
 * Text / Paragraph are not reliably pressable on native.
 * Stacks, Buttons, and Views accept onPress safely.
 */
function canReceivePress(child: ReactElement): boolean {
  const name = childComponentName(child)
  if (!name) return true
  if (/^(Text|SizableText|Paragraph|Span)$/i.test(name)) return false
  if (/Text$/i.test(name) && !/Stack|Button|Input|Field/i.test(name)) return false
  return true
}

function PressableLinkShell({
  onPress,
  children,
  inline,
}: {
  onPress: () => void
  children: ReactNode
  inline?: boolean
}) {
  return (
    <XStack
      // Default to shrink-wrap so avatar/icon links don't stretch and steal taps
      // from siblings (e.g. feed composer). Full-bleed cards should use asChild + YStack.
      {...(inline
        ? { display: 'inline-flex', alignSelf: 'flex-start', maxWidth: '100%' }
        : { alignSelf: 'flex-start', flexShrink: 0, maxWidth: '100%' })}
      cursor="pointer"
      onPress={onPress}
      role="link"
      accessibilityRole="link"
      pressStyle={{ opacity: 0.85 }}
    >
      {children}
    </XStack>
  )
}

function renderAsChildPressable(
  children: ReactNode,
  onPress: () => void,
  options?: { inline?: boolean },
) {
  if (!isValidElement(children)) {
    return (
      <PressableLinkShell onPress={onPress} inline={options?.inline}>
        {children}
      </PressableLinkShell>
    )
  }

  const child = Children.only(children) as ReactElement<{
    onPress?: (...args: unknown[]) => void
    cursor?: string
    role?: string
    accessibilityRole?: string
  }>

  if (!canReceivePress(child)) {
    return (
      <PressableLinkShell onPress={onPress} inline>
        {child}
      </PressableLinkShell>
    )
  }

  return cloneElement(child, {
    onPress: (...args: unknown[]) => {
      onPress()
      child.props.onPress?.(...args)
    },
    cursor: child.props.cursor ?? 'pointer',
    role: child.props.role ?? 'link',
    accessibilityRole: child.props.accessibilityRole ?? 'link',
  } as Partial<typeof child.props>)
}

/**
 * Cross-platform in-app link.
 * - Web: real One `<Link href>` (anchor) for instant, reliable navigation + open-in-new-tab.
 * - Native: imperative `navigateApp` so Text children still receive presses.
 */
export function AppLink({ href, children, replace, asChild, external }: AppLinkProps) {
  const hrefStr = String(href)
  const inApp = !external ? inAppPathFromUrl(hrefStr) : null

  if (inApp) {
    if (Platform.OS !== 'web') {
      const go = () => navigateApp(inApp as Href)
      if (asChild) return renderAsChildPressable(children, go, { inline: true })
      return <PressableLinkShell onPress={go}>{children}</PressableLinkShell>
    }

    return (
      <Link href={inApp as Href} replace={replace} asChild={asChild}>
        {children as ReactElement}
      </Link>
    )
  }

  const open = () => {
    void openExternalUrl(hrefStr)
  }

  if (asChild) return renderAsChildPressable(children, open, { inline: true })
  return <PressableLinkShell onPress={open}>{children}</PressableLinkShell>
}

/** Imperative helper when a Button / Pressable owns the gesture — always `router.push`. */
export function pressNavigate(
  href: Href | string,
  options?: { replace?: boolean; external?: boolean },
) {
  const hrefStr = String(href)
  if (options?.external || !inAppPathFromUrl(hrefStr)) {
    void openExternalUrl(hrefStr)
    return
  }
  navigateApp(hrefStr as Href)
}
