import { forwardRef } from 'react'
import type { GetProps } from 'tamagui'
import { Label as TLabel } from 'tamagui'

export const Label = forwardRef<any, GetProps<typeof TLabel>>(function Label(props, ref) {
  return <TLabel ref={ref} size="$4" fontWeight="600" color="$color12" {...props} />
})

Label.displayName = 'Label'