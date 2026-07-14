import { PostMediaCarousel } from '~/community/components/PostMediaCarousel'
import { Dialog, DialogContent, DialogOverlay, Icons, XStack } from '~/components/ui'

type PostImageLightboxProps = {
  urls: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Fullscreen viewer for post media — opened when tapping an image on the detail view. */
export function PostImageLightbox({ urls, open, onOpenChange }: PostImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <DialogOverlay backgroundColor="rgba(0,0,0,0.9)" />
        <DialogContent
          width="100%"
          maxWidth={960}
          padding="$0"
          backgroundColor="transparent"
          borderWidth={0}
          overflow="hidden"
        >
          <XStack
            position="absolute"
            top={12}
            right={12}
            zIndex={10}
            width={38}
            height={38}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.6)"
            cursor="pointer"
            hoverStyle={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
            aria-label="Close"
            onPress={() => onOpenChange(false)}
          >
            <Icons.X size={20} color="white" />
          </XStack>
          {open ? (
            <PostMediaCarousel urls={urls} height={620} fit="contain" rounded={false} />
          ) : null}
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}
