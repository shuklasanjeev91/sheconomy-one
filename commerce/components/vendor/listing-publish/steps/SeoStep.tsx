import {
  Checkbox,
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

import { ListingPublishCard, ListingPublishFieldError, ListingPublishTip } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'
import { LISTING_METADATA_KEYS, LISTING_PUBLISH_COPY } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { readMetadataBoolean } from '~/commerce/components/vendor/listing-publish/listing-publish.utils'

type SeoStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  shopSlug: string
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
}

export function SeoStep({ ui, formData, errors, shopSlug, onUpdate, onUpdateMetadata }: SeoStepProps) {
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>
  const slug = formData.slug?.trim() || generateListingSlug(formData.title)
  const seoTitle = formData.meta_title?.trim() || formData.title
  const seoDescription = formData.meta_description?.trim() || formData.description || ''
  const metaTitleLen = seoTitle.length
  const metaDescLen = seoDescription.length

  return (
    <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
      <YStack flex={1} minWidth={300} gap="$4">
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

      <YStack width={300} maxWidth="100%" gap="$4">
        <ListingPublishCard ui={ui} title="VISIBILITY SETTINGS" titleAccent>
          <VisibilityRow
            ui={ui}
            label="Index this page (Robots)"
            checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.SEO_INDEX, true)}
            onChange={(checked) => onUpdateMetadata(LISTING_METADATA_KEYS.SEO_INDEX, checked)}
          />
          <VisibilityRow
            ui={ui}
            label="Follow links on this page"
            checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.SEO_FOLLOW_LINKS, true)}
            onChange={(checked) => onUpdateMetadata(LISTING_METADATA_KEYS.SEO_FOLLOW_LINKS, checked)}
          />
          <VisibilityRow
            ui={ui}
            label="Exclude from site search"
            checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.SEO_EXCLUDE_SITE_SEARCH, false)}
            onChange={(checked) =>
              onUpdateMetadata(LISTING_METADATA_KEYS.SEO_EXCLUDE_SITE_SEARCH, checked)
            }
          />
          <VisibilityRow
            ui={ui}
            label="Enable Rich Snippets (Schema)"
            checked={readMetadataBoolean(meta, LISTING_METADATA_KEYS.SEO_RICH_SNIPPETS, true)}
            onChange={(checked) => onUpdateMetadata(LISTING_METADATA_KEYS.SEO_RICH_SNIPPETS, checked)}
          />
        </ListingPublishCard>

        <ListingPublishCard ui={ui} title="SEO Best Practices">
          <YStack gap="$2">
            {LISTING_PUBLISH_COPY.SEO_BEST_PRACTICES.map((tip) => (
              <XStack key={tip} gap="$2" alignItems="flex-start">
                <Icons.Check size={14} color={ui.brand} marginTop={2} />
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18} flex={1}>
                  {tip}
                </Text>
              </XStack>
            ))}
          </YStack>
        </ListingPublishCard>
      </YStack>
    </XStack>
  )
}

function VisibilityRow({
  ui,
  label,
  checked,
  onChange,
}: {
  ui: AppUiTokens
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$1">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(!!value)} />
      <Text fontSize={13} fontWeight="600" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}
