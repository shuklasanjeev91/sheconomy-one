import { useLocalSearchParams, useParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ensureCohortGroupMembership } from '~/class/lib/cohort-group'
import { enrollInCourse } from '~/class/lib/enrollment'
import { ClassShell } from '~/class/components/ClassShell'
import { ProgramAuthorProfile } from '~/class/components/ProgramAuthorProfile'
import { ProgramMediaPlayer } from '~/class/components/ProgramMediaPlayer'
import { ProgramUpNextPanel, useClassAutoplay } from '~/class/components/ProgramUpNextPanel'
import { SaveToPlaylistSheet } from '~/class/components/SaveToPlaylistSheet'
import { fetchPlaylistWithPrograms } from '~/class/lib/playlists'
import {
  fetchProgramBySlug,
  fetchUpNextPrograms,
  formatProgramDuration,
  formatProgramViews,
  getProgramSlug,
  hasProgramAuthor,
  recordProgramView,
  type Program,
} from '~/class/lib/programs'
import { recordProgramLocalView } from '~/class/lib/recently-viewed-programs'
import { isProgramSaved, toggleSavedProgram, useSavedPrograms } from '~/class/lib/saved-programs'
import { SectionTitle } from '~/commerce/components'
import { FullWidthLayout, PageCenter } from '~/components/layout'
import { ShareButton } from '~/components/share'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast, useMedia } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { classRoutes } from '~/lib/routes'
import { getProgramShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'
import { usePageSeo } from '~/components/seo/RouteSeo'
import { useSupabase } from '~/providers/SupabaseProvider'
import { navigateApp } from '~/lib/platform/navigate'

const NEXT_COUNTDOWN_SECONDS = 5

export function ProgramScreen() {
  const ui = useAppUi()
  const media = useMedia()
  const toast = useAppToast()
  const router = useRouter()
  const { slug } = useParams<{ slug: string }>()
  const params = useLocalSearchParams<{ playlist?: string }>()
  const playlistId = typeof params.playlist === 'string' ? params.playlist : null
  const savedIds = useSavedPrograms()
  const autoplay = useClassAutoplay()
  const { user } = useSupabase()

  const [program, setProgram] = useState<Program | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queue, setQueue] = useState<Program[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [playlistTitle, setPlaylistTitle] = useState<string | null>(null)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [joiningCohort, setJoiningCohort] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nextProgramRef = useRef<Program | null>(null)

  usePageSeo(
    useMemo(() => {
      if (!program) return null
      return {
        title: program.title,
        description:
          program.description?.replace(/\s+/g, ' ').trim().slice(0, 200) ||
          `Watch or listen to ${program.title} on SHEconomy Classes.`,
        image: program.image_url,
      }
    }, [program]),
  )

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setCountdown(null)
    nextProgramRef.current = null
  }, [])

  useEffect(() => {
    if (!slug) return

    let active = true
    setIsLoading(true)
    setError(null)
    clearCountdown()

    void fetchProgramBySlug(slug).then(({ program: next, error: fetchError }) => {
      if (!active) return
      setProgram(next)
      setError(fetchError)
      setIsLoading(false)

      if (next) {
        recordProgramLocalView(next.id)
        void recordProgramView(next.id)
      }
    })

    return () => {
      active = false
    }
  }, [clearCountdown, slug])

  useEffect(() => {
    if (!program) {
      setQueue([])
      setPlaylistTitle(null)
      return
    }

    let active = true
    setQueueLoading(true)

    if (playlistId) {
      void fetchPlaylistWithPrograms(playlistId).then(({ result, error: playlistError }) => {
        if (!active) return
        if (playlistError || !result) {
          setPlaylistTitle(null)
          void fetchUpNextPrograms(program).then((related) => {
            if (!active) return
            setQueue(related.programs)
            setQueueLoading(false)
          })
          return
        }
        setPlaylistTitle(result.playlist.title)
        setQueue(result.programs)
        setQueueLoading(false)
      })
    } else {
      setPlaylistTitle(null)
      void fetchUpNextPrograms(program).then((related) => {
        if (!active) return
        setQueue(related.programs)
        setQueueLoading(false)
      })
    }

    return () => {
      active = false
    }
  }, [playlistId, program])

  const nextProgram = useMemo(() => {
    if (!program) return null
    if (playlistId) {
      const index = queue.findIndex((item) => item.id === program.id)
      if (index >= 0 && index < queue.length - 1) return queue[index + 1] ?? null
      return null
    }
    return queue.find((item) => item.id !== program.id) ?? null
  }, [playlistId, program, queue])

  const navigateToNext = useCallback(
    (next: Program) => {
      clearCountdown()
      const href = playlistId
        ? classRoutes.program(getProgramSlug(next), { playlist: playlistId })
        : classRoutes.program(getProgramSlug(next))
      router.push(href as never)
    },
    [clearCountdown, playlistId, router],
  )

  const startCountdown = useCallback(
    (next: Program) => {
      clearCountdown()
      nextProgramRef.current = next
      setCountdown(NEXT_COUNTDOWN_SECONDS)
      countdownRef.current = setInterval(() => {
        setCountdown((current) => {
          if (current == null) return null
          if (current <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current)
              countdownRef.current = null
            }
            const target = nextProgramRef.current
            if (target) {
              // defer navigation outside setState
              queueMicrotask(() => navigateToNext(target))
            }
            return null
          }
          return current - 1
        })
      }, 1000)
    },
    [clearCountdown, navigateToNext],
  )

  useEffect(() => {
    return () => clearCountdown()
  }, [clearCountdown])

  const handleEnded = useCallback(() => {
    if (!autoplay.enabled || !nextProgram) return
    startCountdown(nextProgram)
  }, [autoplay.enabled, nextProgram, startCountdown])

  if (isLoading) {
    return (
      <FullWidthLayout>
        <PageCenter>
          <Spinner size="large" />
        </PageCenter>
      </FullWidthLayout>
    )
  }

  if (!program) {
    return (
      <ClassShell>
        <YStack gap="$3" width="100%">
          <Text fontSize={22} fontWeight="700" color={ui.text}>
            Program not found
          </Text>
          <Text color={ui.textSecondary}>{error ?? 'This program could not be loaded.'}</Text>
          <AppLink href={classRoutes.home}>
            <Text fontWeight="600" color={ui.brand}>
              Browse classes
            </Text>
          </AppLink>
        </YStack>
      </ClassShell>
    )
  }

  const saved = savedIds.includes(program.id) || isProgramSaved(program.id)
  const statsLine = [
    formatProgramViews(program.view_count || program.listen_count),
    program.duration ? formatProgramDuration(program.duration) : null,
    program.category || null,
  ]
    .filter(Boolean)
    .join(' · ')

  const isDesktop = media.gtLg
  const upNextTitle = playlistTitle ? `Playlist · ${playlistTitle}` : 'Up next'

  return (
    <ClassShell>
      <YStack gap="$5" width="100%">
        <XStack
          gap="$4"
          width="100%"
          alignItems="flex-start"
          flexDirection={isDesktop ? 'row' : 'column'}
        >
          <YStack flex={isDesktop ? 1 : undefined} width="100%" minWidth={0} gap="$3">
            <ProgramMediaPlayer program={program} autoPlay onEnded={handleEnded} />

            {countdown != null && nextProgram ? (
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
                padding="$3"
                borderRadius={radius.card}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surface}
              >
                <Text fontSize={13} color={ui.text} flex={1} numberOfLines={2}>
                  Playing next in {countdown}s · {nextProgram.title}
                </Text>
                <XStack gap="$2">
                  <Button size="$2" tone="ghost" onPress={clearCountdown}>
                    Cancel
                  </Button>
                  <Button size="$2" onPress={() => navigateToNext(nextProgram)}>
                    Play now
                  </Button>
                </XStack>
              </XStack>
            ) : null}

            <YStack gap="$3" width="100%">
              <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
                <Text fontSize={24} fontWeight="700" color={ui.text} letterSpacing={-0.4} flex={1}>
                  {program.title}
                </Text>
                <XStack gap="$1" alignItems="center">
                  <Button
                    tone="ghost"
                    size="$3"
                    borderRadius={999}
                    icon={<Icons.BookmarkPlus size={18} color={ui.textMuted} />}
                    aria-label="Save to playlist"
                    onPress={() => setSaveSheetOpen(true)}
                  />
                  <Button
                    tone="ghost"
                    size="$3"
                    borderRadius={999}
                    icon={
                      <Icons.Bookmark
                        size={18}
                        color={saved ? ui.brand : ui.textMuted}
                        fill={saved ? ui.brand : 'transparent'}
                      />
                    }
                    aria-label={saved ? 'Remove from saved' : 'Save program'}
                    onPress={() => {
                      const next = toggleSavedProgram(program.id)
                      toast.show(next ? 'Program saved' : 'Removed from saved', { tone: 'success' })
                    }}
                  />
                  <ShareButton
                    variant="icon"
                    label="Share program"
                    sheetTitle="Share program"
                    copyLabel="Copy program link"
                    copyToastMessage="Program link copied to clipboard."
                    payload={{
                      url: getProgramShareUrl(getProgramSlug(program)),
                      title: program.title,
                      text: statsLine || undefined,
                    }}
                  />
                </XStack>
              </XStack>

              {statsLine ? (
                <Text fontSize={13} color={ui.textMuted}>
                  {statsLine}
                </Text>
              ) : null}

              <Button
                tone="primary"
                size="$3"
                borderRadius={999}
                alignSelf="flex-start"
                disabled={joiningCohort}
                icon={
                  joiningCohort ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Icons.Users size={15} color="white" />
                  )
                }
                onPress={() => {
                  void (async () => {
                    if (!user?.id) {
                      toast.show('Sign in to join the cohort', { tone: 'default' })
                      return
                    }
                    setJoiningCohort(true)
                    try {
                      // Best-effort course enrollment when program id maps to class_course.
                      await enrollInCourse({ courseId: program.id, userId: user.id })
                      const result = await ensureCohortGroupMembership({
                        userId: user.id,
                        programTitle: program.title,
                        programSlug: getProgramSlug(program),
                      })
                      if (result.error || !result.path) {
                        toast.show('Could not join cohort', {
                          tone: 'danger',
                          message: result.error ?? 'Try again',
                        })
                        return
                      }
                      toast.show(result.created ? 'Cohort created' : 'Joined cohort', {
                        tone: 'success',
                        message: 'Opening your learning group…',
                      })
                      navigateApp(result.path)
                    } finally {
                      setJoiningCohort(false)
                    }
                  })()
                }}
              >
                {joiningCohort ? 'Joining…' : 'Join learning cohort'}
              </Button>

              {hasProgramAuthor(program) ? (
                <YStack
                  padding="$4"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$3"
                  width="100%"
                  style={getShadowStyle('sm')}
                >
                  <SectionTitle title="Host" />
                  <ProgramAuthorProfile program={program} size="large" />
                </YStack>
              ) : null}

              {program.description ? (
                <YStack
                  padding="$4"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$2"
                  width="100%"
                  style={getShadowStyle('sm')}
                >
                  <SectionTitle title="About this program" />
                  <Text fontSize={14} color={ui.textSecondary} lineHeight={22} whiteSpace="pre-wrap">
                    {program.description}
                  </Text>
                </YStack>
              ) : null}
            </YStack>
          </YStack>

          <YStack width={isDesktop ? 420 : '100%'} flexShrink={0}>
            <ProgramUpNextPanel
              currentProgramId={program.id}
              queue={queue}
              isLoading={queueLoading}
              title={upNextTitle}
              playlistId={playlistId}
              autoplayEnabled={autoplay.enabled}
              onAutoplayChange={autoplay.setEnabled}
            />
          </YStack>
        </XStack>
      </YStack>

      <SaveToPlaylistSheet
        open={saveSheetOpen}
        onOpenChange={setSaveSheetOpen}
        program={program}
      />
    </ClassShell>
  )
}
