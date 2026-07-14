import { Text, YStack } from 'tamagui'

import { Button } from '~/components/ui/Button'
import { useAppUi } from '~/lib/theme/useAppUi'

type MaintenanceScreenProps = {
  message: string
  onRetry?: () => void
}

/** Full-screen maintenance gate when remote config enables maintenanceMode. */
export function MaintenanceScreen({ message, onRetry }: MaintenanceScreenProps) {
  const ui = useAppUi()

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={10000}
      backgroundColor={ui.surface as never}
      alignItems="center"
      justifyContent="center"
      padding="$6"
      gap="$4"
    >
      <Text fontSize={22} fontWeight="700" color={ui.text as never} textAlign="center">
        We'll be right back
      </Text>
      <Text
        fontSize={15}
        color={ui.textMuted as never}
        textAlign="center"
        maxWidth={420}
        lineHeight={22}
      >
        {message}
      </Text>
      {onRetry ? (
        <Button tone="primary" onPress={onRetry}>
          Try again
        </Button>
      ) : null}
    </YStack>
  )
}
