import { Button, Icons } from '~/components/ui'
import { openShareTarget, type SharePayload } from '~/lib/share'

type WhatsAppShareButtonProps = {
  payload: SharePayload
  label?: string
  size?: '$2' | '$3' | '$4'
}

/** Opens WhatsApp with the share text and link. Does not open the share sheet. */
export function WhatsAppShareButton({
  payload,
  label = 'WhatsApp',
  size = '$3',
}: WhatsAppShareButtonProps) {
  return (
    <Button
      tone="outline"
      size={size}
      borderRadius={999}
      icon={<Icons.MessageCircle size={15} />}
      onPress={() => void openShareTarget('whatsapp', payload)}
    >
      {label}
    </Button>
  )
}
