import { Link, useParams, useRouter } from 'one'
import { useEffect, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { applyToJob, fetchJob, saveJob, unsaveJob, type JobListing } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Spinner, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import { ShareButton } from '~/components/share'
import { routes } from '~/lib/routes'
import { getJobShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'

export function JobDetailScreen() {
  const communityUi = useCommunityUi()
  const { id } = useParams<{ id: string }>()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [job, setJob] = useState<JobListing | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    fetchJob(id, user?.id).then(({ data }) => {
      setJob(data)
      setIsLoading(false)
    })
  }, [id, user?.id])

  async function handleApply() {
    if (!user || !job) return
    setIsSaving(true)
    const result = await applyToJob(job.id, user.id, { coverLetter })
    setIsSaving(false)
    if (result.error) toast.show('Apply failed', { tone: 'danger', message: result.error })
    else {
      setJob({ ...job, is_applied: true })
      toast.show('Applied', { tone: 'success' })
    }
  }

  async function toggleSave() {
    if (!user || !job) return
    setIsSaving(true)
    const result = job.is_saved ? await unsaveJob(job.id, user.id) : await saveJob(job.id, user.id)
    setIsSaving(false)
    if (!result.error) setJob({ ...job, is_saved: !job.is_saved })
  }

  if (isLoading) {
    return (
      <CommunityShell wide>
        <YStack alignItems="center" paddingVertical="$10">
          <Spinner size="large" color={communityUi.brand} />
        </YStack>
      </CommunityShell>
    )
  }

  if (!job) {
    return (
      <CommunityShell wide>
        <CommunityCard padding={24}>
          <Text color={communityUi.textMuted}>Job not found.</Text>
        </CommunityCard>
      </CommunityShell>
    )
  }

  return (
    <CommunityShell wide>
      <CommunityCard padding={16} gap={12}>
        <Text fontSize={24} fontWeight="700" color={communityUi.text}>
          {job.title}
        </Text>
        <Text fontSize={16} color={communityUi.textMuted}>
          {job.company_name}
        </Text>
        <Text fontSize={14} color={communityUi.textMuted}>
          {job.location} · {job.job_type} · {job.experience_level}
          {job.is_remote ? ' · Remote' : ''}
        </Text>
        {job.salary_range ? (
          <Text fontSize={14} color={communityUi.text}>
            {job.salary_range}
          </Text>
        ) : null}
        <XStack gap={8} alignItems="center">
          <Avatar name={job.poster_name} src={job.poster_avatar || undefined} size="$3" />
          <Text fontSize={13} color={communityUi.textMuted}>
            Posted by {job.poster_name}
          </Text>
        </XStack>
        <XStack gap={8} flexWrap="wrap">
          <ShareButton
            variant="outline"
            label="Share"
            sheetTitle="Share job"
            copyLabel="Copy job link"
            copyToastMessage="Job link copied to clipboard."
            payload={{
              url: getJobShareUrl(job.id),
              title: job.title,
              text: `${job.company_name} · ${job.location}`,
            }}
          />
          {user ? (
            <>
              <Button
                backgroundColor={job.is_applied ? communityUi.divider : communityUi.brand}
                color={job.is_applied ? communityUi.textMuted : 'white'}
                borderRadius={999}
                disabled={job.is_applied || isSaving}
                onPress={handleApply}
              >
                {job.is_applied ? 'Applied' : 'Easy Apply'}
              </Button>
              <Button tone="outline" borderRadius={999} disabled={isSaving} onPress={toggleSave}>
                {job.is_saved ? 'Saved' : 'Save job'}
              </Button>
            </>
          ) : (
            <Button backgroundColor={communityUi.brand} color="white" borderRadius={999} onPress={() => router.push(routes.signIn)}>
              Sign in to apply
            </Button>
          )}
        </XStack>
      </CommunityCard>

      <CommunityCard padding={16} gap={12}>
        <Text fontWeight="600" color={communityUi.text}>
          About the role
        </Text>
        <Text fontSize={15} lineHeight={22} color={communityUi.text}>
          {job.description}
        </Text>
        {job.requirements ? (
          <>
            <Text fontWeight="600" color={communityUi.text}>
              Requirements
            </Text>
            <Text fontSize={15} lineHeight={22} color={communityUi.text}>
              {job.requirements}
            </Text>
          </>
        ) : null}
        {user && !job.is_applied ? (
          <YStack gap={8}>
            <Text fontWeight="600" color={communityUi.text}>
              Cover letter (optional)
            </Text>
            <TextArea value={coverLetter} onChangeText={setCoverLetter} minHeight={100} />
          </YStack>
        ) : null}
      </CommunityCard>
    </CommunityShell>
  )
}