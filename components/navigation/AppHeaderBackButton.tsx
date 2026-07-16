import { Button, Icons } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { getAppColors } from '~/components/navigation/app/config'
import { useAppBackNavigation } from '~/hooks/useAppBackNavigation'

type AppHeaderBackButtonProps = {
  /** Force-hide even when the route would normally show back. */
  hidden?: boolean
}

/**
 * Shared header back control for web, iOS, and Android.
 * Uses soft SPA navigation (history when possible, section fallback otherwise).
 */
export function AppHeaderBackButton({ hidden = false }: AppHeaderBackButtonProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const { showBack, goBack } = useAppBackNavigation()

  if (hidden || !showBack) return null

  return (
    <Button
      tone="ghost"
      circular
      size="$3"
      width={36}
      height={36}
      padding={0}
      backgroundColor={colors.chip}
      hoverStyle={{ backgroundColor: colors.chipHover }}
      pressStyle={{ opacity: 0.75, scale: 0.96, backgroundColor: colors.chipHover }}
      onPress={goBack}
      aria-label="Go back"
      icon={<Icons.ArrowLeft size={20} color={colors.text} />}
    />
  )
}

/** @deprecated Prefer `AppHeaderBackButton`. */
export const AppMobileBackButton = AppHeaderBackButton
