import { Text, YStack } from '~/components/ui'

type BackHeaderProps = {
  title: string
  subtitle?: string
}

/**
 * Page title only — back lives in the shared app header (web / iOS / Android).
 */
export function BackHeader({ title, subtitle }: BackHeaderProps) {
  return (
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
  )
}
