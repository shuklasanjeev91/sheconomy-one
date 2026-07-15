import { Link } from 'one'
import type { Href } from 'one'
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

import { XStack } from '~/components/ui'
import { navigateApp } from '~/lib/platform/navigate'
import { inAppPathFromUrl, openExternalUrl } from '~/lib/platform/openUrl'

type AppLinkProps = {
  href: Href | string
  children: ReactNode
  /** Replace history entry (tabs / section switches). */
  replace?: boolean
  asChild?: boolean
  /** Force external open (new tab / OS), even if path looks in-app. */
  external?: boolean
}

/**
 * Cross-platform link: in-app → soft SPA (`one` Link / router); external → OS / new tab.
 * Never hard-reloads the app shell on web, iOS, or Android.
 */
export function AppLink({ href, children, replace, asChild, external }: AppLinkProps) {
  const hrefStr = String(href)
  const inApp = !external ? inAppPathFromUrl(hrefStr) : null

  if (inApp) {
    return (
      <Link href={inApp as Href} replace={replace} asChild={asChild}>
        {children as ReactElement}
      </Link>
    )
  }

  const open = () => {
    void openExternalUrl(hrefStr)
  }

  if (asChild && isValidElement(children)) {
    const child = Children.only(children) as ReactElement<{ onPress?: () => void }>
    return cloneElement(child, {
      onPress: () => {
        child.props.onPress?.()
        open()
      },
    })
  }

  return (
    <XStack cursor="pointer" onPress={open} role="link">
      {children}
    </XStack>
  )
}

/** Imperative helper when a Button / Pressable owns the gesture. */
export function pressNavigate(
  href: Href | string,
  options?: { replace?: boolean; external?: boolean },
) {
  const hrefStr = String(href)
  if (options?.external || !inAppPathFromUrl(hrefStr)) {
    void openExternalUrl(hrefStr)
    return
  }
  navigateApp(hrefStr as Href, { replace: options?.replace })
}
