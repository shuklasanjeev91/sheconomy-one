import { useEffect, useState } from 'react'
import { Linking, Platform, Share } from 'react-native'

import { PageSection } from '~/components/layout'
import { Button, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '~/lib/platform/open-in-app'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { ensureReferralCode, getInviteShareUrl } from '~/lib/referral/invite'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * Web home actions: store listings for every visitor, invite share for members.
 * Native apps already are the store install, so this row stays off those builds.
 */
export function HomeVisitorActions() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || !user?.id) {
      setInviteCode(null)
      return
    }
    let cancelled = false
    void ensureReferralCode(user.id).then((result) => {
      if (!cancelled && result.code) setInviteCode(result.code)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (Platform.OS !== 'web') return null

  async function shareInvite() {
    if (!inviteCode) return
    const url = getInviteShareUrl(inviteCode)
    const message = `Join me on ${BRAND_NAME} with my invite code ${inviteCode}\n${url}`
    try {
      await Share.share({ title: `${BRAND_NAME} invite`, message, url })
    } catch {
      const copied = await copyToClipboard(url)
      toast.show(copied ? 'Invite link copied' : 'Could not share invite', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  return (
    <PageSection paddingTop="$2" gap="$2">
      <Text fontSize={14} fontWeight="700" color={ui.text}>
        Shop on iPhone or Android
      </Text>
      <YStack gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$3"
            tone="primary"
            onPress={() => void Linking.openURL(IOS_APP_STORE_URL)}
          >
            Get the iPhone app
          </Button>
          <Button
            size="$3"
            tone="outline"
            onPress={() => void Linking.openURL(ANDROID_PLAY_STORE_URL)}
          >
            Get the Android app
          </Button>
          {user && inviteCode ? (
            <Button size="$3" tone="outline" onPress={() => void shareInvite()}>
              Share your invite
            </Button>
          ) : null}
        </XStack>
      </YStack>
    </PageSection>
  )
}
