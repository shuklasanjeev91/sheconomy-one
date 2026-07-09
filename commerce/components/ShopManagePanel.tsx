import { Button, Field, Input, Paragraph, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopManagePanelProps = {
  isEditing: boolean
  isSaving: boolean
  shopName: string
  shopDescription: string
  onShopNameChange: (value: string) => void
  onShopDescriptionChange: (value: string) => void
  onToggleEdit: () => void
  onSave: () => void
}

export function ShopManagePanel({
  isEditing,
  isSaving,
  shopName,
  shopDescription,
  onShopNameChange,
  onShopDescriptionChange,
  onToggleEdit,
  onSave,
}: ShopManagePanelProps) {
  const ui = useAppUi()

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.panelBorder}
      backgroundColor={ui.panelBg}
      style={{ boxShadow: ui.shadowSoft }}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <YStack gap={2}>
          <Text fontWeight="600" fontSize={15} color={ui.text}>
            Manage shop
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            Update your storefront details
          </Text>
        </YStack>
        <Button tone="outline" size="$3" borderRadius={999} onPress={onToggleEdit}>
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </XStack>

      {isEditing ? (
        <YStack gap="$3">
          <Field label="Shop name">
            <Input value={shopName} onChangeText={onShopNameChange} />
          </Field>
          <Field label="Description">
            <Input value={shopDescription} onChangeText={onShopDescriptionChange} />
          </Field>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={isSaving}
            onPress={onSave}
            icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </YStack>
      ) : (
        <Paragraph color={ui.textSecondary} fontSize={13} lineHeight={20}>
          You own this shop. Keep your name, description, and listings up to date for buyers.
        </Paragraph>
      )}
    </YStack>
  )
}