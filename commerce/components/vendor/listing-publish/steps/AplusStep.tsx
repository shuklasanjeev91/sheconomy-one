import { Button, Field, Input, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import { APLUS_MODULE_TYPES, type AplusModuleType, type ListingAplusModuleDraft } from '~/lib/listing/product-catalog'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'

type AplusStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
}

export function AplusStep({ ui, formData, onUpdate }: AplusStepProps) {
  const toast = useAppToast()
  const modules = formData.aplus_modules ?? []

  function commit(next: ListingAplusModuleDraft[]) {
    onUpdate(
      'aplus_modules',
      next.map((module, index) => ({ ...module, display_order: index })),
    )
  }

  function add(type: AplusModuleType) {
    commit([
      ...modules,
      { module_type: type, display_order: modules.length, headline: '', body: '', payload: {} },
    ])
  }

  function patch(index: number, patchValue: Partial<ListingAplusModuleDraft>) {
    commit(modules.map((module, i) => (i === index ? { ...module, ...patchValue } : module)))
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= modules.length) return
    const next = [...modules]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row!)
    commit(next)
  }

  async function pickImage(index: number) {
    try {
      const picked = await pickImagesWithCrop({ maxCount: 1, aspect: [16, 9] })
      const file = picked[0]
      if (!file) return
      const blob = file.file ?? (await (await fetch(file.uri)).blob())
      patch(index, {
        blob,
        mimeType: file.mimeType,
        image_url: file.uri,
      })
    } catch (error) {
      toast.show('Could not add the image', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try another photo.',
      })
    }
  }

  return (
    <YStack gap="$4" width="100%">
      <ListingPublishCard ui={ui} title="Add a little more of the story">
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          Optional. These blocks sit under the description on the product page. Leave this empty if
          you want to publish with the photos and description you already added.
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {APLUS_MODULE_TYPES.map((type) => (
            <Button key={type.value} tone="outline" size="$2" onPress={() => add(type.value)}>
              Add {type.label.toLowerCase()}
            </Button>
          ))}
        </XStack>
      </ListingPublishCard>

      {modules.map((module, index) => (
        <ListingPublishCard
          key={`${module.module_type}-${index}`}
          ui={ui}
          title={APLUS_MODULE_TYPES.find((type) => type.value === module.module_type)?.label ?? 'Module'}
          headerRight={
            <XStack gap="$2">
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={() => move(index, -1)}>
                Up
              </Text>
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer" onPress={() => move(index, 1)}>
                Down
              </Text>
              <Text
                fontSize={12}
                fontWeight="700"
                color={ui.error}
                cursor="pointer"
                onPress={() => commit(modules.filter((_, i) => i !== index))}
              >
                Remove
              </Text>
            </XStack>
          }
        >
          <Field label="Headline">
            <Input
              value={module.headline ?? ''}
              onChangeText={(value) => patch(index, { headline: value })}
              placeholder="Short headline"
            />
          </Field>
          <Field label="Body">
            <TextArea
              minHeight={88}
              value={module.body ?? ''}
              onChangeText={(value) => patch(index, { body: value })}
              placeholder="Tell shoppers what makes this product useful."
            />
          </Field>
          {module.module_type !== 'text' ? (
            <YStack gap="$2">
              <Button tone="outline" size="$3" onPress={() => void pickImage(index)}>
                {module.image_url || module.blob ? 'Replace image' : 'Add image'}
              </Button>
              {module.module_type === 'comparison' ? (
                <Field label="Comparison rows">
                  <TextArea
                    minHeight={72}
                    value={typeof module.payload?.rows === 'string' ? module.payload.rows : ''}
                    onChangeText={(value) => patch(index, { payload: { ...(module.payload ?? {}), rows: value } })}
                    placeholder={'One row per line, e.g.\nFabric | Cotton | Polyester'}
                  />
                </Field>
              ) : null}
            </YStack>
          ) : null}
        </ListingPublishCard>
      ))}
    </YStack>
  )
}
