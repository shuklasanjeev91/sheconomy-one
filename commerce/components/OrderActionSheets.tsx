import { useMemo, useState } from 'react'

import {
  AppBottomSheet,
  Button,
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import {
  createCustomerOrderSupportIssue,
  cancelCustomerOrder,
  requestOrderCancellation,
} from '~/commerce/lib/customer-orders'
import { supportIssueTypeOptions } from '~/commerce/lib/customer-order-lifecycle'
import type { OrderIssueType } from '~/lib/orders/order.constants'
import { useAppUi } from '~/lib/theme/useAppUi'

type CancelSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  userId: string
  /** Instant cancel for unpaid orders; request needs vendor approval. */
  mode: 'instant' | 'request'
  onSubmitted?: () => void
}

export function CancelOrderSheet({
  open,
  onOpenChange,
  orderId,
  userId,
  mode,
  onSubmitted,
}: CancelSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isInstant = mode === 'instant'

  async function handleSubmit() {
    if (!isInstant && reason.trim().length < 10) {
      toast.show('Please add a bit more detail', {
        tone: 'danger',
        message: 'Tell us why you want to cancel (at least 10 characters).',
      })
      return
    }
    setSubmitting(true)
    if (isInstant) {
      const result = await cancelCustomerOrder(orderId)
      setSubmitting(false)
      if (result.error) {
        toast.show('Could not cancel order', { tone: 'danger', message: result.error })
        return
      }
      toast.show('Order cancelled', {
        tone: 'success',
        message: 'Reserved stock has been released. No payment was taken.',
      })
      setReason('')
      onOpenChange(false)
      onSubmitted?.()
      return
    }

    const result = await requestOrderCancellation({
      orderId,
      userId,
      reason,
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not request cancellation', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Cancellation requested', {
      tone: 'success',
      message: 'The shop will review your request shortly.',
    })
    setReason('')
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isInstant ? 'Cancel order' : 'Request cancellation'}
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting}
          onPress={() => void handleSubmit()}
        >
          {submitting
            ? isInstant
              ? 'Cancelling…'
              : 'Submitting…'
            : isInstant
              ? 'Cancel order'
              : 'Submit request'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          {isInstant
            ? 'This cancels the order immediately and releases reserved stock. No charge was taken.'
            : 'We’ll notify the shop. Orders that have already shipped usually can’t be cancelled.'}
        </Text>
        {isInstant ? null : (
          <TextArea
            value={reason}
            onChangeText={setReason}
            placeholder="Why do you want to cancel this order?"
            minHeight={120}
          />
        )}
      </YStack>
    </AppBottomSheet>
  )
}

type SupportSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderNumber: string
  userId: string
  onSubmitted?: () => void
}

export function OrderSupportSheet({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  userId,
  onSubmitted,
}: SupportSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const options = useMemo(() => supportIssueTypeOptions(), [])
  const [issueType, setIssueType] = useState<OrderIssueType>(options[0]?.value ?? 'other')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (description.trim().length < 10) {
      toast.show('Please add more detail', {
        tone: 'danger',
        message: 'Describe the issue in at least 10 characters.',
      })
      return
    }
    setSubmitting(true)
    const result = await createCustomerOrderSupportIssue({
      orderId,
      userId,
      issueType,
      description,
      subject: `Help with order ${orderNumber}`,
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not submit request', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Support request sent', {
      tone: 'success',
      message: 'The shop can see your request on this order.',
    })
    setDescription('')
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Get help with this order"
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting}
          onPress={() => void handleSubmit()}
        >
          {submitting ? 'Sending…' : 'Send request'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          Order #{orderNumber}. Choose a topic and describe what went wrong.
        </Text>
        <YStack gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            Topic
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {options.map((option) => {
              const active = option.value === issueType
              return (
                <XStack
                  key={option.value}
                  paddingHorizontal={12}
                  paddingVertical={7}
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.surfaceMuted : ui.surface}
                  cursor="pointer"
                  onPress={() => setIssueType(option.value)}
                >
                  <Text fontSize={12} fontWeight="700" color={active ? ui.brand : ui.textMuted}>
                    {option.label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </YStack>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the issue…"
          multiline
          numberOfLines={4}
          minHeight={100}
          textAlignVertical="top"
        />
      </YStack>
    </AppBottomSheet>
  )
}
