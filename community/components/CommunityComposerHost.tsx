import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { CreatePostForm } from '~/community/components/CreatePostForm'
import { closeComposer, useComposerState } from '~/community/lib/composer-store'

/**
 * Single global mount that renders the post composer as an overlay — a bottom
 * sheet on mobile and a centered dialog on desktop — so "Create post" entry
 * points open in place instead of navigating to a separate route.
 */
export function CommunityComposerHost() {
  const { open, options } = useComposerState()

  return (
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeComposer()
      }}
      title="Create a post"
      maxWidth={620}
    >
      {open ? (
        <CreatePostForm
          embedded
          onSuccess={closeComposer}
          initialMode={options.mode}
          initialGifUrl={options.gifUrl}
          autoPickMedia={options.media}
          initialGroupId={options.groupId}
          initialCompanyId={options.companyId}
        />
      ) : null}
    </CommunityAdaptiveSheet>
  )
}
