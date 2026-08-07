import { Button, Spinner } from '~/components/ui'

type AppleSignInButtonProps = {
  disabled?: boolean
  busy?: boolean
  onPress: () => void
}

/** Web / default: styled Continue with Apple control. */
export function AppleSignInButton({ disabled, busy, onPress }: AppleSignInButtonProps) {
  return (
    <Button
      tone="outline"
      size="$4"
      borderRadius={999}
      disabled={disabled || busy}
      onPress={onPress}
      icon={busy ? <Spinner size="small" /> : undefined}
    >
      {busy ? 'Connecting…' : 'Continue with Apple'}
    </Button>
  )
}
