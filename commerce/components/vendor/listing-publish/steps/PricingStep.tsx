import { YStack } from '~/components/ui'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import type { ProductStructure } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import { ProductStructurePricingPanel } from '~/commerce/components/vendor/listing-publish/steps/ProductStructurePricingPanel'

type PricingStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  currencySymbol: string
  isDesktop: boolean
  sellerCountryCode?: string | null
  panel?: 'full' | 'type-and-price' | 'variants'
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
  onUpdateMetadata: (key: string, value: unknown) => void
  onStructureChange?: (next: ProductStructure) => void
}

export function PricingStep({
  ui,
  formData,
  errors,
  currencySymbol,
  sellerCountryCode,
  panel = 'full',
  onUpdate,
  onUpdateMetadata,
  onStructureChange,
}: PricingStepProps) {
  return (
    <YStack flex={1} minWidth={280} gap="$4" width="100%">
      <ProductStructurePricingPanel
        ui={ui}
        formData={formData}
        errors={errors}
        currencySymbol={currencySymbol}
        sellerCountryCode={sellerCountryCode}
        panel={panel}
        onUpdate={onUpdate}
        onUpdateMetadata={onUpdateMetadata}
        onStructureChange={onStructureChange}
      />
    </YStack>
  )
}
