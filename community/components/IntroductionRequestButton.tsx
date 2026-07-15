import { useEffect, useState } from 'react'
import { useRouter } from 'one'

import {
  fetchMutualIntroducers,
  requestIntroduction,
  type MutualIntroducer,
} from '~/community/lib/introductions'
import {
  AppBottomSheet,
  Avatar,
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type IntroductionRequestButtonProps = {
  targetUserId: string
  targetUsername?: string | null
  targetDisplayName: string
}

/** Ask a mutual connection to introduce you (professional). */
export function IntroductionRequestButton({
  targetUserId,
  targetUsername,
  targetDisplayName,
}: IntroductionRequestButtonProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [introducers, setIntroducers] = useState<MutualIntroducer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const signInRedirect = targetUsername
    ? routes.userProfile(targetUsername)
    : routes.profile

  useEffect(() => {
    if (!open || !user?.id) return
    let active = true
    setLoading(true)
    void fetchMutualIntroducers(user.id, targetUserId).then((rows) => {
      if (!active) return
      setIntroducers(rows)
      setSelectedId(rows[0]?.user_id ?? null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [open, targetUserId, user?.id])

  if (user?.id === targetUserId) return null

  return (
    <>
      <Button
        size="$3"
        tone="outline"
        borderRadius={999}
        onPress={() => {
          if (!user?.id) {
            router.push(buildSignInUrl(signInRedirect) as never)
            return
          }
          setOpen(true)
        }}
      >
        Get intro
      </Button>

      <AppBottomSheet open={open} onOpenChange={setOpen} title="Ask for an introduction">
        <YStack gap="$3" paddingBottom="$4">
          <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
            Ask a mutual connection to introduce you to {targetDisplayName}.
          </Text>

          {loading ? (
            <YStack alignItems="center" paddingVertical="$6">
              <Spinner size="large" />
            </YStack>
          ) : introducers.length === 0 ? (
            <Text fontSize={14} color={ui.textMuted}>
              No mutual connections yet. Connect with more people to unlock intros.
            </Text>
          ) : (
            <>
              <YStack gap="$2">
                {introducers.map((person) => {
                  const selected = selectedId === person.user_id
                  return (
                    <XStack
                      key={person.user_id}
                      gap="$3"
                      alignItems="center"
                      padding="$3"
                      borderRadius={12}
                      borderWidth={1}
                      borderColor={selected ? ui.brand : ui.border}
                      backgroundColor={selected ? ui.surfaceMuted : ui.surface}
                      cursor="pointer"
                      onPress={() => setSelectedId(person.user_id)}
                    >
                      <Avatar
                        name={person.full_name}
                        src={person.avatar_url ?? undefined}
                        size="$4"
                      />
                      <YStack flex={1} minWidth={0} gap={2}>
                        <Text fontWeight="700" color={ui.text} numberOfLines={1}>
                          {person.full_name}
                        </Text>
                        {person.headline ? (
                          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                            {person.headline}
                          </Text>
                        ) : null}
                      </YStack>
                      {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
                    </XStack>
                  )
                })}
              </YStack>

              <Input
                value={message}
                onChangeText={setMessage}
                placeholder="Optional note for your introducer"
              />

              <Button
                tone="primary"
                borderRadius={999}
                disabled={!selectedId || sending}
                onPress={() => {
                  if (!selectedId) return
                  setSending(true)
                  void requestIntroduction(selectedId, targetUserId, message).then((result) => {
                    setSending(false)
                    if (result.error) {
                      toast.show('Could not send intro request', {
                        tone: 'danger',
                        message: result.error,
                      })
                      return
                    }
                    toast.show('Introduction requested', {
                      tone: 'success',
                      message: 'Your contact will be notified by in-app, email, and push.',
                    })
                    setOpen(false)
                    setMessage('')
                  })
                }}
              >
                {sending ? 'Sending…' : 'Send intro request'}
              </Button>
            </>
          )}
        </YStack>
      </AppBottomSheet>
    </>
  )
}
