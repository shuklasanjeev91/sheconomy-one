import { Link } from 'one'
import { useState } from 'react'

import { useProfileConnection } from '~/community/hooks/useProfileConnection'
import { ConfirmDialog, Icons, Spinner, Text, XStack } from '~/components/ui'
import { routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

const BRAND_BLUE = '#0a66c2'

type ProfileConnectButtonProps = {
  targetUserId?: string | null
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

export function ProfileConnectButton({
  targetUserId,
  size = 'md',
  fullWidth = false,
}: ProfileConnectButtonProps) {
  const ui = useAppUi()
  const connection = useProfileConnection(targetUserId)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)

  if (!targetUserId || connection.isLoading) {
    return (
      <XStack
        minWidth={size === 'sm' ? 88 : 104}
        minHeight={size === 'sm' ? 32 : 36}
        alignItems="center"
        justifyContent="center"
      >
        <Spinner size="small" color={BRAND_BLUE} />
      </XStack>
    )
  }

  if (connection.state.status === 'self') {
    return null
  }

  if (!connection.isAuthenticated) {
    return (
      <Link href={routes.signIn} asChild>
        <ConnectChip label="Connect" variant="outline-primary" size={size} fullWidth={fullWidth} />
      </Link>
    )
  }

  if (connection.state.status === 'connected') {
    return (
      <>
        <ConnectChip
          label="Connected"
          variant="muted"
          size={size}
          fullWidth={fullWidth}
          icon="check"
          disabled={connection.isActing}
          isLoading={connection.isActing}
          onPress={() => setConfirmRemove(true)}
        />
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title="Remove connection?"
          description="You'll no longer be connected. To reconnect, you'll need to send a new request."
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            void connection.disconnect()
          }}
        />
      </>
    )
  }

  if (connection.state.status === 'pending_sent') {
    return (
      <>
        <ConnectChip
          label="Pending"
          variant="muted"
          size={size}
          fullWidth={fullWidth}
          disabled={connection.isActing}
          isLoading={connection.isActing}
          onPress={() => setConfirmWithdraw(true)}
        />
        <ConfirmDialog
          open={confirmWithdraw}
          onOpenChange={setConfirmWithdraw}
          title="Withdraw request?"
          description="This will cancel your pending connection request."
          confirmLabel="Withdraw"
          destructive
          onConfirm={() => {
            void connection.withdraw()
          }}
        />
      </>
    )
  }

  if (connection.state.status === 'pending_received') {
    return (
      <XStack gap="$2" flexShrink={0} width={fullWidth ? '100%' : undefined}>
        <ConnectChip
          label="Ignore"
          variant="outline"
          size={size}
          disabled={connection.isActing}
          onPress={connection.ignore}
          flex={fullWidth ? 1 : undefined}
        />
        <ConnectChip
          label="Accept"
          variant="primary"
          size={size}
          disabled={connection.isActing}
          isLoading={connection.isActing}
          onPress={connection.accept}
          flex={fullWidth ? 1 : undefined}
        />
      </XStack>
    )
  }

  return (
    <ConnectChip
      label="Connect"
      variant="outline-primary"
      size={size}
      fullWidth={fullWidth}
      disabled={connection.isActing}
      isLoading={connection.isActing}
      onPress={connection.connect}
    />
  )
}

function ConnectChip({
  label,
  variant,
  size,
  disabled,
  isLoading,
  onPress,
  fullWidth,
  flex,
  icon,
}: {
  label: string
  variant: 'primary' | 'outline' | 'outline-primary' | 'muted'
  size: 'sm' | 'md'
  disabled?: boolean
  isLoading?: boolean
  onPress?: () => void
  fullWidth?: boolean
  flex?: number
  icon?: 'check'
}) {
  const ui = useAppUi()
  const isPrimary = variant === 'primary'
  const isOutlinePrimary = variant === 'outline-primary'
  const isMuted = variant === 'muted'
  const paddingX = size === 'sm' ? '$2.5' : '$3'
  const minWidth = size === 'sm' ? 88 : 104
  const labelColor = isPrimary
    ? ui.onBrand
    : isOutlinePrimary
      ? BRAND_BLUE
      : ui.textMuted

  return (
    <XStack
      paddingHorizontal={paddingX}
      paddingVertical={size === 'sm' ? 5 : 6}
      borderRadius={20}
      borderWidth={1}
      borderColor={isPrimary || isOutlinePrimary ? BRAND_BLUE : ui.textMuted}
      backgroundColor={isPrimary ? BRAND_BLUE : 'transparent'}
      minWidth={fullWidth ? undefined : minWidth}
      width={fullWidth ? '100%' : undefined}
      flex={flex}
      gap="$1.5"
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.6 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { opacity: 0.85 }}
      onPress={disabled ? undefined : onPress}
    >
      {isLoading ? (
        <Spinner size="small" color={isPrimary ? ui.onBrand : BRAND_BLUE} />
      ) : (
        <>
          {icon === 'check' ? <Icons.Check size={size === 'sm' ? 14 : 16} color={labelColor} /> : null}
          <Text fontSize={size === 'sm' ? 13 : 14} fontWeight="600" color={labelColor}>
            {label}
          </Text>
        </>
      )}
    </XStack>
  )
}