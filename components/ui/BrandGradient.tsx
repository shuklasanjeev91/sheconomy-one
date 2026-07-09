import type { GetProps } from 'tamagui'
import { LinearGradient } from 'tamagui/linear-gradient'
import { gradients } from '~/config/tokens'

export type BrandGradientProps = Omit<GetProps<typeof LinearGradient>, 'colors'> & {
  variant?: keyof typeof gradients
}

/** Hero/marketing surfaces — a themed gradient using our brand token stops. */
export function BrandGradient({ variant = 'brand', ...props }: BrandGradientProps) {
  return (
    <LinearGradient
      colors={gradients[variant] as unknown as string[]}
      start={[0, 0]}
      end={[1, 1]}
      {...props}
    />
  )
}