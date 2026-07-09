import { useAuthUi } from '~/components/auth/auth-theme'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export type AuthMethod = 'email' | 'phone'

type AuthMethodToggleProps = {
  value: AuthMethod
  onChange: (value: AuthMethod) => void
}

const OPTIONS: Array<{ id: AuthMethod; label: string; hint: string; icon: typeof Icons.Mail }> = [
  { id: 'email', label: 'Email', hint: 'Inbox code', icon: Icons.Mail },
  { id: 'phone', label: 'Mobile', hint: 'SMS code', icon: Icons.Smartphone },
]

export function AuthMethodToggle({ value, onChange }: AuthMethodToggleProps) {
  const authUi = useAuthUi()
  const ui = useAppUi()

  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color={ui.textMuted} letterSpacing={0.8}>
        SIGN IN WITH
      </Text>
      <XStack
        padding={5}
        borderRadius={authUi.inputRadius}
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        gap={5}
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
              paddingVertical="$3"
              paddingHorizontal="$3"
              borderRadius={12}
              backgroundColor={active ? ui.surface : 'transparent'}
              borderWidth={active ? 1 : 0}
              borderColor={active ? ui.borderSubtle : 'transparent'}
              cursor="pointer"
              onPress={() => onChange(option.id)}
              style={
                active
                  ? { boxShadow: '0 4px 14px rgba(26, 10, 18, 0.06)' }
                  : undefined
              }
            >
              <YStack
                width={34}
                height={34}
                borderRadius={10}
                alignItems="center"
                justifyContent="center"
                backgroundColor={active ? authUi.chipBg : 'transparent'}
              >
                <option.icon size={17} color={active ? ui.brand : ui.textMuted} />
              </YStack>
              <YStack gap={1}>
                <Text fontSize={14} fontWeight="700" color={active ? ui.text : ui.textMuted}>
                  {option.label}
                </Text>
                <Text fontSize={11} fontWeight="500" color={active ? ui.textSecondary : ui.textMuted}>
                  {option.hint}
                </Text>
              </YStack>
            </XStack>
          )
        })}
      </XStack>
    </YStack>
  )
}

type AuthStepIndicatorProps = {
  step: 1 | 2
}

export function AuthStepIndicator({ step }: AuthStepIndicatorProps) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$2"
      alignItems="center"
      width="100%"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius={14}
      backgroundColor={ui.surfaceMuted}
      borderWidth={1}
      borderColor={ui.borderSubtle}
    >
      <StepPill number={1} label="Contact" active={step >= 1} current={step === 1} />
      <YStack flex={1} height={2} backgroundColor={ui.borderSubtle} borderRadius={2} overflow="hidden">
        <YStack
          height="100%"
          width={step >= 2 ? '100%' : '0%'}
          backgroundColor={ui.brand}
          borderRadius={2}
        />
      </YStack>
      <StepPill number={2} label="Verify" active={step >= 2} current={step === 2} />
    </XStack>
  )
}

function StepPill({
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
  const authUi = useAuthUi()
  const ui = useAppUi()

  return (
    <XStack gap="$2" alignItems="center">
      <YStack
        width={26}
        height={26}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={active ? ui.brand : authUi.stepInactive}
      >
        <Text fontSize={12} fontWeight="800" color={active ? ui.onBrand : authUi.stepText}>
          {number}
        </Text>
      </YStack>
      <Text
        fontSize={12}
        fontWeight={current ? '700' : '600'}
        color={current ? ui.text : authUi.stepText}
        display="none"
        $gtSm={{ display: 'flex' }}
      >
        {label}
      </Text>
    </XStack>
  )
}