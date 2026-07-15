import { Image, XStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { getSheconomyLogoUrl } from '~/lib/supabase/brand'
import { routes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

type NavLogoProps = {
  compact?: boolean
  href?: import('one').Href
}

export function NavLogo({ compact, href = routes.commerce.home }: NavLogoProps) {
  const logoUrl = getSheconomyLogoUrl(compact ? 'icon' : 'primary')

  return (
    <AppLink href={href} replace asChild>
      <XStack
        alignItems="center"
        cursor="pointer"
        flexShrink={0}
        hoverStyle={{ opacity: 0.88 }}
        pressStyle={{ opacity: 0.75 }}
      >
        <Image
          src={logoUrl}
          width={compact ? 36 : 148}
          height={compact ? 36 : 40}
          objectFit="contain"
          alt={`${BRAND_NAME} home`}
        />
      </XStack>
    </AppLink>
  )
}
