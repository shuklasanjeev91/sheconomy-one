import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type StepId = 1 | 2 | 3 | 4

type StepConfig = {
  id: StepId
  label: string
  icon: keyof typeof Icons
}

const STEPS: StepConfig[] = [
  { id: 1, label: 'Verify', icon: 'Shield' },
  { id: 2, label: 'Face ID', icon: 'Camera' },
  { id: 3, label: 'Shop', icon: 'Store' },
  { id: 4, label: 'Products', icon: 'Package' },
]

type StepIndicatorProps = {
  currentStep: StepId
  visibleSteps: StepId[]
}

export function StepIndicator({ currentStep, visibleSteps }: StepIndicatorProps) {
  const ui = useAppUi()

  const filtered = STEPS.filter((s) => visibleSteps.includes(s.id))

  return (
    <XStack alignItems="center" justifyContent="center" paddingHorizontal="$2" paddingVertical="$4">
      {filtered.map((step, idx) => {
        const done = currentStep > step.id
        const active = currentStep === step.id
        const IconComp = Icons[step.icon] as React.ComponentType<{ size: number; color: string }>

        return (
          <XStack key={step.id} alignItems="center" flexShrink={0}>
            {/* Step circle */}
            <YStack alignItems="center" gap="$1.5">
              <YStack
                width={36}
                height={36}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={
                  done
                    ? '#f43f5e'
                    : active
                      ? ui.brand
                      : ui.surface
                }
                borderWidth={done || active ? 0 : 2}
                borderColor={ui.borderSubtle}
                scale={active ? 1.1 : 1}
                shadowColor={active ? ui.brand : 'transparent'}
                shadowOffset={{ width: 0, height: 4 }}
                shadowRadius={12}
                shadowOpacity={active ? 0.35 : 0}
              >
                {done ? (
                  <Icons.CheckCircle2 size={16} color="white" />
                ) : (
                  <IconComp size={16} color={active ? 'white' : ui.textMuted} />
                )}
              </YStack>
              <Text
                fontSize={9}
                fontWeight="700"
                letterSpacing={0.8}
                color={active ? ui.brand : done ? '#f43f5e' : ui.textMuted}
                textTransform="uppercase"
              >
                {step.label}
              </Text>
            </YStack>

            {/* Connector */}
            {idx < filtered.length - 1 && (
              <YStack
                width={40}
                height={2}
                marginHorizontal="$1.5"
                marginBottom="$4"
                borderRadius={1}
                backgroundColor={currentStep > step.id ? '#f43f5e' : ui.borderSubtle}
              />
            )}
          </XStack>
        )
      })}
    </XStack>
  )
}
