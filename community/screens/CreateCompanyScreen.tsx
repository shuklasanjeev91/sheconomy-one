import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createCompanyPage } from '~/community/lib/companies'
import { useCommunityUi } from '~/community/lib/community-theme'
import { LocationPickerField } from '~/components/geo'
import { Button, Spinner, Text, ValidatedTextField, YStack, useAppToast } from '~/components/ui'
import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import type { PickedImage } from '~/lib/media/pick-image'
import { uploadPostImages } from '~/lib/supabase/storage-upload'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { useFormValidation } from '~/hooks/useFormValidation'
import { communityRoutes } from '~/lib/routes'
import { maxLength, minLength, optionalUrl, required, slug } from '~/lib/validation'
import { useSupabase } from '~/providers/SupabaseProvider'

export function CreateCompanyScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [location, setLocation] = useState('')
  const [logo, setLogo] = useState<PickedImage[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  const form = useFormValidation(
    useMemo(
      () => ({
        name: { validators: [required('Company name is required.'), minLength(2)] },
        slug: { validators: [required('Page slug is required.'), slug()] },
        industry: { validators: [required('Industry is required.'), minLength(2)] },
        tagline: { validators: [maxLength(120)] },
        website: { validators: [optionalUrl()] },
      }),
      [],
    ),
  )

  async function handleCreate() {
    if (!user) return
    if (!form.validateAll()) return

    setIsSaving(true)

    let logoUrl = ''
    if (logo[0]) {
      const files = await preparePickedImagesForUpload(logo)
      trackUpload(1)
      const { urls, error: uploadError } = await uploadPostImages(user.id, files, {
        onProgress: trackUpload,
      })
      if (uploadError || !urls[0]) {
        setIsSaving(false)
        resetUpload()
        toast.show('Could not upload logo', {
          tone: 'danger',
          message: uploadError ?? 'Try again shortly.',
        })
        return
      }
      logoUrl = urls[0]
    }

    const { data, error } = await createCompanyPage(user.id, {
      name: form.fields.name.value.trim(),
      pageSlug: form.fields.slug.value.trim(),
      industry: form.fields.industry.value.trim(),
      size: '1-10',
      type: 'company',
      tagline: form.fields.tagline.value.trim(),
      location: location.trim(),
      website: form.fields.website.value.trim(),
      logoUrl,
    })
    setIsSaving(false)
    resetUpload()
    if (error || !data) {
      toast.show('Could not create page', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }
    router.push(communityRoutes.company(data.id))
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Create page
        </Text>
        <ValidatedTextField label="Page name" field={form.fields.name} required />
        <ValidatedTextField
          label="Page slug"
          field={form.fields.slug}
          placeholder="acme-studio"
          hint="Lowercase letters, numbers, and hyphens"
          required
        />
        <ValidatedTextField label="Industry" field={form.fields.industry} required />
        <ValidatedTextField label="Tagline" field={form.fields.tagline} />
        <LocationPickerField value={location} onChange={setLocation} label="Location" />
        <ValidatedTextField label="Website" field={form.fields.website} placeholder="https://..." />
        <ImageUploadField
          label="Logo (optional)"
          hint="Upload a square logo for your page."
          value={logo}
          onChange={setLogo}
          aspect="square"
          uploadProgress={uploadProgress}
          uploadLabel="Uploading logo…"
        />
        <Button
          backgroundColor={communityUi.brand}
          color="white"
          borderRadius={999}
          disabled={isSaving || !form.isValid}
          onPress={handleCreate}
          icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
        >
          Create page
        </Button>
      </CommunityCard>
    </CommunityShell>
  )
}