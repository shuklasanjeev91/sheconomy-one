import { useEffect, useState } from 'react'

import { ProfileLink } from '~/community/components/ProfileLink'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  fetchIncomingRecommendationRequests,
  fetchProfileRecommendations,
  hideRecommendation,
  requestRecommendation,
  writeRecommendation,
  type ProfileRecommendation,
  type RecommendationRequest,
} from '~/community/lib/recommendations'
import {
  AppBottomSheet,
  Avatar,
  Button,
  Field,
  Icons,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type RecommendationsSectionProps = {
  profileUserId: string
  profileUsername: string
  displayName: string
  isOwnProfile: boolean
}

export function RecommendationsSection({
  profileUserId,
  profileUsername: _profileUsername,
  displayName,
  isOwnProfile,
}: RecommendationsSectionProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [items, setItems] = useState<ProfileRecommendation[]>([])
  const [incoming, setIncoming] = useState<RecommendationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<'write' | 'request' | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [fulfillingRequestId, setFulfillingRequestId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const [{ items: next }, incomingNext] = await Promise.all([
      fetchProfileRecommendations(profileUserId),
      isOwnProfile && user?.id
        ? fetchIncomingRecommendationRequests(user.id)
        : Promise.resolve({ items: [] as RecommendationRequest[], error: null }),
    ])
    setItems(next)
    setIncoming(incomingNext.items)
    setLoading(false)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId, isOwnProfile, user?.id])

  const fulfilling = fulfillingRequestId
    ? incoming.find((req) => req.id === fulfillingRequestId) ?? null
    : null

  async function handleWrite() {
    if (!user?.id) return
    const recommendedUserId = fulfilling?.requesterId ?? profileUserId
    if (recommendedUserId === user.id) {
      toast.show('Pick whose recommendation you are writing', { tone: 'danger' })
      return
    }
    setSaving(true)
    const { error } = await writeRecommendation({
      recommenderId: user.id,
      recommendedUserId,
      text: draft,
      requestId: fulfillingRequestId,
    })
    setSaving(false)
    if (error) {
      toast.show('Could not publish recommendation', { tone: 'danger', message: error })
      return
    }
    toast.show('Recommendation published', { tone: 'success' })
    setSheet(null)
    setDraft('')
    setFulfillingRequestId(null)
    void reload()
  }

  async function handleAskOnTheirProfile() {
    if (!user?.id || isOwnProfile) return
    setSaving(true)
    const { error } = await requestRecommendation({
      requesterId: user.id,
      requestedFromId: profileUserId,
      message: draft.trim() || undefined,
    })
    setSaving(false)
    if (error) {
      toast.show('Could not send request', { tone: 'danger', message: error })
      return
    }
    toast.show('Recommendation request sent', { tone: 'success' })
    setSheet(null)
    setDraft('')
  }

  async function handleHide(id: string) {
    if (!user?.id) return
    const { error } = await hideRecommendation(id, user.id)
    if (error) {
      toast.show('Could not hide recommendation', { tone: 'danger', message: error })
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  if (!loading && items.length === 0 && !isOwnProfile && !user) return null

  const writeTargetName = fulfilling?.requesterName ?? displayName
  return (
    <>
      <YStack
        backgroundColor={ui.surface}
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        padding="$4"
        gap="$3"
        style={getShadowStyle('sm')}
      >
        <XStack justifyContent="space-between" alignItems="center" gap="$2">
          <XStack gap="$2.5" alignItems="center" flex={1}>
            <YStack width={3} height={20} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
            <Icons.Award size={18} color={BRAND_BLUE} />
            <Text fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.25}>
              Recommendations
            </Text>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            {!isOwnProfile && user ? (
              <>
                <Button
                  size="$2"
                  tone="primary"
                  borderRadius={999}
                  onPress={() => {
                    setFulfillingRequestId(null)
                    setDraft('')
                    setSheet('write')
                  }}
                >
                  Recommend
                </Button>
                <Button
                  size="$2"
                  tone="outline"
                  borderRadius={999}
                  onPress={() => {
                    setDraft('')
                    setSheet('request')
                  }}
                >
                  Ask
                </Button>
              </>
            ) : null}
          </XStack>
        </XStack>

        {isOwnProfile && incoming.length > 0 ? (
          <YStack gap="$2" padding="$3" borderRadius={12} backgroundColor={ui.surfaceMuted}>
            <Text fontSize={13} fontWeight="600" color={ui.text}>
              Pending requests
            </Text>
            {incoming.map((req) => (
              <XStack key={req.id} justifyContent="space-between" alignItems="center" gap="$2">
                <YStack flex={1} gap={2}>
                  <Text fontSize={14} fontWeight="600" color={ui.text}>
                    {req.requesterName}
                  </Text>
                  {req.message ? (
                    <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
                      {req.message}
                    </Text>
                  ) : (
                    <Text fontSize={13} color={ui.textMuted}>
                      Asked for a recommendation
                    </Text>
                  )}
                </YStack>
                <Button
                  size="$2"
                  tone="primary"
                  borderRadius={999}
                  onPress={() => {
                    setFulfillingRequestId(req.id)
                    setDraft('')
                    setSheet('write')
                  }}
                >
                  Write
                </Button>
              </XStack>
            ))}
          </YStack>
        ) : null}

        {loading ? (
          <YStack alignItems="center" paddingVertical="$4">
            <Spinner size="small" />
          </YStack>
        ) : items.length === 0 ? (
          <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
            {isOwnProfile
              ? 'Ask connections to recommend you for your skills and experience.'
              : `Be the first to recommend ${displayName}.`}
          </Text>
        ) : (
          <YStack gap="$4">
            {items.map((item) => (
              <YStack key={item.id} gap="$2">
                <XStack gap="$3" alignItems="center">
                  <Avatar
                    name={item.recommenderName}
                    src={item.recommenderAvatar ?? undefined}
                    size="$3"
                  />
                  <YStack flex={1} gap={2}>
                    {item.recommenderUsername ? (
                      <ProfileLink username={item.recommenderUsername}>
                        <Text fontSize={14} fontWeight="700" color={ui.text}>
                          {item.recommenderName}
                        </Text>
                      </ProfileLink>
                    ) : (
                      <Text fontSize={14} fontWeight="700" color={ui.text}>
                        {item.recommenderName}
                      </Text>
                    )}
                    {item.recommenderHeadline ? (
                      <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                        {item.recommenderHeadline}
                      </Text>
                    ) : null}
                  </YStack>
                  {isOwnProfile ? (
                    <Button size="$2" tone="outline" onPress={() => void handleHide(item.id)}>
                      Hide
                    </Button>
                  ) : null}
                </XStack>
                <Text fontSize={14} color={ui.text} lineHeight={22}>
                  {item.recommendationText}
                </Text>
              </YStack>
            ))}
          </YStack>
        )}
      </YStack>

      <AppBottomSheet
        open={sheet != null}
        onOpenChange={(open) => {
          if (!open) {
            setSheet(null)
            setFulfillingRequestId(null)
          }
        }}
        title={sheet === 'request' ? `Ask ${displayName}` : `Recommend ${writeTargetName}`}
        footer={
          <XStack gap="$2" justifyContent="flex-end">
            <Button tone="outline" size="$3" onPress={() => setSheet(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="$3"
              disabled={saving || (sheet === 'write' && draft.trim().length < 20)}
              onPress={() =>
                void (sheet === 'request' ? handleAskOnTheirProfile() : handleWrite())
              }
            >
              {saving ? 'Saving…' : sheet === 'request' ? 'Send request' : 'Publish'}
            </Button>
          </XStack>
        }
      >
        <YStack gap="$3" padding="$2">
          <Field
            label={
              sheet === 'request'
                ? 'Optional note'
                : `What stands out about ${writeTargetName}?`
            }
          >
            <TextArea
              value={draft}
              onChangeText={setDraft}
              placeholder={
                sheet === 'request'
                  ? 'Share context about the role or skills…'
                  : 'Describe how you worked together and the impact they made…'
              }
              minHeight={120}
            />
          </Field>
          {sheet === 'write' ? (
            <Text fontSize={12} color={ui.textMuted}>
              Recommendations appear on their profile after you publish.
            </Text>
          ) : null}
        </YStack>
      </AppBottomSheet>
    </>
  )
}
