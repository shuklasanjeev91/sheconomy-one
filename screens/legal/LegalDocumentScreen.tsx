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
    updated: 'October 29, 2026',
    sections: [
      {
        heading: 'Who we are',
        body: `${BRAND_NAME} Pvt Ltd (“we”, “us”) operates the ${BRAND_NAME} marketplace, community, chat, classes, and co-work meeting experiences on web, iOS, and Android (including package com.sheconomy.ecommerce). This Privacy Policy explains what personal data we collect, how we use it, who we share it with, how we protect it, and how you can control or delete it.`,
      },
      {
        heading: 'What we collect',
        body: `We collect account details (email, phone, name, profile photo, Apple/Google sign-in identifiers), profile and shop information, marketplace activity (listings, orders, addresses, payment metadata), community content (posts, comments, messages), device and usage data needed for security and performance, push notification tokens when enabled, and optional permissions you grant — camera and microphone for video meetings and gender/liveness verification, photos for uploads, contacts you choose to connect with, and location while using address or nearby-shop features. Precise location is optional and not used in the background.`,
      },
      {
        heading: 'How we use information',
        body: 'We use your information to provide and improve the product, authenticate accounts, personalize discovery (including region and currency preferences), process orders and payments, enable chat and meetings, send transactional and optional marketing notifications, prevent fraud and abuse, comply with legal obligations, and keep the community safe.',
      },
      {
        heading: 'Third parties',
        body: 'We do not sell your personal information. We use service providers that process data on our behalf under contractual protections comparable to this policy, including hosting and auth (Supabase), push notifications (OneSignal), real-time meetings (our media servers hosted on Amazon Web Services), payment processors for checkout, analytics (for example Microsoft Clarity where enabled), and Apple/Google for sign-in and store distribution. We may disclose information if required by law or to protect rights and safety.',
      },
      {
        heading: 'Data security',
        body: 'We use industry-standard safeguards appropriate to the sensitivity of the data, including encrypted transport (HTTPS/TLS), access controls, and secure authentication. No method of transmission or storage is 100% secure, but we work to prevent unauthorized access, alteration, or disclosure.',
      },
      {
        heading: 'Retention and deletion',
        body: `We keep account and transaction records while your account is active and as needed for legal, tax, dispute, and security obligations. You can start account deletion in the app under Settings → Account → Delete account. Deletion deactivates your account immediately and schedules permanent removal; limited records may be retained where the law requires.`,
      },
      {
        heading: 'Your choices',
        body: 'You can review privacy-related controls in Settings → Privacy, manage notifications on your device, and manage country, language, and currency from the marketplace footer. You may withdraw optional permissions in system settings; some features will not work without them. You may also request access, correction, or deletion of your personal data.',
      },
      {
        heading: 'Children’s privacy',
        body: `${BRAND_NAME} is not directed to children under 13 (or the minimum age required in your country). We do not knowingly collect personal information from children. If you believe a child has provided personal data, contact us and we will take appropriate steps to delete it.`,
      },
      {
        heading: 'Contact',
        body: `Privacy questions and data requests: privacy@sheconomy.com, or Help Center → Contact us. Controller: ${BRAND_NAME} Pvt Ltd. Website: https://www.sheconomy.in`,
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
        maxWidth="100%"
        alignSelf="stretch"
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
