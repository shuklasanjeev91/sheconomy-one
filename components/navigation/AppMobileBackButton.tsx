import { Button, Icons } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import { getAppColors } from '~/components/navigation/app/config'
import { useMobileBackNavigation } from '~/hooks/useMobileBackNavigation'

type AppMobileBackButtonProps = {
  /** Force-hide even when the route would normally show back. */
  hidden?: boolean
}

/** Circular back control for mobile/tablet chrome — hidden on desktop via parent layout. */
export function AppMobileBackButton({ hidden = false }: AppMobileBackButtonProps) {
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const { showBack, goBack } = useMobileBackNavigation()

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
