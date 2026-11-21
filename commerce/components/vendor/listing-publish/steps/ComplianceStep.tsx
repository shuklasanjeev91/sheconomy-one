import { useState } from 'react'

import { Button, Field, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { LISTING_TYPES } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import type { ListingComplianceDocumentDraft, ProductTypeCatalog } from '~/lib/listing/product-catalog'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { ListingPublishCard, ListingPublishFieldError } from '~/commerce/components/vendor/listing-publish/ListingPublishCard'

type ComplianceStepProps = {
  ui: AppUiTokens
  formData: ListingFormData
  errors: Record<string, string>
  catalog: ProductTypeCatalog | null
  onUpdate: <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => void
}

export function ComplianceStep({ ui, formData, errors, catalog, onUpdate }: ComplianceStepProps) {
  const toast = useAppToast()
  const [picking, setPicking] = useState<string | null>(null)
  const documents = formData.compliance_documents ?? []
  const isDigital = formData.listing_type === LISTING_TYPES.DIGITAL

  if (isDigital) {
    return (
      <ListingPublishCard ui={ui} title="Papers">
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          Downloads do not need a licence or certificate.
        </Text>
      </ListingPublishCard>
    )
  }

  const requirements = catalog?.compliance ?? []

  function upsert(requirementCode: string, patch: Partial<ListingComplianceDocumentDraft>) {
    const current = documents.find((doc) => doc.requirement_code === requirementCode)
    const next = documents.filter((doc) => doc.requirement_code !== requirementCode)
    onUpdate('compliance_documents', [
      ...next,
      {
        requirement_code: requirementCode,
        document_type: patch.document_type || current?.document_type || 'document',
        ...current,
        ...patch,
      },
    ])
  }

  async function pickFile(requirementCode: string, documentType: string) {
    setPicking(requirementCode)
    try {
      const { default: DocumentPicker } = await import('expo-document-picker')
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      upsert(requirementCode, {
        document_type: documentType,
        file_name: asset.name,
        mimeType: asset.mimeType || blob.type || 'application/pdf',
        blob,
        file_url: undefined,
      })
    } catch (error) {
      toast.show('Could not attach the document', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try a PDF or image under 10 MB.',
      })
    } finally {
      setPicking(null)
    }
  }

  return (
    <YStack gap="$4" width="100%">
      <ListingPublishCard ui={ui} title="Papers buyers or the law may ask for">
        {requirements.length === 0 ? (
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            This kind of product does not need extra papers. You can move on.
          </Text>
        ) : (
          requirements.map((requirement) => {
            const doc = documents.find((row) => row.requirement_code === requirement.code)
            const attached = Boolean(doc?.file_name || doc?.file_url)
            const documentType = requirement.document_types[0] || 'document'
            return (
              <YStack key={requirement.code} gap="$2" padding="$3" borderWidth={1} borderColor={ui.borderSubtle} borderRadius={10}>
                <Text fontSize={14} fontWeight="800" color={ui.text}>
                  {requirement.label}
                  {requirement.is_required ? ' · needed to publish' : ' · optional'}
                </Text>
                {requirement.description ? (
                  <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
                    {requirement.description}
                  </Text>
                ) : null}
                <Text fontSize={12} color={ui.textSecondary}>
                  A photo or PDF is fine{requirement.document_types.length ? ` (${requirement.document_types.join(', ')})` : ''}.
                </Text>
                <XStack gap="$2" flexWrap="wrap" alignItems="center">
                  <Button
                    tone="outline"
                    size="$3"
                    disabled={picking === requirement.code}
                    onPress={() => void pickFile(requirement.code, documentType)}
                  >
                    {attached ? 'Replace this paper' : 'Add a photo or PDF'}
                  </Button>
                  {attached ? (
                    <Text fontSize={12} color={ui.text} fontWeight="700">
                      {doc?.file_name || 'Uploaded'}
                    </Text>
                  ) : null}
                </XStack>
                <Field label="Expiry date, if this paper has one">
                  <Input
                    value={doc?.expires_on ?? ''}
                    onChangeText={(value) =>
                      upsert(requirement.code, { document_type: documentType, expires_on: value })
                    }
                    placeholder="2027-03-01"
                  />
                </Field>
                <ListingPublishFieldError ui={ui} message={errors[`compliance_${requirement.code}`]} />
              </YStack>
            )
          })
        )}
      </ListingPublishCard>
    </YStack>
  )
}
