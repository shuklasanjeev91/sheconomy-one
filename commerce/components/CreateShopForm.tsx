import { useMemo, useState } from 'react'
import { useRouter } from 'one'

import { createSellerShop } from '~/commerce/lib/shops'
import {
  Button,
  Icons,
  Spinner,
  Text,
  ValidatedTextArea,
  ValidatedTextField,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useFormValidation } from '~/hooks/useFormValidation'
import { commerceRoutes } from '~/lib/routes'
import { minLength, required } from '~/lib/validation'

import { BRAND_NAME } from '~/config/brand'

type CreateShopFormProps = {
  onCreated?: () => void
  onCancel?: () => void
}

export function CreateShopForm({ onCreated, onCancel }: CreateShopFormProps) {
  const router = useRouter()
  const toast = useAppToast()
  const [isSaving, setIsSaving] = useState(false)

  const form = useFormValidation(
    useMemo(
      () => ({
        shopName: {
          validators: [required('Shop name is required.'), minLength(2, 'Shop name is too short.')],
        },
        shopDescription: {
          validators: [
            (value: string) =>
              !value.trim() || value.trim().length >= 10
                ? null
                : 'Add a short description (at least 10 characters).',
          ],
        },
      }),
      [],
    ),
  )

  async function handleCreate() {
    if (!form.validateAll()) return

    setIsSaving(true)
    const { shopId, error } = await createSellerShop({
      shopName: form.fields.shopName.value,
      shopDescription: form.fields.shopDescription.value,
    })
    setIsSaving(false)

    if (error || !shopId) {
      toast.show('Could not create shop', { tone: 'danger', message: error ?? 'Try again shortly.' })
      return
    }

    toast.show('Shop created', { tone: 'success', message: 'Your storefront is ready.' })
    onCreated?.()
    router.push(commerceRoutes.manageShop(shopId))
  }

  return (
    <YStack gap="$4">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="700">
          Open your shop
        </Text>
        <Text fontSize={14} color="$color10" lineHeight={20}>
          Set up your storefront on {BRAND_NAME} in a few steps. You can add listings after creation.
        </Text>
      </YStack>

      <ValidatedTextField
        label="Shop name"
        field={form.fields.shopName}
        placeholder="e.g. Priya`s Pottery"
        required
      />
      <ValidatedTextArea
        label="Description"
        field={form.fields.shopDescription}
        placeholder="Tell buyers what makes your shop special…"
        minHeight={100}
        hint="Optional — helps buyers discover your shop"
      />

      <YStack gap="$2">
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={isSaving || !form.isValid}
          onPress={handleCreate}
          icon={isSaving ? <Spinner size="small" color="white" /> : <Icons.Store size={18} color="white" />}
        >
          {isSaving ? 'Creating shop…' : 'Create shop'}
        </Button>
        {onCancel ? (
          <Button tone="ghost" size="$3" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
      </YStack>
    </YStack>
  )
}