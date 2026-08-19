import { useEffect, useMemo, useState } from 'react'

import {
  cancelOrderReturnRequest,
  requestOrderItemExchange,
  requestOrderItemReturn,
  submitReturnTracking,
  submitVerifiedListingReview,
} from '~/commerce/lib/customer-order-trust'
import { returnReasonOptions } from '~/commerce/lib/customer-order-lifecycle'
import type { CustomerOrderItem } from '~/commerce/lib/customer-orders'
import {
  AppBottomSheet,
  Button,
  Icons,
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { pickImages } from '~/lib/media/pick-image'
import { uploadOrderEvidenceImages } from '~/lib/supabase/storage-upload'
import { useAppUi } from '~/lib/theme/useAppUi'

type ReturnSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  userId: string
  item: CustomerOrderItem | null
  /** e.g. "Returns until 12 Sep (5 days left)" */
  windowLabel?: string | null
  onSubmitted?: () => void
}

export function ReturnOrderItemSheet({
  open,
  onOpenChange,
  orderId,
  userId,
  item,
  windowLabel,
  onSubmitted,
}: ReturnSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const reasons = useMemo(() => returnReasonOptions(), [])
  const [reasonKey, setReasonKey] = useState(reasons[0]?.value ?? 'other')
  const [details, setDetails] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setReasonKey(reasons[0]?.value ?? 'other')
      setDetails('')
      setEvidenceUrls([])
      setUploading(false)
      setSubmitting(false)
    }
  }, [open, reasons])

  async function handlePickEvidence() {
    if (!userId || !orderId) return
    setUploading(true)
    try {
      const picked = await pickImages({
        multiple: true,
        maxCount: Math.max(1, 4 - evidenceUrls.length),
      })
      if (!picked.length) {
        setUploading(false)
        return
      }
      const files = await preparePickedImagesForUpload(picked)
      const { data, error } = await uploadOrderEvidenceImages(userId, orderId, files, 'return')
      if (error || !data) {
        toast.show('Could not upload photos', { tone: 'danger', message: error ?? undefined })
      } else {
        setEvidenceUrls((current) => [...current, ...data.map((row) => row.publicUrl)].slice(0, 4))
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!item) return
    if (details.trim().length < 10) {
      toast.show('Please add more detail', {
        tone: 'danger',
        message: 'Tell us what happened (at least 10 characters).',
      })
      return
    }
    const reasonLabel = reasons.find((row) => row.value === reasonKey)?.label ?? 'Return request'
    setSubmitting(true)
    const result = await requestOrderItemReturn({
      orderItemId: item.id,
      reason: `${reasonLabel}. ${details.trim()}`,
      detailedReason: details.trim(),
      evidenceUrls,
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not request return', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Return requested', {
      tone: 'success',
      message: 'The shop will review your request shortly.',
    })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Return item"
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting || !item}
          onPress={() => void handleSubmit()}
        >
          {submitting ? 'Submitting…' : 'Submit return request'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          {item
            ? `Request a return for “${item.product_title}”. The shop reviews returns before any refund is processed.`
            : 'Select an item to return.'}
        </Text>
        {windowLabel ? (
          <Text fontSize={12.5} fontWeight="600" color={ui.brand}>
            {windowLabel}
          </Text>
        ) : null}

        <YStack gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            Reason
          </Text>
          <YStack gap="$1">
            {reasons.map((reason) => {
              const selected = reason.value === reasonKey
              return (
                <XStack
                  key={reason.value}
                  paddingHorizontal="$3"
                  paddingVertical="$2.5"
                  borderRadius={12}
                  backgroundColor={selected ? ui.roseTint : 'transparent'}
                  cursor="pointer"
                  onPress={() => setReasonKey(reason.value)}
                  alignItems="center"
                  gap="$2"
                >
                  <Text flex={1} fontWeight={selected ? '700' : '500'} color={ui.text}>
                    {reason.label}
                  </Text>
                  {selected ? <Icons.Check size={16} color={ui.brand} /> : null}
                </XStack>
              )
            })}
          </YStack>
        </YStack>

        <TextArea
          value={details}
          onChangeText={setDetails}
          placeholder="Describe the issue and what you’d like us to do…"
          minHeight={120}
        />

        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            disabled={uploading || evidenceUrls.length >= 4}
            icon={<Icons.Camera size={14} />}
            onPress={() => void handlePickEvidence()}
          >
            {uploading ? 'Uploading…' : 'Add photos'}
          </Button>
          <Text fontSize={12} color={ui.textMuted}>
            {evidenceUrls.length}/4 photos
          </Text>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}

export function ExchangeOrderItemSheet({
  open,
  onOpenChange,
  orderId,
  userId,
  item,
  windowLabel,
  onSubmitted,
}: ReturnSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const reasons = useMemo(() => returnReasonOptions(), [])
  const [reasonKey, setReasonKey] = useState(reasons[0]?.value ?? 'other')
  const [details, setDetails] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setReasonKey(reasons[0]?.value ?? 'other')
      setDetails('')
      setEvidenceUrls([])
      setUploading(false)
      setSubmitting(false)
    }
  }, [open, reasons])

  async function handlePickEvidence() {
    if (!userId || !orderId) return
    setUploading(true)
    try {
      const picked = await pickImages({
        multiple: true,
        maxCount: Math.max(1, 4 - evidenceUrls.length),
      })
      if (!picked.length) {
        setUploading(false)
        return
      }
      const files = await preparePickedImagesForUpload(picked)
      const { data, error } = await uploadOrderEvidenceImages(userId, orderId, files, 'exchange')
      if (error || !data) {
        toast.show('Could not upload photos', { tone: 'danger', message: error ?? undefined })
      } else {
        setEvidenceUrls((current) => [...current, ...data.map((row) => row.publicUrl)].slice(0, 4))
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!item) return
    if (details.trim().length < 10) {
      toast.show('Please add more detail', {
        tone: 'danger',
        message: 'Tell us what happened (at least 10 characters).',
      })
      return
    }
    const reasonLabel = reasons.find((row) => row.value === reasonKey)?.label ?? 'Exchange request'
    setSubmitting(true)
    const result = await requestOrderItemExchange({
      orderItemId: item.id,
      reason: `${reasonLabel}. ${details.trim()}`,
      detailedReason: details.trim(),
      evidenceUrls,
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not request exchange', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Exchange requested', {
      tone: 'success',
      message: 'The shop will review your request shortly.',
    })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Exchange item"
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting || !item}
          onPress={() => void handleSubmit()}
        >
          {submitting ? 'Submitting…' : 'Submit exchange request'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          {item
            ? `Request an exchange for “${item.product_title}”. You’ll ship the item back, then the shop sends a replacement.`
            : 'Select an item to exchange.'}
        </Text>
        {windowLabel ? (
          <Text fontSize={12.5} fontWeight="600" color={ui.brand}>
            {windowLabel}
          </Text>
        ) : null}

        <YStack gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            Reason
          </Text>
          <YStack gap="$1">
            {reasons.map((reason) => {
              const selected = reason.value === reasonKey
              return (
                <XStack
                  key={reason.value}
                  paddingHorizontal="$3"
                  paddingVertical="$2.5"
                  borderRadius={12}
                  backgroundColor={selected ? ui.roseTint : 'transparent'}
                  cursor="pointer"
                  onPress={() => setReasonKey(reason.value)}
                  alignItems="center"
                  gap="$2"
                >
                  <Text flex={1} fontWeight={selected ? '700' : '500'} color={ui.text}>
                    {reason.label}
                  </Text>
                  {selected ? <Icons.Check size={16} color={ui.brand} /> : null}
                </XStack>
              )
            })}
          </YStack>
        </YStack>

        <TextArea
          value={details}
          onChangeText={setDetails}
          placeholder="Describe what you need exchanged…"
          minHeight={120}
        />

        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            disabled={uploading || evidenceUrls.length >= 4}
            icon={<Icons.Camera size={14} />}
            onPress={() => void handlePickEvidence()}
          >
            {uploading ? 'Uploading…' : 'Add photos'}
          </Button>
          <Text fontSize={12} color={ui.textMuted}>
            {evidenceUrls.length}/4 photos
          </Text>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}

type TrackingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CustomerOrderItem | null
  onSubmitted?: () => void
}

export function SubmitReturnTrackingSheet({
  open,
  onOpenChange,
  item,
  onSubmitted,
}: TrackingSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setTrackingNumber('')
      setSubmitting(false)
    }
  }, [open])

  async function handleSubmit() {
    if (!item) return
    if (trackingNumber.trim().length < 5) {
      toast.show('Enter a valid AWB', {
        tone: 'danger',
        message: 'Paste the courier tracking number from your return label.',
      })
      return
    }
    setSubmitting(true)
    const result = await submitReturnTracking({
      orderItemId: item.id,
      trackingNumber: trackingNumber.trim(),
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not save tracking', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Return tracking saved', {
      tone: 'success',
      message: 'The shop can now track your return package.',
    })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add return tracking"
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting || !item}
          onPress={() => void handleSubmit()}
        >
          {submitting ? 'Saving…' : 'Save tracking'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          {item
            ? `Ship “${item.product_title}” back to the shop, then paste the AWB here. Use this only if the shop has not arranged pickup yet.`
            : 'Select an item.'}
        </Text>
        <Input
          value={trackingNumber}
          onChangeText={setTrackingNumber}
          placeholder="Paste or type AWB / tracking number"
          autoCapitalize="characters"
        />
      </YStack>
    </AppBottomSheet>
  )
}

type CancelReturnSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CustomerOrderItem | null
  onSubmitted?: () => void
}

export function CancelReturnRequestSheet({
  open,
  onOpenChange,
  item,
  onSubmitted,
}: CancelReturnSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setSubmitting(false)
  }, [open])

  async function handleSubmit() {
    if (!item) return
    setSubmitting(true)
    const result = await cancelOrderReturnRequest({ orderItemId: item.id })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not cancel request', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Request cancelled', {
      tone: 'success',
      message: 'Your return or exchange request was cancelled.',
    })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel request"
      footer={
        <XStack gap="$2">
          <Button
            tone="outline"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting}
            onPress={() => onOpenChange(false)}
          >
            Keep request
          </Button>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting || !item}
            onPress={() => void handleSubmit()}
          >
            {submitting ? 'Cancelling…' : 'Cancel request'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          {item
            ? `Cancel the open return or exchange for “${item.product_title}”? You can only cancel before the shop assigns a return AWB or you submit tracking.`
            : 'Select an item.'}
        </Text>
      </YStack>
    </AppBottomSheet>
  )
}

type ReviewSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  userId: string
  item: CustomerOrderItem | null
  onSubmitted?: () => void
}

export function WriteReviewSheet({
  open,
  onOpenChange,
  orderId,
  userId,
  item,
  onSubmitted,
}: ReviewSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setRating(5)
      setTitle('')
      setReviewText('')
      setImageUrls([])
      setUploading(false)
      setSubmitting(false)
    }
  }, [open])

  async function handlePickImages() {
    if (!userId || !orderId) return
    setUploading(true)
    try {
      const picked = await pickImages({
        multiple: true,
        maxCount: Math.max(1, 4 - imageUrls.length),
      })
      if (!picked.length) {
        setUploading(false)
        return
      }
      const files = await preparePickedImagesForUpload(picked)
      const { data, error } = await uploadOrderEvidenceImages(userId, orderId, files, 'review')
      if (error || !data) {
        toast.show('Could not upload photos', { tone: 'danger', message: error ?? undefined })
      } else {
        setImageUrls((current) => [...current, ...data.map((row) => row.publicUrl)].slice(0, 4))
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!item) return
    if (reviewText.trim().length < 10) {
      toast.show('Please write a bit more', {
        tone: 'danger',
        message: 'Reviews need at least 10 characters.',
      })
      return
    }
    setSubmitting(true)
    const result = await submitVerifiedListingReview({
      orderItemId: item.id,
      rating,
      title,
      reviewText,
      reviewImages: imageUrls,
    })
    setSubmitting(false)
    if (result.error) {
      toast.show('Could not submit review', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Review published', {
      tone: 'success',
      message: 'Thanks — your verified purchase review is live.',
    })
    onOpenChange(false)
    onSubmitted?.()
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Write a review"
      footer={
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting || !item}
          onPress={() => void handleSubmit()}
        >
          {submitting ? 'Publishing…' : 'Publish review'}
        </Button>
      }
    >
      <YStack gap="$3" paddingBottom="$2">
        <Text fontSize={13} color={ui.textSecondary}>
          {item
            ? `Share your experience with “${item.product_title}”. Verified purchase reviews help other shoppers.`
            : 'Select an item to review.'}
        </Text>

        <YStack gap="$2">
          <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
            Rating
          </Text>
          <XStack gap="$2">
            {[1, 2, 3, 4, 5].map((value) => (
              <XStack
                key={value}
                width={40}
                height={40}
                alignItems="center"
                justifyContent="center"
                borderRadius={999}
                cursor="pointer"
                backgroundColor={value <= rating ? ui.roseTint : ui.surfaceMuted}
                onPress={() => setRating(value)}
                accessibilityRole="button"
                aria-label={`${value} stars`}
              >
                <Icons.Star
                  size={20}
                  color={value <= rating ? ui.starFill : ui.starEmpty}
                  fill={value <= rating ? ui.starFill : 'transparent'}
                />
              </XStack>
            ))}
          </XStack>
        </YStack>

        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Review title (optional)"
        />
        <TextArea
          value={reviewText}
          onChangeText={setReviewText}
          placeholder="What did you like or dislike?"
          minHeight={140}
        />

        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            disabled={uploading || imageUrls.length >= 4}
            icon={<Icons.Camera size={14} />}
            onPress={() => void handlePickImages()}
          >
            {uploading ? 'Uploading…' : 'Add photos'}
          </Button>
          <Text fontSize={12} color={ui.textMuted}>
            {imageUrls.length}/4 photos
          </Text>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}
