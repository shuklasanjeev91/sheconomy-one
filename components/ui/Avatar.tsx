import { forwardRef } from 'react'
import type { GetProps } from 'tamagui'
import { Avatar as TAvatar, SizableText } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

export type AvatarProps = GetProps<typeof TAvatar> & {
  src?: string
  name?: string
  size?: '$3' | '$4' | '$5' | '$6' | '$7' | '$8' | '$10'
  /** Show a subtle ring — useful for active states and profile chrome. */
  ring?: boolean
}

/** Initials-fallback avatar — pass `name` to auto-derive the fallback text. */
export const Avatar = forwardRef<any, AvatarProps>(function Avatar(
  { src, name, size = '$6', ring = false, ...props },
  ref
) {
  const initials = name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')

  return (
    <TAvatar
      ref={ref}
      circular
      size={size}
      theme={BRAND_THEME}
      borderWidth={ring ? 2 : 0}
      borderColor={ring ? '$color8' : 'transparent'}
      {...props}
    >
      {src ? <TAvatar.Image aria-label={name} src={src} /> : null}
      <TAvatar.Fallback
        backgroundColor="$color4"
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderColor="$color6"
      >
        <SizableText fontWeight="700" color="$color11" letterSpacing={0.3}>
          {initials || '?'}
        </SizableText>
      </TAvatar.Fallback>
    </TAvatar>
  )
})

Avatar.displayName = 'Avatar'
