import { useCallback, useEffect, useState } from 'react'

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Switch,
  Text,
  TextArea,
  Icons,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import {
  adminDeleteAttribute,
  adminDeleteCompliance,
  adminReplaceAttributeOptions,
  adminUpsertAttribute,
  adminUpsertCompliance,
  adminUpsertProductType,
  listProductTypesForAdmin,
} from '~/lib/listing/product-catalog.service'

type OptionRow = { value: string; label: string; display_order: number }
type AttributeRow = {
  id: string
  code: string
  label: string
  data_type: string
  is_required: boolean
  is_recommended: boolean
  is_variation_axis: boolean
  unit: string | null
  display_order: number
  product_type_attribute_options: OptionRow[] | null
}
type ComplianceRow = {
  id: string
  code: string
  label: string
  description: string | null
  is_required: boolean
  document_types: string[]
  display_order: number
}
type ProductTypeRow = {
  id: string
  code: string
  name: string
  description: string | null
  family: string
  category_id: string | null
  is_active: boolean
  product_type_attributes: AttributeRow[] | null
  product_type_compliance_requirements: ComplianceRow[] | null
}

const DATA_TYPES = ['text', 'number', 'boolean', 'enum', 'multi_enum', 'measurement', 'date']

export function ProductTypeCatalogPanel() {
  const toast = useAppToast()
  const [types, setTypes] = useState<ProductTypeRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const selected = types.find((row) => row.id === selectedId) ?? null

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listProductTypesForAdmin()
    if (error) {
      toast.show('Could not load product types', { tone: 'danger', message: error.message })
      setLoading(false)
      return
    }
    const rows = (data ?? []) as ProductTypeRow[]
    setTypes(rows)
    setSelectedId((current) => current ?? rows[0]?.id ?? null)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  async function saveType(patch: Partial<ProductTypeRow>) {
    if (!selected) return
    setSaving(true)
    const { error } = await adminUpsertProductType({
      id: selected.id,
      code: patch.code ?? selected.code,
      name: patch.name ?? selected.name,
      description: patch.description ?? selected.description,
      family: patch.family ?? selected.family,
      category_id: selected.category_id,
      is_active: patch.is_active ?? selected.is_active,
    })
    setSaving(false)
    if (error) {
      toast.show('Could not save product type', { tone: 'danger', message: error.message })
      return
    }
    await reload()
  }

  async function saveAttribute(attribute: AttributeRow, optionsText: string) {
    setSaving(true)
    const { error } = await adminUpsertAttribute({
      id: attribute.id,
      product_type_id: selected!.id,
      code: attribute.code,
      label: attribute.label,
      data_type: attribute.data_type,
      is_required: attribute.is_required,
      is_recommended: attribute.is_recommended,
      is_variation_axis: attribute.is_variation_axis,
      unit: attribute.unit,
      display_order: attribute.display_order,
    })
    if (!error) {
      const options = optionsText
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((label) => ({ value: label, label }))
      const replaced = await adminReplaceAttributeOptions(attribute.id, options)
      if (replaced.error) {
        toast.show('Could not save options', { tone: 'danger', message: replaced.error.message })
      }
    } else {
      toast.show('Could not save attribute', { tone: 'danger', message: error.message })
    }
    setSaving(false)
    await reload()
  }

  async function addAttribute() {
    if (!selected) return
    const code = `custom_${Date.now().toString(36)}`
    const { error } = await adminUpsertAttribute({
      product_type_id: selected.id,
      code,
      label: 'New attribute',
      data_type: 'text',
      display_order: (selected.product_type_attributes?.length ?? 0) + 1,
    })
    if (error) toast.show('Could not add attribute', { tone: 'danger', message: error.message })
    else await reload()
  }

  async function removeAttribute(id: string) {
    const { error } = await adminDeleteAttribute(id)
    if (error) toast.show('Could not delete attribute', { tone: 'danger', message: error.message })
    else await reload()
  }

  async function addCompliance() {
    if (!selected) return
    const { error } = await adminUpsertCompliance({
      product_type_id: selected.id,
      code: `doc_${Date.now().toString(36)}`,
      label: 'New document',
      is_required: false,
      document_types: ['pdf'],
      display_order: (selected.product_type_compliance_requirements?.length ?? 0) + 1,
    })
    if (error) toast.show('Could not add requirement', { tone: 'danger', message: error.message })
    else await reload()
  }

  if (loading && types.length === 0) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner />
      </YStack>
    )
  }

  return (
    <YStack gap="$3" padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius={radius.card} backgroundColor="$background">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={18} fontWeight="800">Product types</Text>
          <Text color="$color10" fontSize={13}>
            Required attributes and compliance documents sellers fill when they list a product.
          </Text>
        </YStack>
        <Text fontSize={12} color="$color10">{saving ? 'Saving…' : `${types.length} types`}</Text>
      </XStack>

      {types.length > 0 ? (
      <Select value={selectedId ?? types[0]!.id} onValueChange={setSelectedId}>
        <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={14} />}>
          <Select.Value placeholder="Choose a product type" />
        </SelectTrigger>
        <SelectContent zIndex={300000}>
          <SelectViewport>
            {types.map((type, index) => (
              <SelectItem key={type.id} index={index} value={type.id}>
                <Select.ItemText>
                  {type.name} · {type.family}
                </Select.ItemText>
              </SelectItem>
            ))}
          </SelectViewport>
        </SelectContent>
      </Select>
      ) : (
        <Text color="$color10" fontSize={13}>
          No product types yet. They appear after the catalog migration seeds one type per top-level category.
        </Text>
      )}

      {selected ? (
        <YStack gap="$3">
          <XStack gap="$2" flexWrap="wrap">
            <Input
              flex={1}
              minWidth={180}
              value={selected.name}
              onChangeText={(name) =>
                setTypes((rows) => rows.map((row) => (row.id === selected.id ? { ...row, name } : row)))
              }
              onBlur={() => void saveType({ name: selected.name })}
            />
            <XStack alignItems="center" gap="$2">
              <Text fontSize={13}>Active</Text>
              <Switch
                checked={selected.is_active}
                onCheckedChange={(checked) => void saveType({ is_active: Boolean(checked) })}
              />
            </XStack>
          </XStack>
          <TextArea
            minHeight={64}
            value={selected.description ?? ''}
            onChangeText={(description) =>
              setTypes((rows) => rows.map((row) => (row.id === selected.id ? { ...row, description } : row)))
            }
            onBlur={() => void saveType({ description: selected.description })}
          />

          <XStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="800">Attributes</Text>
            <Button size="$2" tone="outline" onPress={() => void addAttribute()}>
              Add attribute
            </Button>
          </XStack>
          {(selected.product_type_attributes ?? [])
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((attribute) => (
              <AttributeEditor
                key={attribute.id}
                attribute={attribute}
                onSave={(next, options) => void saveAttribute(next, options)}
                onDelete={() => void removeAttribute(attribute.id)}
              />
            ))}

          <XStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="800">Compliance documents</Text>
            <Button size="$2" tone="outline" onPress={() => void addCompliance()}>
              Add document
            </Button>
          </XStack>
          {(selected.product_type_compliance_requirements ?? []).map((requirement) => (
            <ComplianceEditor
              key={requirement.id}
              requirement={requirement}
              onSave={async (next) => {
                const { error } = await adminUpsertCompliance({ ...next, product_type_id: selected.id })
                if (error) toast.show('Could not save document', { tone: 'danger', message: error.message })
                else await reload()
              }}
              onDelete={async () => {
                const { error } = await adminDeleteCompliance(requirement.id)
                if (error) toast.show('Could not delete document', { tone: 'danger', message: error.message })
                else await reload()
              }}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}

function AttributeEditor({
  attribute,
  onSave,
  onDelete,
}: {
  attribute: AttributeRow
  onSave: (attribute: AttributeRow, options: string) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(attribute.label)
  const [dataType, setDataType] = useState(attribute.data_type)
  const [required, setRequired] = useState(attribute.is_required)
  const [options, setOptions] = useState(
    (attribute.product_type_attribute_options ?? [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .map((option) => option.label)
      .join(', '),
  )

  return (
    <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius={radius.card}>
      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Input flex={1} minWidth={140} value={label} onChangeText={setLabel} />
        <Select value={dataType} onValueChange={setDataType}>
          <SelectTrigger width={150} iconAfter={<Icons.ChevronDown size={14} />}>
            <Select.Value />
          </SelectTrigger>
          <SelectContent zIndex={300000}>
            <SelectViewport>
              {DATA_TYPES.map((type, index) => (
                <SelectItem key={type} index={index} value={type}>
                  <Select.ItemText>{type}</Select.ItemText>
                </SelectItem>
              ))}
            </SelectViewport>
          </SelectContent>
        </Select>
        <XStack alignItems="center" gap="$2">
          <Text fontSize={12}>Required</Text>
          <Switch checked={required} onCheckedChange={(checked) => setRequired(Boolean(checked))} />
        </XStack>
        <Button
          size="$2"
          onPress={() =>
            onSave(
              { ...attribute, label, data_type: dataType, is_required: required },
              options,
            )
          }
        >
          Save
        </Button>
        <Button size="$2" tone="ghost" onPress={onDelete}>
          Delete
        </Button>
      </XStack>
      {dataType === 'enum' || dataType === 'multi_enum' ? (
        <Input value={options} onChangeText={setOptions} placeholder="Options, comma separated" />
      ) : null}
      <Text fontSize={11} color="$color10">
        Code {attribute.code}
      </Text>
    </YStack>
  )
}

function ComplianceEditor({
  requirement,
  onSave,
  onDelete,
}: {
  requirement: ComplianceRow
  onSave: (next: ComplianceRow) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(requirement.label)
  const [required, setRequired] = useState(requirement.is_required)
  const [documents, setDocuments] = useState(requirement.document_types.join(', '))

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center">
      <Input flex={1} minWidth={160} value={label} onChangeText={setLabel} />
      <Input flex={1} minWidth={160} value={documents} onChangeText={setDocuments} placeholder="pdf, lab_report" />
      <XStack alignItems="center" gap="$2">
        <Text fontSize={12}>Required</Text>
        <Switch checked={required} onCheckedChange={(checked) => setRequired(Boolean(checked))} />
      </XStack>
      <Button
        size="$2"
        onPress={() =>
          onSave({
            ...requirement,
            label,
            is_required: required,
            document_types: documents.split(',').map((part) => part.trim()).filter(Boolean),
          })
        }
      >
        Save
      </Button>
      <Button size="$2" tone="ghost" onPress={onDelete}>
        Delete
      </Button>
    </XStack>
  )
}
