import { Button, Field, Image, Input, Text, TextArea, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { CMS_SITEMAP_CHANGEFREQS } from '~/lib/cms'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsPickerSelect } from './CmsPageShell'

export type CmsSeoFormValues = {
  seo_title: string
  seo_description: string
  canonical_url: string
  og_title: string
  og_description: string
  twitter_title: string
  twitter_description: string
  sitemap_changefreq: string
  sitemap_priority: string
  robots: string
}

export type CmsSeoFieldKey = keyof CmsSeoFormValues

const CHANGEFREQ_OPTIONS = CMS_SITEMAP_CHANGEFREQS.map((v) => ({ value: v, label: v }))

export function CmsSeoFields({
  seo,
  onChange,
  onPickOgImage,
  onPickTwitterImage,
  ogImageUrl,
  twitterImageUrl,
}: {
  seo: CmsSeoFormValues
  onChange: (key: CmsSeoFieldKey, value: string) => void
  onPickOgImage: () => void
  onPickTwitterImage: () => void
  ogImageUrl?: string | null
  twitterImageUrl?: string | null
}) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack gap="$3">
      <Text fontSize={14} fontWeight="700" color={ui.text}>
        Search & social
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="SEO title" flex={1} minWidth={isDesktop ? 280 : '100%'}>
          <Input value={seo.seo_title} onChangeText={(v) => onChange('seo_title', v)} />
        </Field>
        <Field label="Canonical URL" flex={1} minWidth={isDesktop ? 280 : '100%'}>
          <Input
            value={seo.canonical_url}
            onChangeText={(v) => onChange('canonical_url', v)}
            placeholder="https://…"
          />
        </Field>
      </XStack>
      <Field label="SEO description">
        <TextArea
          value={seo.seo_description}
          onChangeText={(v) => onChange('seo_description', v)}
          minHeight={80}
        />
      </Field>

      <XStack gap="$3" flexWrap="wrap">
        <Field label="OG title" flex={1} minWidth={isDesktop ? 240 : '100%'}>
          <Input value={seo.og_title} onChangeText={(v) => onChange('og_title', v)} />
        </Field>
        <Field label="Twitter title" flex={1} minWidth={isDesktop ? 240 : '100%'}>
          <Input value={seo.twitter_title} onChangeText={(v) => onChange('twitter_title', v)} />
        </Field>
      </XStack>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="OG description" flex={1} minWidth={isDesktop ? 240 : '100%'}>
          <TextArea
            value={seo.og_description}
            onChangeText={(v) => onChange('og_description', v)}
            minHeight={72}
          />
        </Field>
        <Field label="Twitter description" flex={1} minWidth={isDesktop ? 240 : '100%'}>
          <TextArea
            value={seo.twitter_description}
            onChangeText={(v) => onChange('twitter_description', v)}
            minHeight={72}
          />
        </Field>
      </XStack>

      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
        <YStack gap="$2" flex={1} minWidth={isDesktop ? 220 : '100%'}>
          <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
            OG image
          </Text>
          {ogImageUrl ? (
            <Image
              source={{ uri: ogImageUrl }}
              width={160}
              height={90}
              borderRadius={radius.card}
              resizeMode="cover"
              alt="OG preview"
            />
          ) : (
            <Text fontSize={12} color={ui.textMuted}>
              No image selected
            </Text>
          )}
          <Button size="$2" tone="outline" onPress={onPickOgImage}>
            Pick OG image
          </Button>
        </YStack>
        <YStack gap="$2" flex={1} minWidth={isDesktop ? 220 : '100%'}>
          <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
            Twitter image
          </Text>
          {twitterImageUrl ? (
            <Image
              source={{ uri: twitterImageUrl }}
              width={160}
              height={90}
              borderRadius={radius.card}
              resizeMode="cover"
              alt="Twitter preview"
            />
          ) : (
            <Text fontSize={12} color={ui.textMuted}>
              No image selected
            </Text>
          )}
          <Button size="$2" tone="outline" onPress={onPickTwitterImage}>
            Pick Twitter image
          </Button>
        </YStack>
      </XStack>

      <Text fontSize={14} fontWeight="700" color={ui.text} paddingTop="$2">
        Sitemap & robots
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Sitemap changefreq" flex={1} minWidth={isDesktop ? 200 : '100%'}>
          <CmsPickerSelect
            value={seo.sitemap_changefreq || 'weekly'}
            options={CHANGEFREQ_OPTIONS}
            placeholder="Changefreq"
            onValueChange={(v) => onChange('sitemap_changefreq', v)}
          />
        </Field>
        <Field label="Sitemap priority (0–1)" flex={1} minWidth={isDesktop ? 160 : '100%'}>
          <Input
            value={seo.sitemap_priority}
            onChangeText={(v) => onChange('sitemap_priority', v)}
            keyboardType="decimal-pad"
            placeholder="0.5"
          />
        </Field>
        <Field label="Robots" flex={1} minWidth={isDesktop ? 240 : '100%'} hint="e.g. index, follow">
          <Input
            value={seo.robots}
            onChangeText={(v) => onChange('robots', v)}
            placeholder="index, follow"
          />
        </Field>
      </XStack>
    </YStack>
  )
}

export function parseRobotsString(robots: string): {
  robots_index: boolean
  robots_follow: boolean
  robots_extra: string | null
} {
  const parts = robots
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  let robots_index = true
  let robots_follow = true
  const extra: string[] = []
  for (const part of parts) {
    if (part === 'index') robots_index = true
    else if (part === 'noindex') robots_index = false
    else if (part === 'follow') robots_follow = true
    else if (part === 'nofollow') robots_follow = false
    else extra.push(part)
  }
  return {
    robots_index,
    robots_follow,
    robots_extra: extra.length ? extra.join(', ') : null,
  }
}

export function buildRobotsString(
  index: boolean,
  follow: boolean,
  extra: string | null | undefined,
): string {
  const parts = [index ? 'index' : 'noindex', follow ? 'follow' : 'nofollow']
  if (extra?.trim()) parts.push(extra.trim())
  return parts.join(', ')
}
