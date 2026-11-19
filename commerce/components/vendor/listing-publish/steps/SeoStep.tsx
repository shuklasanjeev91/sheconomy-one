import {
  Field,
  Icons,
  Input,
  Text,
  TextArea,
  XStack,
  YStack,
} from '~/components/ui'
import { LISTING_VALIDATION } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import { generateListingSlug } from '~/lib/listing/listing.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'

type SeoStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  shopSlug: string
  isDesktop: boolean
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function SeoStep({
  ui,
  formData,
  errors,
  shopSlug,
  isDesktop,
  onUpdate,
}: SeoStepProps) {
  const slug = formData.slug?.trim() || generateListingSlug(formData.title)
  const seoTitle = formData.meta_title?.trim() || formData.title
  const seoDescription = formData.meta_description?.trim() || formData.description || ''
  const metaTitleLen = seoTitle.length
  const metaDescLen = seoDescription.length

  return (
    <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
      <YStack flex={1} minWidth={isDesktop ? 300 : '100%'} gap="$4">
        <ListingPublishCard ui={ui} title="Identity & Reach" titleAccent>
          <Field label="URL Slug" error={errors.slug}>
            <XStack alignItems="center" gap="$1" flexWrap="wrap">
              <Text fontSize={13} color={ui.textMuted} fontWeight="600">
                {shopSlug}/shop/
              </Text>
              <Input
                flex={1}
                minWidth={180}
                value={formData.slug ?? ''}
                onChangeText={(value) => onUpdate('slug', value)}
                placeholder={slug}
                invalid={!!errors.slug}
              />
            </XStack>
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Use hyphens to separate words. Keep it short and descriptive.
          </Text>
          <ListingPublishFieldError ui={ui} message={errors.slug} />

          <Field label="Search Keywords">
            <Input
              value={(formData.tags ?? []).join(', ')}
              editable={false}
              placeholder="silk, handmade, luxury lounge, sustainable fashion..."
            />
          </Field>
          <Text fontSize={11} color={ui.textMuted}>
            Tags from Basic Info are used as search keywords. Separate with commas.
          </Text>
        </ListingPublishCard>

        <ListingPublishCard ui={ui} title="Meta Description" titleAccent>
          <Field
            label="SEO Title"
            error={errors.meta_title}
            hint={`${metaTitleLen} / ${LISTING_VALIDATION.META_TITLE.MAX_LENGTH}`}
          >
            <Input
              value={formData.meta_title ?? ''}
              onChangeText={(value) => onUpdate('meta_title', value)}
              placeholder={formData.title}
              maxLength={LISTING_VALIDATION.META_TITLE.MAX_LENGTH}
              invalid={!!errors.meta_title}
            />
          </Field>
          <ListingPublishFieldError ui={ui} message={errors.meta_title} />

          <Field
            label="SEO Description"
            error={errors.meta_description}
            hint={`${metaDescLen} / ${LISTING_VALIDATION.META_DESCRIPTION.MAX_LENGTH}`}
          >
            <TextArea
              minHeight={110}
              value={formData.meta_description ?? ''}
              onChangeText={(value) => onUpdate('meta_description', value)}
              placeholder={formData.description ?? 'Write a compelling summary for search results...'}
              maxLength={LISTING_VALIDATION.META_DESCRIPTION.MAX_LENGTH}
              invalid={!!errors.meta_description}
            />
          </Field>
          <ListingPublishFieldError ui={ui} message={errors.meta_description} />
        </ListingPublishCard>

        <ListingPublishCard ui={ui} title="Google Search Preview">
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Icons.Eye size={16} color={ui.textSecondary} />
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              Preview
            </Text>
          </XStack>
          <YStack gap="$1" padding="$4" borderRadius={12} backgroundColor={ui.surfaceMuted}>
            <Text fontSize={16} color="#1a0dab" fontWeight="600">
              {seoTitle}
            </Text>
            <Text fontSize={12} color="#188038">
              https://{shopSlug}.com › shop › {slug}
            </Text>
            <Text fontSize={13} color="#4d5156" lineHeight={20}>
              {seoDescription}
            </Text>
          </YStack>
        </ListingPublishCard>
      </YStack>

    </XStack>
  )
}
