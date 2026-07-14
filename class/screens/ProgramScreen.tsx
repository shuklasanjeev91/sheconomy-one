import { Link, useParams } from 'one'
import { useEffect, useState } from 'react'

import { ClassShell } from '~/class/components/ClassShell'
import { ProgramAuthorProfile } from '~/class/components/ProgramAuthorProfile'
import { ProgramMediaPlayer } from '~/class/components/ProgramMediaPlayer'
import { RelatedProgramsRail } from '~/class/components/RelatedProgramsRail'
import {
  fetchProgramBySlug,
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
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { classRoutes } from '~/lib/routes'
import { getProgramShareUrl } from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

export function ProgramScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { slug } = useParams<{ slug: string }>()
  const savedIds = useSavedPrograms()
  const [program, setProgram] = useState<Program | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    let active = true
    setIsLoading(true)
    setError(null)

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
  }, [slug])

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
          <Link href={classRoutes.home}>
            <Text fontWeight="600" color={ui.brand}>
              Back to classes
            </Text>
          </Link>
        </YStack>
      </ClassShell>
    )
  }

  const mediaTab = program.media_type === 'audio' ? 'audio' : 'video'
  const backHref = program.media_type === 'audio' ? classRoutes.audio : classRoutes.home
  const saved = savedIds.includes(program.id) || isProgramSaved(program.id)
  const statsLine = [
    formatProgramViews(program.view_count || program.listen_count),
    program.duration ? formatProgramDuration(program.duration) : null,
    program.category || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ClassShell>
      <YStack gap="$5" width="100%">
        <Link href={backHref}>
          <XStack alignItems="center" gap="$1.5" cursor="pointer" alignSelf="flex-start">
            <Icons.ChevronLeft size={18} color={ui.brand} />
            <Text fontSize={14} fontWeight="600" color={ui.brand}>
              Classes
            </Text>
          </XStack>
        </Link>

        <ProgramMediaPlayer program={program} />

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

        <RelatedProgramsRail program={program} />
      </YStack>
    </ClassShell>
  )
}