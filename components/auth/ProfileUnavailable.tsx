import { PageCenter } from '~/components/layout'
import { Button, Text, YStack } from '~/components/ui'
import { retryFailedProfileFetch } from '~/lib/profile/profile-store'

/**
 * Shown when the member's row could not be read. Their access is unknown, so we
 * ask rather than assume — sending them to `?gender=restricted` here would lock
 * a verified member out over a dropped request.
 */
export function ProfileUnavailable() {
  return (
    <PageCenter>
      <YStack gap="$3" alignItems="center" maxWidth={340} paddingHorizontal="$4">
        <Text fontSize="$5" fontWeight="600" textAlign="center">
          Couldn't load your account
        </Text>
        <Text fontSize="$3" opacity={0.7} textAlign="center">
          Check your connection and try again.
        </Text>
        <Button onPress={() => retryFailedProfileFetch()}>Try again</Button>
      </YStack>
    </PageCenter>
  )
}
