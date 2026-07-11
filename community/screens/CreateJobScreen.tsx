import { useRouter } from 'one'
import { useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { createJob } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import { LocationPickerField } from '~/components/geo'
import {
  Button,
  Spinner,
  Text,
  ValidatedTextArea,
  ValidatedTextField,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useFormValidation } from '~/hooks/useFormValidation'
import { communityRoutes, routes } from '~/lib/routes'
import { maxLength, minLength, required } from '~/lib/validation'
import { useSupabase } from '~/providers/SupabaseProvider'

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'] as const
const EXPERIENCE_LEVELS = ['Entry level', 'Associate', 'Mid-Senior', 'Director', 'Executive'] as const

export function CreateJobScreen() {
  const communityUi = useCommunityUi()
  const router = useRouter()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>('Full-time')
  const [experienceLevel, setExperienceLevel] =
    useState<(typeof EXPERIENCE_LEVELS)[number]>('Mid-Senior')
  const [isRemote, setIsRemote] = useState(false)
  const [location, setLocation] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const form = useFormValidation(
    useMemo(
      () => ({
        title: { validators: [required('Job title is required.'), minLength(3)] },
        companyName: { validators: [required('Company name is required.'), minLength(2)] },
        description: { validators: [required('Description is required.'), minLength(20)] },
        salaryRange: { validators: [maxLength(80)] },
        requirements: { validators: [maxLength(4000)] },
        benefits: { validators: [maxLength(2000)] },
        industry: { validators: [maxLength(80)] },
      }),
      [],
    ),
  )

  if (!user) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24} gap={12}>
          <Text fontSize={18} fontWeight="600" color={communityUi.text}>
            Sign in to post a job
          </Text>
          <Button
            backgroundColor={communityUi.brand}
            color="white"
            borderRadius={999}
            onPress={() => router.push(routes.signIn)}
          >
            Sign in
          </Button>
        </CommunityCard>
      </CommunityShell>
    )
  }

  async function handleCreate() {
    if (!form.validateAll()) return

    if (!isRemote && !location.trim()) {
      toast.show('Location required', {
        tone: 'danger',
        message: 'Select where this role is based, or mark it as remote.',
      })
      return
    }

    setIsSaving(true)
    const { data, error } = await createJob(user.id, {
      title: form.fields.title.value.trim(),
      companyName: form.fields.companyName.value.trim(),
      description: form.fields.description.value.trim(),
      location,
      jobType,
      experienceLevel,
      salaryRange: form.fields.salaryRange.value.trim(),
      isRemote,
      requirements: form.fields.requirements.value.trim(),
      benefits: form.fields.benefits.value.trim(),
      industry: form.fields.industry.value.trim(),
    })
    setIsSaving(false)

    if (error || !data) {
      toast.show('Could not post job', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }

    toast.show('Job posted', { tone: 'success' })
    router.replace(communityRoutes.job(data.id))
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={16}>
        <Text fontSize={22} fontWeight="700" color={communityUi.text}>
          Post a job
        </Text>
        <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
          Reach women in the network with structured location data for better discovery.
        </Text>

        <ValidatedTextField label="Job title" field={form.fields.title} required />
        <ValidatedTextField label="Company" field={form.fields.companyName} required />
        <ValidatedTextField label="Industry (optional)" field={form.fields.industry} />

        <YStack gap={8}>
          <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
            Job type
          </Text>
          <XStack gap={8} flexWrap="wrap">
            {JOB_TYPES.map((type) => (
              <Button
                key={type}
                size="$3"
                backgroundColor={jobType === type ? communityUi.brand : communityUi.divider}
                color={jobType === type ? 'white' : communityUi.textMuted}
                borderRadius={999}
                onPress={() => setJobType(type)}
              >
                {type}
              </Button>
            ))}
          </XStack>
        </YStack>

        <YStack gap={8}>
          <Text fontSize={13} fontWeight="600" color={communityUi.textMuted}>
            Experience level
          </Text>
          <XStack gap={8} flexWrap="wrap">
            {EXPERIENCE_LEVELS.map((level) => (
              <Button
                key={level}
                size="$3"
                backgroundColor={experienceLevel === level ? communityUi.brand : communityUi.divider}
                color={experienceLevel === level ? 'white' : communityUi.textMuted}
                borderRadius={999}
                onPress={() => setExperienceLevel(level)}
              >
                {level}
              </Button>
            ))}
          </XStack>
        </YStack>

        <XStack gap={8}>
          <Button
            size="$3"
            backgroundColor={!isRemote ? communityUi.brand : communityUi.divider}
            color={!isRemote ? 'white' : communityUi.textMuted}
            borderRadius={999}
            onPress={() => setIsRemote(false)}
          >
            On-site / hybrid
          </Button>
          <Button
            size="$3"
            backgroundColor={isRemote ? communityUi.brand : communityUi.divider}
            color={isRemote ? 'white' : communityUi.textMuted}
            borderRadius={999}
            onPress={() => setIsRemote(true)}
          >
            Remote
          </Button>
        </XStack>

        {!isRemote ? (
          <LocationPickerField
            value={location}
            onChange={setLocation}
            label="Job location"
            showPostal={false}
          />
        ) : null}

        <ValidatedTextField label="Salary range (optional)" field={form.fields.salaryRange} placeholder="e.g. ₹8–12 LPA" />

        <ValidatedTextArea
          label="Description"
          field={form.fields.description}
          minHeight={140}
          placeholder="Role overview, responsibilities, and team context"
          required
        />

        <ValidatedTextArea label="Requirements (optional)" field={form.fields.requirements} minHeight={100} />

        <ValidatedTextArea label="Benefits (optional)" field={form.fields.benefits} minHeight={80} />

        <Button
          backgroundColor={communityUi.brand}
          color="white"
          borderRadius={999}
          disabled={isSaving || !form.isValid}
          onPress={handleCreate}
          icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
        >
          {isSaving ? 'Posting…' : 'Post job'}
        </Button>
      </CommunityCard>
    </CommunityShell>
  )
}
