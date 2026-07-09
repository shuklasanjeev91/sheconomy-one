import { forwardRef } from 'react'
import type { GetProps } from 'tamagui'
import { Spinner as TSpinner } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

export const Spinner = forwardRef<any, GetProps<typeof TSpinner>>(function Spinner(props, ref) {
  return <TSpinner ref={ref} theme={BRAND_THEME} color="$color9" {...props} />
})

Spinner.displayName = 'Spinner'