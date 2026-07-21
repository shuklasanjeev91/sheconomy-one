import { AUTH_LAYOUT } from '~/components/auth/auth-layout'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export type AuthMethod = 'email' | 'phone'

type AuthMethodTabsProps = {
  value: AuthMethod
  onChange: (value: AuthMethod) => void
}

const OPTIONS: Array<{ id: AuthMethod; label: string; icon: typeof Icons.Mail }> = [
  { id: 'email', label: 'Email', icon: Icons.Mail },
  { id: 'phone', label: 'Mobile', icon: Icons.Smartphone },
]

/** Segmented email / phone toggle — works on web, iOS, and Android. */
export function AuthMethodTabs({ value, onChange }: AuthMethodTabsProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color={ui.textMuted} letterSpacing={0.6}>
        SIGN IN WITH
      </Text>
      <XStack
        padding={4}
        borderRadius={AUTH_LAYOUT.inputRadius}
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        gap={4}
      >
        {OPTIONS.map((option) => {
          const active = value === option.id
          return (
            <XStack
              key={option.id}
              flex={1}
              alignItems="center"
              justifyContent="center"
              gap="$2"
              paddingVertical="$2.5"
              minHeight={44}
              borderRadius={10}
              backgroundColor={active ? ui.surface : 'transparent'}
              borderWidth={active ? 1 : 0}
              borderColor={active ? ui.borderSubtle : 'transparent'}
              cursor="pointer"
              animation="quick"
              pressStyle={{ scale: 0.98, opacity: 0.9 }}
              hoverStyle={{ backgroundColor: active ? ui.surface : ui.surfaceHover }}
              role="tab"
              aria-selected={active}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Sign in with ${option.label}`}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              onPress={() => {
                if (option.id !== value) onChange(option.id)
              }}
            >
              <option.icon size={17} color={active ? ui.brand : ui.textMuted} />
              <Text fontSize={14} fontWeight="700" color={active ? ui.text : ui.textMuted}>
                {option.label}
              </Text>
            </XStack>
          )
        })}
      </XStack>
    </YStack>
  )
}

type AuthStepProgressProps = {
  step: 1 | 2
}

export function AuthStepProgress({ step }: AuthStepProgressProps) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$2"
      alignItems="center"
      width="100%"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius={AUTH_LAYOUT.inputRadius}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.borderSubtle}
    >
      <StepDot number={1} label="Contact" active={step >= 1} current={step === 1} />
      <YStack flex={1} height={2} backgroundColor={ui.borderSubtle} borderRadius={2} overflow="hidden">
        <YStack height="100%" width={step >= 2 ? '100%' : '0%'} backgroundColor={ui.brand} />
      </YStack>
      <StepDot number={2} label="Verify" active={step >= 2} current={step === 2} />
    </XStack>
  )
}

function StepDot({
  number,
  label,
  active,
  current,
}: {
  number: number
  label: string
  active: boolean
  current: boolean
}) {
  const ui = useAppUi()

  return (
    <XStack gap="$2" alignItems="center">
      <YStack
        width={26}
        height={26}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={active ? ui.brand : ui.borderSubtle}
      >
        <Text fontSize={12} fontWeight="800" color={active ? ui.onBrand : ui.textMuted}>
          {number}
        </Text>
      </YStack>
      <Text
        fontSize={12}
        fontWeight={current ? '700' : '600'}
        color={current ? ui.text : ui.textMuted}
        display="none"
        $gtSm={{ display: 'flex' }}
      >
        {label}
      </Text>
    </XStack>
  )
}
