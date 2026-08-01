import { XStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { BrandLogo } from '~/components/brand/BrandLogo'
import { routes } from '~/lib/routes'

type NavLogoProps = {
  compact?: boolean
  href?: import('one').Href
}

export function NavLogo({ compact, href = routes.commerce.home }: NavLogoProps) {
  return (
    <AppLink href={href} replace asChild>
      <XStack
        alignItems="center"
        cursor="pointer"
        flexShrink={0}
        hoverStyle={{ opacity: 0.88 }}
        pressStyle={{ opacity: 0.75 }}
      >
        <BrandLogo
          compact={compact}
          width={compact ? 36 : 148}
          height={compact ? 36 : 40}
          accessibilityLabel="SHEconomy home"
        />
      </XStack>
    </AppLink>
  )
}
