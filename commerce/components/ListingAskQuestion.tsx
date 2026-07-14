import { useState } from 'react'
import { useRouter } from 'one'

import { submitListingInquiry } from '~/commerce/lib/listing-inquiries'
import {
  AppBottomSheet,
  Button,
  Icons,
  Spinner,
  Text,
  TextArea,
  YStack,
  useAppToast,
} from '~/components/ui'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type ListingAskQuestionProps = {
  listingId: string
  shopId: string
  sellerId?: string | null
  listingTitle: string
}

/** marketplace "Ask a question" sheet that notifies the seller across channels. */
export function ListingAskQuestion({
  listingId,
  shopId,
  sellerId,
  listingTitle,
}: ListingAskQuestionProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!sellerId) return null
  if (user?.id && user.id === sellerId) return null

  async function handleSubmit() {
    if (!user?.id) {
      toast.show('Sign in to ask', {
        tone: 'default',
        message: 'Create an account or sign in to message the seller.',
      })
      router.push(appRoutes.signIn)
      return
    }
    if (!sellerId) return

    setSending(true)
    const { error } = await submitListingInquiry({
      listingId,
      shopId,
      sellerId,
      buyerId: user.id,
      message,
    })
    setSending(false)
    if (error) {
      toast.show('Could not send question', { tone: 'danger', message: error })
      return
    }
    setMessage('')
    setOpen(false)
    toast.show('Question sent', {
      tone: 'success',
      message: 'The seller will be notified by email, push, and in-app alerts.',
    })
  }

  return (
    <>
      <Button
        tone="outline"
        size="$3"
        borderRadius={999}
        icon={<Icons.MessageCircle size={15} />}
        onPress={() => {
          if (!user?.id) {
            toast.show('Sign in to ask', {
              tone: 'default',
              message: 'Create an account or sign in to message the seller.',
            })
            router.push(appRoutes.signIn)
            return
          }
          setOpen(true)
        }}
      >
        Ask a question
      </Button>

      <AppBottomSheet open={open} onOpenChange={setOpen} title="Ask the seller">
        <YStack gap="$3" paddingBottom="$4">
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            Ask about personalization, materials, shipping, or sizing for{' '}
            <Text fontWeight="600" color={ui.text}>
              {listingTitle}
            </Text>
            .
          </Text>
          <TextArea
            value={message}
            onChangeText={setMessage}
            placeholder="Hi! I wanted to know…"
            minHeight={120}
            maxLength={2000}
          />
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={sending || message.trim().length < 3}
            icon={sending ? <Spinner size="small" color="white" /> : undefined}
            onPress={() => void handleSubmit()}
          >
            {sending ? 'Sending…' : 'Send question'}
          </Button>
        </YStack>
      </AppBottomSheet>
    </>
  )
}
