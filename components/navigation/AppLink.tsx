import { Link } from 'one'
import type { Href } from 'one'
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Platform } from 'react-native'

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
    // On native, always use imperative navigation. One Link + Radix Slot can
    // attach onPress to Text (non-pressable) or lose pushes inside sheets.
    if (Platform.OS !== 'web') {
      const go = () => navigateApp(inApp as Href, { replace })

      if (asChild && isValidElement(children)) {
        const child = Children.only(children) as ReactElement<{ onPress?: () => void }>
        return cloneElement(child, {
          onPress: () => {
            go()
            child.props.onPress?.()
          },
        })
      }

      return (
        <XStack cursor="pointer" onPress={go} role="link">
          {children}
        </XStack>
      )
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

  if (asChild && isValidElement(children)) {
    const child = Children.only(children) as ReactElement<{ onPress?: () => void }>
    return cloneElement(child, {
      onPress: () => {
        open()
        child.props.onPress?.()
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
