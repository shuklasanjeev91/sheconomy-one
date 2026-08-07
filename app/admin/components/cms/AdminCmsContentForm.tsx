import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Button,
  Field,
  Icons,
  Image,
  Input,
  Spinner,
  Switch,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  createContent,
  createTag,
  generateSlug,
  loadCategories,
  loadContentById,
  loadMedia,
  loadTags,
  publishContent,
  updateContent,
  type CmsContentDetail,
  type CmsContentStatus,
  type CmsContentType,
  type CmsMedia,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsMarkdownEditor } from './CmsMarkdownEditor'
import { CmsMediaPickerPanel } from './CmsMediaPickerPanel'
import { CmsPageShell, CmsPanel, CmsPickerSelect } from './CmsPageShell'
import {
  buildRobotsString,
  CmsSeoFields,
  parseRobotsString,
  type CmsSeoFormValues,
} from './CmsSeoFields'
import { CmsTagsInput, type CmsTagChip } from './CmsTagsInput'

type MediaPickerMode = 'cover' | 'body' | 'og' | 'twitter' | null

const TYPE_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'page', label: 'Page' },
  { value: 'product', label: 'Product' },
  { value: 'announcement', label: 'Announcement' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

type FormState = {
  title: string
  slug: string
  type: CmsContentType
  status: CmsContentStatus
  scheduled_at: string
  category_id: string
  tags: CmsTagChip[]
  is_featured: boolean
  allow_comments: boolean
  body: string
  excerpt: string
  cover_image_id: string | null
  og_image_id: string | null
  twitter_image_id: string | null
  metadataJson: string
  seo: CmsSeoFormValues
  seo_keywords: string
  focus_keyword: string
  schemaOrgJson: string
  sitemap_exclude: boolean
}

const EMPTY_SEO: CmsSeoFormValues = {
  seo_title: '',
  seo_description: '',
  canonical_url: '',
  og_title: '',
  og_description: '',
  twitter_title: '',
  twitter_description: '',
  sitemap_changefreq: 'weekly',
  sitemap_priority: '0.5',
  robots: 'index, follow',
}

function contentToForm(content: CmsContentDetail): FormState {
  const tags: CmsTagChip[] =
    content.cms_content_tag_map?.map((link) => ({
      id: link.tag_id,
      name: link.cms_tags?.name ?? link.tag_id,
    })) ?? []

  let metadataJson = '{}'
  try {
    metadataJson = JSON.stringify(content.metadata ?? {}, null, 2)
  } catch {
    metadataJson = '{}'
  }

  let schemaOrgJson = '[]'
  try {
    schemaOrgJson = JSON.stringify(content.schema_org ?? [], null, 2)
  } catch {
    schemaOrgJson = '[]'
  }

  return {
    title: content.title ?? '',
    slug: content.slug ?? '',
    type: content.type ?? 'post',
    status: content.status ?? 'draft',
    scheduled_at: content.scheduled_at
      ? new Date(content.scheduled_at).toISOString().slice(0, 16)
      : '',
    category_id: content.category_id ?? '',
    tags,
    is_featured: content.is_featured ?? false,
    allow_comments: content.allow_comments ?? true,
    body: content.body ?? '',
    excerpt: content.excerpt ?? '',
    cover_image_id: content.cover_image_id,
    og_image_id: content.og_image_id,
    twitter_image_id: content.twitter_image_id,
    metadataJson,
    seo: {
      seo_title: content.seo_title ?? '',
      seo_description: content.seo_description ?? '',
      canonical_url: content.canonical_url ?? '',
      og_title: content.og_title ?? '',
      og_description: content.og_description ?? '',
      twitter_title: content.twitter_title ?? '',
      twitter_description: content.twitter_description ?? '',
      sitemap_changefreq: content.sitemap_changefreq ?? 'weekly',
      sitemap_priority: String(content.sitemap_priority ?? 0.5),
      robots: buildRobotsString(
        content.robots_index ?? true,
        content.robots_follow ?? true,
        content.robots_extra,
      ),
    },
    seo_keywords: (content.seo_keywords ?? []).join(', '),
    focus_keyword: content.focus_keyword ?? '',
    schemaOrgJson,
    sitemap_exclude: content.sitemap_exclude ?? false,
  }
}

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  type: 'post',
  status: 'draft',
  scheduled_at: '',
  category_id: '',
  tags: [],
  is_featured: false,
  allow_comments: true,
  body: '',
  excerpt: '',
  cover_image_id: null,
  og_image_id: null,
  twitter_image_id: null,
  metadataJson: '{}',
  seo: { ...EMPTY_SEO },
  seo_keywords: '',
  focus_keyword: '',
  schemaOrgJson: '[]',
  sitemap_exclude: false,
}

export function AdminCmsContentForm({ contentId = null }: { contentId?: string | null }) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const {
    currentContent,
    categories,
    tags: availableTags,
    mediaItems,
    isFetching,
    isCreating,
    isUpdating,
    isUploading,
    contentError,
  } = useAppSelector((s) => s.cms)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [slugManual, setSlugManual] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content')
  const [mediaPicker, setMediaPicker] = useState<MediaPickerMode>(null)
  const [bodyInsert, setBodyInsert] = useState<((url: string, alt: string) => void) | null>(null)
  const [saving, setSaving] = useState(false)

  const isEdit = !!contentId
  const loading = isFetching && isEdit && !currentContent

  useEffect(() => {
    void dispatch(loadCategories())
    void dispatch(loadTags())
    void dispatch(loadMedia({ page: 1, limit: 60, media_type: 'image' }))
  }, [dispatch])

  useEffect(() => {
    if (contentId) {
      void dispatch(loadContentById(contentId))
    }
  }, [contentId, dispatch])

  useEffect(() => {
    if (currentContent && contentId && currentContent.id === contentId) {
      setForm(contentToForm(currentContent))
      setSlugManual(true)
    }
  }, [contentId, currentContent])

  const categoryOptions = useMemo(
    () => [
      { value: '_none', label: 'No category' },
      ...categories.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  )

  const coverUrl = useMemo(
    () => mediaItems.find((m) => m.id === form.cover_image_id)?.public_url ?? currentContent?.cover_media?.public_url ?? null,
    [currentContent?.cover_media?.public_url, form.cover_image_id, mediaItems],
  )

  const ogImageUrl = useMemo(
    () => mediaItems.find((m) => m.id === form.og_image_id)?.public_url ?? null,
    [form.og_image_id, mediaItems],
  )

  const twitterImageUrl = useMemo(
    () => mediaItems.find((m) => m.id === form.twitter_image_id)?.public_url ?? null,
    [form.twitter_image_id, mediaItems],
  )

  const patch = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const patchSeo = useCallback((key: keyof CmsSeoFormValues, value: string) => {
    setForm((prev) => ({ ...prev, seo: { ...prev.seo, [key]: value } }))
  }, [])

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugManual ? prev.slug : generateSlug(title),
    }))
  }

  async function resolveTagIds(): Promise<string[]> {
    const ids: string[] = []
    for (const tag of form.tags) {
      if (tag.id.startsWith('new:')) {
        const slug = tag.id.slice(4) || generateSlug(tag.name)
        const created = await dispatch(createTag({ name: tag.name, slug })).unwrap()
        ids.push(created.id)
      } else {
        ids.push(tag.id)
      }
    }
    return ids
  }

  function buildPayload(statusOverride?: CmsContentStatus) {
    let metadata: Record<string, unknown> = {}
    let schema_org: Record<string, unknown>[] = []
    try {
      metadata = JSON.parse(form.metadataJson || '{}') as Record<string, unknown>
    } catch {
      throw new Error('Metadata must be valid JSON.')
    }
    try {
      schema_org = JSON.parse(form.schemaOrgJson || '[]') as Record<string, unknown>[]
    } catch {
      throw new Error('Schema.org must be valid JSON array.')
    }

    const robots = parseRobotsString(form.seo.robots)
    const priority = Number.parseFloat(form.seo.sitemap_priority)
    const seo_keywords = form.seo_keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    return {
      title: form.title.trim(),
      slug: form.slug.trim(),
      type: form.type,
      status: statusOverride ?? form.status,
      scheduled_at: form.scheduled_at.trim()
        ? new Date(form.scheduled_at.trim()).toISOString()
        : null,
      category_id: form.category_id || null,
      is_featured: form.is_featured,
      allow_comments: form.allow_comments,
      body: form.body,
      body_format: 'markdown' as const,
      excerpt: form.excerpt.trim() || null,
      cover_image_id: form.cover_image_id,
      metadata,
      seo_title: form.seo.seo_title.trim() || null,
      seo_description: form.seo.seo_description.trim() || null,
      seo_keywords: seo_keywords.length ? seo_keywords : null,
      focus_keyword: form.focus_keyword.trim() || null,
      canonical_url: form.seo.canonical_url.trim() || null,
      og_title: form.seo.og_title.trim() || null,
      og_description: form.seo.og_description.trim() || null,
      og_image_id: form.og_image_id,
      twitter_title: form.seo.twitter_title.trim() || null,
      twitter_description: form.seo.twitter_description.trim() || null,
      twitter_image_id: form.twitter_image_id,
      robots_index: robots.robots_index,
      robots_follow: robots.robots_follow,
      robots_extra: robots.robots_extra,
      schema_org,
      sitemap_changefreq: form.seo.sitemap_changefreq || 'weekly',
      sitemap_priority: Number.isFinite(priority) ? priority : 0.5,
      sitemap_exclude: form.sitemap_exclude,
    }
  }

  async function saveDraft() {
    if (!form.title.trim()) {
      toast.show('Title is required', { tone: 'danger' })
      return
    }
    if (!form.slug.trim()) {
      toast.show('Slug is required', { tone: 'danger' })
      return
    }

    setSaving(true)
    try {
      const tag_ids = await resolveTagIds()
      const payload = { ...buildPayload(), tag_ids }

      if (isEdit && contentId) {
        await dispatch(updateContent({ id: contentId, payload })).unwrap()
        toast.show('Draft saved', { tone: 'success' })
      } else {
        const created = await dispatch(createContent(payload)).unwrap()
        toast.show('Content created', { tone: 'success' })
        router.replace(`/admin/cms/${created.id}` as Href)
      }
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Save failed', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!form.title.trim() || !form.slug.trim()) {
      toast.show('Title and slug are required', { tone: 'danger' })
      return
    }

    setSaving(true)
    try {
      const tag_ids = await resolveTagIds()
      const payload = { ...buildPayload('published'), tag_ids }

      if (isEdit && contentId) {
        await dispatch(updateContent({ id: contentId, payload })).unwrap()
        await dispatch(publishContent({ id: contentId })).unwrap()
        toast.show('Published', { tone: 'success' })
      } else {
        const created = await dispatch(createContent(payload)).unwrap()
        await dispatch(publishContent({ id: created.id })).unwrap()
        toast.show('Published', { tone: 'success' })
        router.replace(`/admin/cms/${created.id}` as Href)
      }
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Publish failed', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  function handleMediaSelect(media: CmsMedia) {
    if (mediaPicker === 'cover') {
      patch('cover_image_id', media.id)
    } else if (mediaPicker === 'og') {
      patch('og_image_id', media.id)
    } else if (mediaPicker === 'twitter') {
      patch('twitter_image_id', media.id)
    } else if (mediaPicker === 'body' && bodyInsert) {
      bodyInsert(media.public_url ?? '', media.alt_text ?? media.file_name)
      setBodyInsert(null)
    }
    setMediaPicker(null)
  }

  const busy = saving || isCreating || isUpdating

  return (
    <CmsPageShell
      title={isEdit ? 'Edit Content' : 'New Content'}
      subtitle={isEdit ? `Editing “${form.title || 'Untitled'}”` : 'Create a post, page, or announcement.'}
      actions={
        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$3"
            tone="outline"
            icon={Icons.ArrowLeft}
            onPress={() => router.push('/admin/cms' as Href)}
          >
            Back
          </Button>
          <Button size="$3" tone="outline" disabled={busy} onPress={() => void saveDraft()}>
            Save Draft
          </Button>
          <Button size="$3" icon={Icons.Globe} disabled={busy} onPress={() => void handlePublish()}>
            Publish
          </Button>
        </XStack>
      }
    >
      {loading ? (
        <CmsPanel>
          <YStack minHeight={240} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading content…</Text>
          </YStack>
        </CmsPanel>
      ) : (
        <>
          {contentError ? <Text color={ui.error}>{contentError}</Text> : null}

          <CmsPanel>
            <XStack gap="$2" flexWrap="wrap" marginBottom="$2">
              <Button
                size="$2"
                tone={activeTab === 'content' ? undefined : 'outline'}
                onPress={() => setActiveTab('content')}
              >
                Content
              </Button>
              <Button
                size="$2"
                tone={activeTab === 'seo' ? undefined : 'outline'}
                onPress={() => setActiveTab('seo')}
              >
                SEO
              </Button>
            </XStack>

            {activeTab === 'content' ? (
              <YStack gap="$3">
                <Field label="Title" required>
                  <Input value={form.title} onChangeText={handleTitleChange} placeholder="Post title" />
                </Field>

                <Field
                  label="Slug"
                  required
                  hint={slugManual ? 'Manual slug editing enabled' : 'Auto-generated from title'}
                >
                  <XStack gap="$2" flexWrap="wrap" alignItems="center">
                    <Input
                      flex={1}
                      minWidth={200}
                      value={form.slug}
                      onChangeText={(v) => patch('slug', v)}
                      editable={slugManual}
                      placeholder="my-post-slug"
                    />
                    <Button
                      size="$2"
                      tone="outline"
                      onPress={() => setSlugManual((v) => !v)}
                    >
                      {slugManual ? 'Auto' : 'Edit'}
                    </Button>
                  </XStack>
                </Field>

                <XStack gap="$3" flexWrap="wrap">
                  <Field label="Type" flex={1} minWidth={isDesktop ? 160 : '100%'}>
                    <CmsPickerSelect
                      value={form.type}
                      options={TYPE_OPTIONS}
                      placeholder="Type"
                      onValueChange={(v) => patch('type', v as CmsContentType)}
                    />
                  </Field>
                  <Field label="Status" flex={1} minWidth={isDesktop ? 160 : '100%'}>
                    <CmsPickerSelect
                      value={form.status}
                      options={STATUS_OPTIONS}
                      placeholder="Status"
                      onValueChange={(v) => patch('status', v as CmsContentStatus)}
                    />
                  </Field>
                  <Field
                    label="Scheduled at"
                    hint="Local datetime (converted on save)"
                    flex={1}
                    minWidth={isDesktop ? 220 : '100%'}
                  >
                    <Input
                      value={form.scheduled_at}
                      onChangeText={(v) => patch('scheduled_at', v)}
                      placeholder="YYYY-MM-DDTHH:mm"
                    />
                  </Field>
                </XStack>

                <Field label="Category">
                  <CmsPickerSelect
                    value={form.category_id || '_none'}
                    options={categoryOptions}
                    placeholder="Category"
                    onValueChange={(v) => patch('category_id', v === '_none' ? '' : v)}
                  />
                </Field>

                <Field label="Tags">
                  <CmsTagsInput
                    value={form.tags}
                    onChange={(tags) => patch('tags', tags)}
                    availableTags={availableTags}
                  />
                </Field>

                <XStack gap="$4" flexWrap="wrap">
                  <XStack alignItems="center" gap="$2">
                    <Switch
                      checked={form.is_featured}
                      onCheckedChange={(v) => patch('is_featured', v)}
                    />
                    <Text fontSize={14} color={ui.text}>
                      Featured
                    </Text>
                  </XStack>
                  <XStack alignItems="center" gap="$2">
                    <Switch
                      checked={form.allow_comments}
                      onCheckedChange={(v) => patch('allow_comments', v)}
                    />
                    <Text fontSize={14} color={ui.text}>
                      Allow comments
                    </Text>
                  </XStack>
                </XStack>

                <Field label="Body">
                  <CmsMarkdownEditor
                    value={form.body}
                    onChange={(v) => patch('body', v)}
                    onRequestImageInsert={(insert) => {
                      setBodyInsert(() => insert)
                      setMediaPicker('body')
                    }}
                  />
                </Field>

                <Field label="Excerpt">
                  <TextArea
                    value={form.excerpt}
                    onChangeText={(v) => patch('excerpt', v)}
                    minHeight={80}
                    placeholder="Short summary for cards and listings"
                  />
                </Field>

                <Field label="Cover image">
                  <YStack gap="$2">
                    {coverUrl ? (
                      <Image
                        source={{ uri: coverUrl }}
                        width={isDesktop ? 320 : '100%'}
                        height={180}
                        borderRadius={radius.card}
                        resizeMode="cover"
                        alt="Cover"
                      />
                    ) : (
                      <Text fontSize={13} color={ui.textMuted}>
                        No cover selected
                      </Text>
                    )}
                    <Button size="$2" tone="outline" onPress={() => setMediaPicker('cover')}>
                      Pick cover image
                    </Button>
                  </YStack>
                </Field>

                <Field label="Metadata (JSON)" hint="Custom key/value metadata stored on the content row">
                  <TextArea
                    value={form.metadataJson}
                    onChangeText={(v) => patch('metadataJson', v)}
                    minHeight={100}
                    fontFamily="$mono"
                  />
                </Field>
              </YStack>
            ) : (
              <YStack gap="$3">
                <CmsSeoFields
                  seo={form.seo}
                  onChange={patchSeo}
                  onPickOgImage={() => setMediaPicker('og')}
                  onPickTwitterImage={() => setMediaPicker('twitter')}
                  ogImageUrl={ogImageUrl}
                  twitterImageUrl={twitterImageUrl}
                />
                <Field label="Focus keyword">
                  <Input
                    value={form.focus_keyword}
                    onChangeText={(v) => patch('focus_keyword', v)}
                  />
                </Field>
                <Field label="SEO keywords" hint="Comma-separated">
                  <Input
                    value={form.seo_keywords}
                    onChangeText={(v) => patch('seo_keywords', v)}
                  />
                </Field>
                <Field label="Schema.org (JSON array)">
                  <TextArea
                    value={form.schemaOrgJson}
                    onChangeText={(v) => patch('schemaOrgJson', v)}
                    minHeight={100}
                    fontFamily="$mono"
                  />
                </Field>
                <XStack alignItems="center" gap="$2">
                  <Switch
                    checked={form.sitemap_exclude}
                    onCheckedChange={(v) => patch('sitemap_exclude', v)}
                  />
                  <Text fontSize={14} color={ui.text}>
                    Exclude from sitemap
                  </Text>
                </XStack>
              </YStack>
            )}
          </CmsPanel>

          <CmsMediaPickerPanel
            open={mediaPicker !== null}
            title={
              mediaPicker === 'cover'
                ? 'Pick cover image'
                : mediaPicker === 'og'
                  ? 'Pick OG image'
                  : mediaPicker === 'twitter'
                    ? 'Pick Twitter image'
                    : 'Insert image into body'
            }
            mediaItems={mediaItems}
            uploading={isUploading}
            onClose={() => {
              setMediaPicker(null)
              setBodyInsert(null)
            }}
            onRefresh={() => void dispatch(loadMedia({ page: 1, limit: 60, media_type: 'image' }))}
            onSelect={handleMediaSelect}
          />
        </>
      )}
    </CmsPageShell>
  )
}
