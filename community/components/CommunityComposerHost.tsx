import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { CreatePostForm } from '~/community/components/CreatePostForm'
import {
  closeComposer,
  composerSheetTitle,
  useComposerState,
} from '~/community/lib/composer-store'

/**
 * Single global mount for the post composer — always a bottom sheet on web,
 * iOS, and Android. Mode-aware title (article / event / celebration / …).
 */
export function CommunityComposerHost() {
  const { open, options } = useComposerState()

  return (
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeComposer()
      }}
      title={composerSheetTitle(options.mode)}
      maxWidth={620}
      tall={
        options.mode === 'article' ||
        options.mode === 'event' ||
        options.mode === 'celebration'
      }
    >
      {open ? (
        <CreatePostForm
          embedded
          onSuccess={closeComposer}
          initialMode={options.mode}
          initialGifUrl={options.gifUrl}
          autoPickMedia={options.media}
          autoPickVideo={options.video}
          initialGroupId={options.groupId}
          initialCompanyId={options.companyId}
          initialOccasion={options.occasion}
          initialCelebrationTitle={options.celebrationTitle}
          initialContent={options.content}
        />
      ) : null}
    </CommunityAdaptiveSheet>
  )
}
