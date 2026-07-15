import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'one'
import { useDispatch, useSelector } from 'react-redux'

import { Button, Text, XStack, YStack } from '~/components/ui'
import { needsProfileOnboarding } from '~/features/auth/services/onboarding'
import {
  enrichProfileFromAuth,
  type OnboardingProfile,
} from '~/features/auth/services/profile-enrichment'
import { useSupabase } from '~/providers/SupabaseProvider'
import {
  evaluateBasicProfileModal,
  setBasicProfileSkipped,
  setShowBasicProfileModal,
} from '~/lib/profile/profile.store'
import type { RootState } from '~/lib/store'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Soft prompt for signed-in members who skipped or never finished profile onboarding.
 */
export function ProfileOnboardingNudge() {
  const ui = useAppUi()
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const { user, isLoading } = useSupabase()
  const show = useSelector((s: RootState) => s.profileCompletion.showBasicProfileModal)
  const [profile, setProfile] = useState<OnboardingProfile | null>(null)

  useEffect(() => {
    if (isLoading || !user?.id) {
      dispatch(setShowBasicProfileModal(false))
      return
    }
    if (pathname.startsWith('/auth/')) return

    let cancelled = false
    void (async () => {
      const { profile: row } = await enrichProfileFromAuth(user)
      if (cancelled || !row) return
      setProfile(row)
      const needs = needsProfileOnboarding(row)
      dispatch(
        evaluateBasicProfileModal({
          profile: row as never,
          completionScore: row.profile_completion_percentage ?? 0,
        }),
      )
      if (needs && !row.onboarding_completed_at) {
        dispatch(setShowBasicProfileModal(true))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dispatch, isLoading, pathname, user])

  if (!show || !user || pathname.startsWith('/auth/')) return null
  if (profile?.onboarding_completed_at) return null

  return (
    <YStack
      width="100%"
      paddingHorizontal="$3"
      paddingVertical="$2"
      backgroundColor={ui.surfaceMuted}
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
    >
      <XStack
        alignItems="center"
        gap="$3"
        maxWidth={960}
        width="100%"
        alignSelf="center"
        flexWrap="wrap"
      >
        <YStack flex={1} gap={2} minWidth={200}>
          <Text fontWeight="700" color={ui.text} fontSize={14}>
            Finish your profile
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            {Math.round(profile?.profile_completion_percentage ?? 0)}% complete — add interests and
            preferences for better matches.
          </Text>
        </YStack>
        <Button
          tone="primary"
          size="$2"
          onPress={() => router.push(appRoutes.completeProfile)}
        >
          Continue
        </Button>
        <Button
          tone="ghost"
          size="$2"
          onPress={() => {
            dispatch(setBasicProfileSkipped(true))
            dispatch(setShowBasicProfileModal(false))
          }}
        >
          Later
        </Button>
      </XStack>
    </YStack>
  )
}
