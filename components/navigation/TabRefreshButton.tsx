import { Icons, Spinner, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type TabRefreshButtonProps = {
  onRefresh: () => void
  refreshing?: boolean
  label?: string
}

/** Cross-platform refresh control (web + iOS + Android). */
export function TabRefreshButton({
  onRefresh,
  refreshing = false,
  label = 'Refresh',
}: TabRefreshButtonProps) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal={12}
      paddingVertical={7}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      cursor="pointer"
      opacity={refreshing ? 0.7 : 1}
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.85 }}
      onPress={() => {
        if (!refreshing) onRefresh()
      }}
      accessibilityLabel={label}
    >
      {refreshing ? (
        <Spinner size="small" color={ui.brand} />
      ) : (
        <Icons.RefreshCw size={14} color={ui.brand} />
      )}
      <Text fontSize={12} fontWeight="700" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}
