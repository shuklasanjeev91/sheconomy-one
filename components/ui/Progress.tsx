import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { Progress as TProgress } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnyProgressIndicator = TProgress.Indicator as unknown as ComponentType<any>

export const Progress = forwardRef<any, GetProps<typeof TProgress>>(function Progress(
  props,
  ref
) {
  return (
    <TProgress
      ref={ref}
      theme={BRAND_THEME}
      size="$2"
      backgroundColor="$color4"
      borderRadius="$10"
      {...props}
    >
      <AnyProgressIndicator animation="medium" backgroundColor="$color9" borderRadius="$10" />
    </TProgress>
  )
})

Progress.displayName = 'Progress'