import { useParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useEffect, useMemo, useState } from 'react'

import { CommunityCard } from '~/community/components/CommunityCard'
import { CommunityShell } from '~/community/components/CommunityShell'
import { ProfileLink } from '~/community/components/ProfileLink'
import { applyToJob, fetchJob, fetchJobApplicants, saveJob, unsaveJob, type JobApplicant, type JobListing } from '~/community/lib/jobs'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Button, Spinner, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import { ShareButton } from '~/components/share'
import { routes } from '~/lib/routes'
import { getJobShareUrl } from '~/lib/share'
import { useSupabase } from '~/providers/SupabaseProvider'
import { usePageSeo } from '~/components/seo/RouteSeo'

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
  const [applicants, setApplicants] = useState<JobApplicant[]>([])
  const isOwner = !!user && !!job && job.posted_by === user.id

  usePageSeo(
    useMemo(() => {
      if (!job) return null
      return {
        title: `${job.title} at ${job.company_name}`,
        description:
          job.description?.replace(/\s+/g, ' ').trim().slice(0, 200) ||
          `${job.title} — ${job.location}${job.is_remote ? ' (Remote)' : ''}. Apply on SHEconomy.`,
        image: job.company_logo,
      }
    }, [job]),
  )

  useEffect(() => {
    if (!id) return
    setIsLoading(true)
    fetchJob(id, user?.id).then(({ data }) => {
      setJob(data)
      setIsLoading(false)
    })
  }, [id, user?.id])

  useEffect(() => {
    if (!job || !user || job.posted_by !== user.id) {
      setApplicants([])
      return
    }
    void fetchJobApplicants(job.id).then((result) => {
      setApplicants(result.items)
    })
  }, [job, user])

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
          <ProfileLink userId={job.posted_by}>
            <Avatar name={job.poster_name} src={job.poster_avatar || undefined} size="$3" cursor="pointer" />
          </ProfileLink>
          <XStack gap={4} alignItems="center" flexWrap="wrap">
            <Text fontSize={13} color={communityUi.textMuted}>
              Posted by
            </Text>
            <ProfileLink userId={job.posted_by}>
              <Text
                fontSize={13}
                color={communityUi.textMuted}
                fontWeight="600"
                cursor="pointer"
                hoverStyle={{ color: communityUi.brand, textDecorationLine: 'underline' }}
              >
                {job.poster_name}
              </Text>
            </ProfileLink>
          </XStack>
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

      {isOwner ? (
        <CommunityCard padding={16} gap={12}>
          <Text fontWeight="700" color={communityUi.text}>
            Applicants ({applicants.length})
          </Text>
          {applicants.length === 0 ? (
            <Text fontSize={14} color={communityUi.textMuted}>
              No applications yet.
            </Text>
          ) : (
            applicants.map((applicant) => (
              <YStack key={applicant.id} gap={4} paddingVertical={8} borderTopWidth={1} borderTopColor={communityUi.divider}>
                <ProfileLink userId={applicant.user_id}>
                  <XStack gap={8} alignItems="center" cursor="pointer">
                    <Avatar name={applicant.full_name} src={applicant.avatar_url || undefined} size="$3" />
                    <YStack flex={1} minWidth={0}>
                      <Text fontWeight="600" color={communityUi.text}>
                        {applicant.full_name}
                      </Text>
                      <Text fontSize={12} color={communityUi.textMuted}>
                        {applicant.status}
                        {applicant.headline ? ` · ${applicant.headline}` : ''}
                      </Text>
                    </YStack>
                  </XStack>
                </ProfileLink>
                {applicant.cover_letter ? (
                  <Text fontSize={13} color={communityUi.textMuted} numberOfLines={3}>
                    {applicant.cover_letter}
                  </Text>
                ) : null}
              </YStack>
            ))
          )}
        </CommunityCard>
      ) : null}
    </CommunityShell>
  )
}