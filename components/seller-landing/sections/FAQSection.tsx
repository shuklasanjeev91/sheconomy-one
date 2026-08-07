import { Platform } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const FAQS = [
  {
    q: 'Is it really free? No commission ever?',
    a: `Yes — 100% free. No commission, no hidden fees, no subscription. ${BRAND_NAME} earns through optional premium tools and advertising, not by taking your money.`,
  },
  {
    q: 'Who can sell on SHEconomy?',
    a: 'Any woman entrepreneur — handmade crafts, fashion, food, digital products, or services. You must identify as a woman and pass a quick identity verification.',
  },
  {
    q: 'How does identity verification work?',
    a: "A secure one-time face liveness check. Blink or nod naturally in front of your camera. No photos are stored — only a verification result is saved. Under 60 seconds total.",
  },
  {
    q: 'How long to set up my shop?',
    a: "Most sellers are live within 10 minutes. Verify identity, pick a shop name and category, and you're ready to add products.",
  },
  {
    q: 'Can I import my existing catalog?',
    a: 'Yes! Bulk CSV and Excel import lets you migrate hundreds of products in one go. Each row maps to a listing — name, price, images, description, and more.',
  },
  {
    q: 'What payment methods do you support?',
    a: 'UPI, debit/credit cards, net banking, and popular wallets via major Indian payment gateways. Payouts are fast and direct to your account.',
  },
  {
    q: 'Do I need a GST number?',
    a: 'Only if your annual revenue exceeds ₹20 Lakh. Below that, sell without GST registration. We guide you through compliance as you grow.',
  },
  {
    q: 'What support is available?',
    a: `In-app chat, community forum, live workshops, and WhatsApp assistance. You're never alone building your business on ${BRAND_NAME}.`,
  },
]

const WHATSAPP_URL =
  'https://wa.me/918448991181?text=Hi, I have a question about selling on SHEconomy'

function openWhatsApp() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(WHATSAPP_URL, '_blank')
  }
}

/** FAQ item — numbered title + answer, terminated by a divider. */
function FaqRow({
  q,
  a,
  idx,
  desktop,
}: {
  q: string
  a: string
  idx: number
  desktop: boolean
}) {
  const ui = useAppUi()
  return (
    <YStack>
      <XStack gap="$4" alignItems="flex-start" paddingBottom="$4">
        <Text
          fontSize={desktop ? 40 : 32}
          fontWeight="900"
          color={ui.brand}
          lineHeight={desktop ? 44 : 36}
          minWidth={desktop ? 52 : 40}
          style={{ opacity: 0.18 } as object}
        >
          {String(idx + 1).padStart(2, '0')}
        </Text>
        <YStack flex={1} gap="$2" paddingTop="$0.5">
          <Text
            fontSize={desktop ? 16 : 15}
            fontWeight="800"
            color={ui.text}
            lineHeight={22}
          >
            {q}
          </Text>
          <Text fontSize={desktop ? 14 : 13} color={ui.textSecondary} lineHeight={22}>
            {a}
          </Text>
        </YStack>
      </XStack>
      <YStack borderTopWidth={1} borderColor="$borderColor" />
    </YStack>
  )
}

export function FAQSection() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  if (isDesktop) {
    const half = Math.ceil(FAQS.length / 2)
    const left = FAQS.slice(0, half)
    const right = FAQS.slice(half)

    return (
      <YStack paddingVertical={96} paddingHorizontal="$8" backgroundColor={ui.background}>
        <YStack maxWidth={1100} alignSelf="center" width="100%" gap="$12">

          {/* Centered heading — same pattern as all other sections */}
          <YStack gap="$3" alignItems="center">
            <XStack
              alignItems="center"
              gap="$2"
              backgroundColor={ui.roseSurface}
              paddingHorizontal="$3"
              paddingVertical="$1.5"
              borderRadius={radius.pill}
            >
              <Icons.HelpCircle size={13} color={ui.brand} />
              <Text fontSize={11} fontWeight="700" color={ui.brand}>
                FAQ
              </Text>
            </XStack>
            <Text fontSize={40} fontWeight="900" color={ui.text} textAlign="center" lineHeight={50}>
              Common questions{' '}
              <Text fontSize={40} fontWeight="900" color={ui.brand}>
                answered.
              </Text>
            </Text>
            <Text fontSize={16} color={ui.textSecondary} lineHeight={24} textAlign="center" maxWidth={520}>
              Everything you need to know before you start selling on {BRAND_NAME}.
            </Text>
          </YStack>

          {/* Two-column FAQ list */}
          <XStack gap="$10" alignItems="flex-start">
            <YStack flex={1} gap="$6">
              {left.map((faq, i) => (
                <FaqRow key={i} q={faq.q} a={faq.a} idx={i} desktop />
              ))}
            </YStack>
            <YStack flex={1} gap="$6">
              {right.map((faq, i) => (
                <FaqRow key={i} q={faq.q} a={faq.a} idx={i + half} desktop />
              ))}
            </YStack>
          </XStack>

          {/* Bottom CTA banner */}
          <XStack
            backgroundColor={ui.brand}
            borderRadius={radius.card}
            paddingHorizontal="$10"
            paddingVertical="$8"
            alignItems="center"
            justifyContent="space-between"
            gap="$5"
          >
            <YStack gap="$1.5" flex={1}>
              <Text fontSize={28} fontWeight="900" color="white">
                Still have questions?
              </Text>
              <Text fontSize={15} color="rgba(255,255,255,0.85)" lineHeight={24}>
                Our team replies on WhatsApp in minutes. We're here to help.
              </Text>
            </YStack>
            <XStack
              onPress={openWhatsApp}
              cursor="pointer"
              alignItems="center"
              gap="$2"
              borderWidth={2}
              borderColor="white"
              paddingHorizontal="$6"
              paddingVertical="$3"
              borderRadius={radius.pill}
              hoverStyle={{ backgroundColor: 'white' }}
              pressStyle={{ opacity: 0.85 }}
              flexShrink={0}
            >
              <Icons.MessageCircle size={18} color="white" />
              <Text fontWeight="700" color="white" fontSize={15}>
                Chat on WhatsApp
              </Text>
            </XStack>
          </XStack>

        </YStack>
      </YStack>
    )
  }

  // Mobile layout
  return (
    <YStack paddingVertical={64} paddingHorizontal="$4" backgroundColor={ui.background}>
      <YStack width="100%" gap="$10">

        {/* Centered heading */}
        <YStack gap="$3" alignItems="center">
          <XStack
            alignItems="center"
            gap="$2"
            backgroundColor={ui.roseSurface}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius={radius.pill}
          >
            <Icons.HelpCircle size={13} color={ui.brand} />
            <Text fontSize={11} fontWeight="700" color={ui.brand}>
              FAQ
            </Text>
          </XStack>
          <Text fontSize={28} fontWeight="900" color={ui.text} textAlign="center" lineHeight={36}>
            Common questions{' '}
            <Text fontSize={28} fontWeight="900" color={ui.brand}>
              answered.
            </Text>
          </Text>
          <Text fontSize={14} color={ui.textSecondary} lineHeight={24} textAlign="center">
            Everything you need to know before you start selling on {BRAND_NAME}.
          </Text>
        </YStack>

        {/* Single-column FAQ list */}
        <YStack gap="$6">
          {FAQS.map((faq, i) => (
            <FaqRow key={i} q={faq.q} a={faq.a} idx={i} desktop={false} />
          ))}
        </YStack>

        {/* Bottom CTA banner */}
        <XStack
          backgroundColor={ui.brand}
          borderRadius={radius.card}
          paddingHorizontal="$5"
          paddingVertical="$6"
          alignItems="flex-start"
          flexDirection="column"
          gap="$5"
        >
          <YStack gap="$1.5">
            <Text fontSize={22} fontWeight="900" color="white">
              Still have questions?
            </Text>
            <Text fontSize={13} color="rgba(255,255,255,0.85)" lineHeight={22}>
              Our team replies on WhatsApp in minutes.
            </Text>
          </YStack>
          <XStack
            onPress={openWhatsApp}
            cursor="pointer"
            alignItems="center"
            gap="$2"
            borderWidth={2}
            borderColor="white"
            paddingHorizontal="$5"
            paddingVertical="$3"
            borderRadius={radius.pill}
            pressStyle={{ opacity: 0.85 }}
          >
            <Icons.MessageCircle size={16} color="white" />
            <Text fontWeight="700" color="white" fontSize={14}>
              Chat on WhatsApp
            </Text>
          </XStack>
        </XStack>

      </YStack>
    </YStack>
  )
}
