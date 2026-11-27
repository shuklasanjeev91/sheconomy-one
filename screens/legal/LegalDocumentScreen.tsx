import { ScrollView } from 'react-native'
import { AppLink } from '~/components/navigation/AppLink'

import { Text, YStack } from '~/components/ui'
import {
  BRAND_NAME,
  LEGAL_ENTITY_NAME,
  TECHNICAL_PARTNER_NAME,
} from '~/config/brand'
import { appRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

export type LegalDocumentKind =
  | 'about'
  | 'terms'
  | 'privacy'
  | 'cookies'
  | 'ads'
  | 'shipping'
  | 'payment'
  | 'returns'

const COPY: Record<
  LegalDocumentKind,
  { title: string; updated: string; sections: { heading: string; body: string }[] }
> = {
  about: {
    title: 'About us',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Our mission',
        body: `${BRAND_NAME} is a women-first marketplace and community. We help women-led shops sell goods and services, connect with customers, and grow through community, classes, chat, and co-work — on web, iOS, and Android.`,
      },
      {
        heading: 'What we offer',
        body: `On ${BRAND_NAME} you can discover independent shops, buy physical and digital products, follow community conversations, learn through classes, and collaborate in co-work meetings. Sellers get storefront tools, order management, shipping options, and payouts in one place.`,
      },
      {
        heading: 'Company information',
        body: `${LEGAL_ENTITY_NAME} owns and operates the ${BRAND_NAME} platform (including the Android app package com.sheconomy.ecommerce). ${LEGAL_ENTITY_NAME} is the commercial operator and data controller for the service.`,
      },
      {
        heading: 'Technical partner',
        body: `${TECHNICAL_PARTNER_NAME} is the technical partner of ${LEGAL_ENTITY_NAME}. It designs, builds, and operates the technology that powers ${BRAND_NAME} — website, mobile apps, hosting, and related platform services — under instructions from ${LEGAL_ENTITY_NAME}.`,
      },
      {
        heading: 'How we work together',
        body: `${LEGAL_ENTITY_NAME} sets marketplace policies, seller and buyer relationships, and privacy commitments. ${TECHNICAL_PARTNER_NAME} processes technical and operational data only as needed to run and improve the platform. For privacy details see our Privacy Policy; for orders see Shipping & exchange, Payment, and Return & refund.`,
      },
      {
        heading: 'Contact',
        body: `Questions about ${BRAND_NAME}: Help Center → Contact us. Privacy: privacy@sheconomy.com. Website: https://www.sheconomy.in. Operator: ${LEGAL_ENTITY_NAME}. Technical partner: ${TECHNICAL_PARTNER_NAME}.`,
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Agreement',
        body: `These Terms of use are between you and ${LEGAL_ENTITY_NAME}. By using ${BRAND_NAME}, you agree to these Terms, our Privacy Policy, and the related marketplace policies (shipping & exchange, payment, and return & refund). If you do not agree, please do not use the service. Platform technology is provided with ${TECHNICAL_PARTNER_NAME}, the technical partner of ${LEGAL_ENTITY_NAME}.`,
      },
      {
        heading: 'Accounts',
        body: 'You are responsible for keeping your account secure and for activity that happens under your login. You must provide accurate information and comply with applicable laws.',
      },
      {
        heading: 'Marketplace',
        body: `Buyers and sellers on ${BRAND_NAME} are responsible for their listings, orders, and communications. Individual shops may publish additional shipping, return, or refund terms on their listings; those shop terms apply in addition to these platform policies. We may remove content or suspend accounts that violate these terms or community standards.`,
      },
      {
        heading: 'Contact',
        body: `Questions about these terms can be sent through Help Center → Contact us. Operator: ${LEGAL_ENTITY_NAME}. Technical partner: ${TECHNICAL_PARTNER_NAME}.`,
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Who we are',
        body: `${LEGAL_ENTITY_NAME} (“we”, “us”) operates the ${BRAND_NAME} marketplace, community, chat, classes, and co-work meeting experiences on web, iOS, and Android (including package com.sheconomy.ecommerce). ${TECHNICAL_PARTNER_NAME} is the technical partner of ${LEGAL_ENTITY_NAME} and helps run the platform technology under our instructions. This Privacy Policy explains what personal data we collect, how we use it, who we share it with, how we protect it, and how you can control or delete it.`,
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
        body: `We do not sell your personal information. ${TECHNICAL_PARTNER_NAME}, as technical partner of ${LEGAL_ENTITY_NAME}, processes data needed to host and operate the apps and website. We also use other service providers under contractual protections comparable to this policy, including hosting and auth (Supabase), push notifications (OneSignal), real-time meetings (our media servers hosted on AWS), payment processors for checkout, analytics (for example Microsoft Clarity where enabled), and Apple/Google for sign-in and store distribution. We may disclose information if required by law or to protect rights and safety.`,
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
        body: `Privacy questions and data requests: privacy@sheconomy.com, or Help Center → Contact us. Controller: ${LEGAL_ENTITY_NAME}. Technical partner: ${TECHNICAL_PARTNER_NAME}. Website: https://www.sheconomy.in`,
      },
    ],
  },
  cookies: {
    title: 'Cookies policy',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'What cookies are',
        body: 'Cookies and similar technologies help us keep you signed in, remember preferences (such as region and currency), and understand how the site is used.',
      },
      {
        heading: 'How we use them',
        body: `${LEGAL_ENTITY_NAME} operates ${BRAND_NAME} and uses essential cookies for authentication and security, preference cookies for locale settings, and analytics cookies to improve performance and shopping experience. ${TECHNICAL_PARTNER_NAME}, the technical partner of ${LEGAL_ENTITY_NAME}, helps operate the technology that sets and processes these cookies.`,
      },
      {
        heading: 'Your choices',
        body: 'You can clear or block cookies in your browser. Some features may not work if essential cookies are disabled.',
      },
    ],
  },
  ads: {
    title: 'Interest-based ads',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'How ads may be personalized',
        body: `${LEGAL_ENTITY_NAME} and partners may use activity such as browsing, searches, and purchases on ${BRAND_NAME} to show more relevant promotions and shop features. Platform delivery may involve ${TECHNICAL_PARTNER_NAME} as technical partner of ${LEGAL_ENTITY_NAME}.`,
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
  shipping: {
    title: 'Shipping & exchange policy',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Who this covers',
        body: `This policy applies to orders placed on ${BRAND_NAME}, operated by ${LEGAL_ENTITY_NAME}. ${TECHNICAL_PARTNER_NAME} is the technical partner of ${LEGAL_ENTITY_NAME} and provides the platform that sellers use to configure shipping. Physical goods are fulfilled by the selling shop; digital goods are delivered electronically and do not require shipping.`,
      },
      {
        heading: 'Shipping',
        body: 'Each listing shows the shipping method, processing time, estimated delivery window, and shipping cost (or free-shipping threshold) set by the shop. Delivery times are estimates and may change because of carrier delays, remote locations, customs, weather, or peak seasons. Buyers must provide a complete, accurate delivery address and phone number. Risk of loss for physical items generally passes when the shop hands the parcel to the carrier, unless the shop states otherwise.',
      },
      {
        heading: 'Tracking and delays',
        body: 'Where a tracking number is available, it appears on the order details page after the shop ships. If a shipment is delayed or marked lost, contact the shop from Order details first. If you cannot resolve it, open a Help Center request so we can help mediate.',
      },
      {
        heading: 'Exchanges',
        body: 'Size, colour, or variant exchanges are allowed only when the shop’s listing policy permits them. Start an exchange from Order details within the window shown on the listing or order. The shop may require the original item to be returned unused and in original packaging before sending a replacement. Additional shipping charges for exchanges, if any, are shown before you confirm.',
      },
      {
        heading: 'Undeliverable parcels',
        body: 'If a parcel is returned to the shop because of an incorrect address, refused delivery, or repeated failed attempts, the shop may charge return shipping and restocking as disclosed, or offer a reship after address correction.',
      },
      {
        heading: 'Contact',
        body: `Shipping and exchange questions: Help Center → Contact us, or message the shop from your order. Operator: ${LEGAL_ENTITY_NAME}.`,
      },
    ],
  },
  payment: {
    title: 'Payment policy',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Who this covers',
        body: `${LEGAL_ENTITY_NAME} operates checkout on ${BRAND_NAME}. ${TECHNICAL_PARTNER_NAME}, the technical partner of ${LEGAL_ENTITY_NAME}, helps run the payment flows. Card and UPI data are processed by licensed payment partners; ${BRAND_NAME} does not store full card numbers.`,
      },
      {
        heading: 'Accepted methods',
        body: 'Available methods depend on your region and may include cards, UPI, net banking, wallets, and other options shown at checkout. Prices are displayed in the currency selected in your region preferences. Taxes, shipping, and fees are itemized before you pay.',
      },
      {
        heading: 'Authorization and capture',
        body: 'When you place an order, your payment method may be authorized immediately. Capture usually happens when the order is confirmed. Failed, expired, or cancelled checkouts release the authorization according to your bank’s timelines.',
      },
      {
        heading: 'Failed payments and disputes',
        body: 'If a payment fails, you can retry with another method from checkout or Order details. Chargebacks and payment disputes should first be raised with the shop or via Help Center; your bank may also allow a formal dispute. Fraudulent or abusive disputes may lead to account limits.',
      },
      {
        heading: 'Seller payouts',
        body: 'Seller earnings are settled to the payout method linked in shop settings after order fulfillment and any applicable holds for returns or risk review. Payout schedules and fees are shown in the vendor wallet and payout screens.',
      },
      {
        heading: 'Contact',
        body: `Payment questions: Help Center → Contact us, or manage saved methods under Payment methods. Operator: ${LEGAL_ENTITY_NAME}.`,
      },
    ],
  },
  returns: {
    title: 'Return & refund policy',
    updated: 'November 27, 2026',
    sections: [
      {
        heading: 'Who this covers',
        body: `This policy describes how returns and refunds work on ${BRAND_NAME}, operated by ${LEGAL_ENTITY_NAME}. ${TECHNICAL_PARTNER_NAME} is the technical partner of ${LEGAL_ENTITY_NAME} and powers the order and returns tools. Each shop may set a more specific return window or exclusions on the listing; those shop terms apply together with this policy.`,
      },
      {
        heading: 'Eligible returns',
        body: 'Physical items may be returnable when the listing’s return policy allows it and the request is started within the stated window from delivery. Items should be unused, with tags and original packaging where required by the shop. Digital goods, personalized items, perishable goods, intimate wear, and other categories marked non-returnable on the listing are generally not eligible unless defective or not as described.',
      },
      {
        heading: 'How to request a return',
        body: 'Open Order details → Request return (or the equivalent returns option), choose a reason, and follow the shop’s instructions for pickup or self-ship. Keep proof of shipment until the refund is complete. The shop reviews the request and may approve, offer an exchange, or decline with a reason.',
      },
      {
        heading: 'Refunds',
        body: 'Approved refunds are issued to the original payment method after the shop receives and inspects the return, unless the shop agrees to refund earlier. Processing time depends on the payment partner and your bank (often several business days after approval). Shipping fees are refunded only when the shop’s policy or a platform decision says so (for example, wrong or damaged items).',
      },
      {
        heading: 'Damaged, wrong, or missing items',
        body: `Report damaged, incorrect, or incomplete orders promptly from Order details with photos when possible. ${LEGAL_ENTITY_NAME} may help mediate when buyers and shops cannot resolve the issue.`,
      },
      {
        heading: 'Contact',
        body: `Return and refund questions: Help Center → Contact us. Operator: ${LEGAL_ENTITY_NAME}. Technical partner: ${TECHNICAL_PARTNER_NAME}.`,
      },
    ],
  },
}

const RELATED_LINKS: { kind: LegalDocumentKind; href: typeof appRoutes.legalTerms; label: string }[] = [
  { kind: 'about', href: appRoutes.legalAbout, label: 'About us' },
  { kind: 'terms', href: appRoutes.legalTerms, label: 'Terms of use' },
  { kind: 'privacy', href: appRoutes.legalPrivacy, label: 'Privacy policy' },
  { kind: 'shipping', href: appRoutes.legalShipping, label: 'Shipping & exchange' },
  { kind: 'payment', href: appRoutes.legalPayment, label: 'Payment policy' },
  { kind: 'returns', href: appRoutes.legalReturns, label: 'Return & refund' },
  { kind: 'cookies', href: appRoutes.legalCookies, label: 'Cookies policy' },
  { kind: 'ads', href: appRoutes.legalAds, label: 'Interest-based ads' },
]

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
          {RELATED_LINKS.filter((link) => link.kind !== kind).map((link) => (
            <AppLink key={link.kind} href={link.href} asChild>
              <Text fontSize={14} color={ui.link} cursor="pointer" hoverStyle={{ textDecorationLine: 'underline' }}>
                {link.label}
              </Text>
            </AppLink>
          ))}
        </YStack>
      </YStack>
    </ScrollView>
  )
}
