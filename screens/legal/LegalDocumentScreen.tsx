import { ScrollView } from 'react-native'
import { AppLink } from '~/components/navigation/AppLink'

import { Text, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { appRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

export type LegalDocumentKind = 'terms' | 'privacy' | 'cookies' | 'ads'

const COPY: Record<
  LegalDocumentKind,
  { title: string; updated: string; sections: { heading: string; body: string }[] }
> = {
  terms: {
    title: 'Terms of use',
    updated: 'July 15, 2026',
    sections: [
      {
        heading: 'Agreement',
        body: `By using ${BRAND_NAME}, you agree to these Terms of use and our Privacy Policy. If you do not agree, please do not use the service.`,
      },
      {
        heading: 'Accounts',
        body: 'You are responsible for keeping your account secure and for activity that happens under your login. You must provide accurate information and comply with applicable laws.',
      },
      {
        heading: 'Marketplace',
        body: `Buyers and sellers on ${BRAND_NAME} are responsible for their listings, orders, and communications. We may remove content or suspend accounts that violate these terms or community standards.`,
      },
      {
        heading: 'Contact',
        body: 'Questions about these terms can be sent through Help Center → Contact us.',
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'July 15, 2026',
    sections: [
      {
        heading: 'What we collect',
        body: `We collect account details, profile information, and activity needed to operate ${BRAND_NAME} — including orders, shop data, community posts, and support requests.`,
      },
      {
        heading: 'How we use information',
        body: 'We use your information to provide and improve the product, personalize discovery (including region and currency preferences), process payments, and keep the community safe.',
      },
      {
        heading: 'Your choices',
        body: 'You can review privacy-related controls in Settings → Privacy, and manage country, language, and currency from the marketplace footer.',
      },
      {
        heading: 'Contact',
        body: 'Privacy questions can be sent through Help Center → Contact us.',
      },
    ],
  },
  cookies: {
    title: 'Cookies policy',
    updated: 'July 15, 2026',
    sections: [
      {
        heading: 'What cookies are',
        body: 'Cookies and similar technologies help us keep you signed in, remember preferences (such as region and currency), and understand how the site is used.',
      },
      {
        heading: 'How we use them',
        body: `${BRAND_NAME} uses essential cookies for authentication and security, preference cookies for locale settings, and analytics cookies to improve performance and shopping experience.`,
      },
      {
        heading: 'Your choices',
        body: 'You can clear or block cookies in your browser. Some features may not work if essential cookies are disabled.',
      },
    ],
  },
  ads: {
    title: 'Interest-based ads',
    updated: 'July 15, 2026',
    sections: [
      {
        heading: 'How ads may be personalized',
        body: `${BRAND_NAME} and partners may use activity such as browsing, searches, and purchases to show more relevant promotions and shop features.`,
      },
      {
        heading: 'Your controls',
        body: 'Review Privacy settings for account-level preferences, and use Help Center if you need help limiting personalized marketing where available.',
      },
      {
        heading: 'Learn more',
        body: 'See our Privacy Policy for details on how we process information used for personalization.',
      },
    ],
  },
}

type LegalDocumentScreenProps = {
  kind: LegalDocumentKind
}

export function LegalDocumentScreen({ kind }: LegalDocumentScreenProps) {
  const ui = useAppUi()
  const { gutter } = useAppLayout()
  const doc = COPY[kind]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ui.background }}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <YStack
        width="100%"
        maxWidth={720}
        alignSelf="center"
        paddingHorizontal={gutter}
        paddingTop="$8"
        gap="$5"
      >
        <YStack gap="$2">
          <Text fontSize={28} fontWeight="700" color={ui.text}>
            {doc.title}
          </Text>
          <Text fontSize={13} color={ui.textMuted}>
            Last updated {doc.updated}
          </Text>
        </YStack>

        {doc.sections.map((section) => (
          <YStack key={section.heading} gap="$2">
            <Text fontSize={17} fontWeight="600" color={ui.text}>
              {section.heading}
            </Text>
            <Text fontSize={15} lineHeight={24} color={ui.textSecondary}>
              {section.body}
            </Text>
          </YStack>
        ))}

        <YStack gap="$2" paddingTop="$2">
          <AppLink href={appRoutes.help} asChild>
            <Text fontSize={14} color={ui.link} cursor="pointer" hoverStyle={{ textDecorationLine: 'underline' }}>
              Visit Help Center
            </Text>
          </AppLink>
          {kind !== 'privacy' ? (
            <AppLink href={appRoutes.legalPrivacy} asChild>
              <Text fontSize={14} color={ui.link} cursor="pointer" hoverStyle={{ textDecorationLine: 'underline' }}>
                Privacy policy
              </Text>
            </AppLink>
          ) : null}
          {kind !== 'terms' ? (
            <AppLink href={appRoutes.legalTerms} asChild>
              <Text fontSize={14} color={ui.link} cursor="pointer" hoverStyle={{ textDecorationLine: 'underline' }}>
                Terms of use
              </Text>
            </AppLink>
          ) : null}
        </YStack>
      </YStack>
    </ScrollView>
  )
}
