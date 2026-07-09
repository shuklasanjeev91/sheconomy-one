import { Button, Icons, Text, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useMobileBackNavigation } from '~/hooks/useMobileBackNavigation'

type BackHeaderProps = {
  title: string
  subtitle?: string
}

/** Page title with mobile/tablet back control — hidden on desktop. */
export function BackHeader({ title, subtitle }: BackHeaderProps) {
  const { isDesktop } = useAppLayout()
  const { showBack, goBack } = useMobileBackNavigation()

  return (
    <YStack gap="$3">
      {!isDesktop && showBack ? (
        <Button
          tone="ghost"
          size="$3"
          alignSelf="flex-start"
          borderRadius={999}
          icon={<Icons.ArrowLeft size={18} />}
          onPress={goBack}
          aria-label="Go back"
        >
          Back
        </Button>
      ) : null}
      <YStack gap="$1">
        <Text fontWeight="800" fontSize="$7" letterSpacing={-0.3} color="$color12">
          {title}
        </Text>
        {subtitle ? (
          <Text color="$color10" fontSize="$3">
            {subtitle}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
