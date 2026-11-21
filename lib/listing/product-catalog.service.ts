/**
 * Load and replace Amazon-style listing children: product type, identifiers,
 * typed attributes, compliance files, A+ modules, shipping template, return policy.
 */

import { supabase } from '~/lib/supabase'
import { STORAGE_BUCKETS, uploadStorageObject } from '~/lib/supabase/storage-upload'

import { fail, ok } from '~/lib/listing/listing.access'
import type { ListingServiceResponse } from '~/lib/listing/listing.type'
import type { ListingFormData } from '~/lib/listing/listing.type'
import {
  parseVariationThemes,
  type ListingAplusModuleDraft,
  type ListingAttributeValueDraft,
  type ListingComplianceDocumentDraft,
  type ListingProductIdentifierDraft,
  type ProductTypeCatalog,
  type ProductTypeAttributeDef,
  type AttributeDataType,
} from '~/lib/listing/product-catalog'

const COMPLIANCE_BUCKET = 'listing-compliance'

function asDataType(value: string): AttributeDataType {
  const allowed: AttributeDataType[] = [
    'text',
    'number',
    'boolean',
    'enum',
    'multi_enum',
    'measurement',
    'date',
  ]
  return allowed.includes(value as AttributeDataType) ? (value as AttributeDataType) : 'text'
}

type AttributeRow = {
  id: string
  product_type_id: string
  code: string
  label: string
  description: string | null
  data_type: string
  unit: string | null
  is_required: boolean
  is_recommended: boolean
  is_variation_axis: boolean
  max_length: number | null
  display_order: number
  product_type_attribute_options?: { value: string; label: string; display_order: number }[] | null
}

function toAttributeDef(row: AttributeRow): ProductTypeAttributeDef {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    data_type: asDataType(row.data_type),
    unit: row.unit,
    is_required: row.is_required,
    is_recommended: row.is_recommended,
    is_variation_axis: row.is_variation_axis,
    max_length: row.max_length,
    display_order: row.display_order,
    options: [...(row.product_type_attribute_options ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    ),
  }
}

export async function listActiveProductTypes(): Promise<
  ListingServiceResponse<
    { id: string; code: string; name: string; family: string; category_id: string | null }[]
  >
> {
  try {
    const { data, error } = await supabase
      .from('product_types')
      .select('id, code, name, family, category_id')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

export async function getProductTypeCatalog(
  productTypeId: string,
): Promise<ListingServiceResponse<ProductTypeCatalog | null>> {
  if (!productTypeId) return ok(null)
  try {
    const { data: typeRow, error } = await supabase
      .from('product_types')
      .select('id, code, name, family, category_id, variation_themes')
      .eq('id', productTypeId)
      .maybeSingle()
    if (error) return fail(error)
    if (!typeRow) return ok(null)

    const [{ data: attributes, error: attrError }, { data: compliance, error: complianceError }] =
      await Promise.all([
        supabase
          .from('product_type_attributes')
          .select(
            'id, product_type_id, code, label, description, data_type, unit, is_required, is_recommended, is_variation_axis, max_length, display_order, product_type_attribute_options(value, label, display_order)',
          )
          .eq('product_type_id', productTypeId)
          .order('display_order', { ascending: true }),
        supabase
          .from('product_type_compliance_requirements')
          .select('id, code, label, description, is_required, document_types, display_order')
          .eq('product_type_id', productTypeId)
          .order('display_order', { ascending: true }),
      ])
    if (attrError) return fail(attrError)
    if (complianceError) return fail(complianceError)

    return ok({
      id: typeRow.id,
      code: typeRow.code,
      name: typeRow.name,
      family: typeRow.family,
      category_id: typeRow.category_id,
      variationThemes: parseVariationThemes(typeRow.variation_themes),
      attributes: ((attributes ?? []) as AttributeRow[]).map(toAttributeDef),
      compliance: (compliance ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        label: row.label,
        description: row.description,
        is_required: row.is_required,
        document_types: row.document_types ?? [],
        display_order: row.display_order,
      })),
    })
  } catch (error) {
    return fail(error)
  }
}

export type ListingCatalogChildren = {
  productIdentifier: ListingProductIdentifierDraft
  variationIdentifiers: ListingProductIdentifierDraft[]
  attributeValues: ListingAttributeValueDraft[]
  complianceDocuments: ListingComplianceDocumentDraft[]
  aplusModules: ListingAplusModuleDraft[]
  deliveryProfileId: string | null
  returnPolicyId: string | null
}

export async function loadListingCatalogChildren(
  listingId: string,
): Promise<ListingServiceResponse<ListingCatalogChildren>> {
  const empty: ListingCatalogChildren = {
    productIdentifier: {
      product_id_type: 'none',
      product_id_value: '',
      gtin_exemption: false,
      gtin_exemption_reason: null,
    },
    variationIdentifiers: [],
    attributeValues: [],
    complianceDocuments: [],
    aplusModules: [],
    deliveryProfileId: null,
    returnPolicyId: null,
  }
  if (!listingId) return ok(empty)

  try {
    const [identifiers, values, documents, modules, delivery, returns] = await Promise.all([
      supabase.from('listing_product_identifiers').select('*').eq('listing_id', listingId),
      supabase.from('listing_attribute_values').select('*').eq('listing_id', listingId),
      supabase.from('listing_compliance_documents').select('*').eq('listing_id', listingId),
      supabase
        .from('listing_aplus_modules')
        .select('*')
        .eq('listing_id', listingId)
        .order('display_order', { ascending: true }),
      supabase
        .from('listing_delivery_profiles')
        .select('delivery_profile_id')
        .eq('listing_id', listingId)
        .limit(1),
      supabase
        .from('listing_return_policies')
        .select('return_policy_id')
        .eq('listing_id', listingId)
        .limit(1),
    ])
    const firstError =
      identifiers.error ||
      values.error ||
      documents.error ||
      modules.error ||
      delivery.error ||
      returns.error
    if (firstError) return fail(firstError)

    const parent = (identifiers.data ?? []).find((row) => !row.variation_id)
    const children = (identifiers.data ?? []).filter((row) => row.variation_id)

    return ok({
      productIdentifier: parent
        ? {
            product_id_type: parent.product_id_type as ListingProductIdentifierDraft['product_id_type'],
            product_id_value: parent.product_id_value,
            gtin_exemption: parent.gtin_exemption,
            gtin_exemption_reason: parent.gtin_exemption_reason,
          }
        : empty.productIdentifier,
      variationIdentifiers: children.map((row) => ({
        product_id_type: row.product_id_type as ListingProductIdentifierDraft['product_id_type'],
        product_id_value: row.product_id_value,
        gtin_exemption: row.gtin_exemption,
        gtin_exemption_reason: row.gtin_exemption_reason,
        variation_id: row.variation_id,
      })),
      attributeValues: (values.data ?? []).map((row) => ({
        id: row.id,
        attribute_id: row.attribute_id,
        value_text: row.value_text,
        value_number: row.value_number,
        value_boolean: row.value_boolean,
        value_json: row.value_json,
        variation_id: row.variation_id,
      })),
      complianceDocuments: (documents.data ?? []).map((row) => ({
        id: row.id,
        requirement_code: row.requirement_code,
        document_type: row.document_type,
        file_url: row.file_url,
        file_name: row.file_name,
        expires_on: row.expires_on,
        notes: row.notes,
      })),
      aplusModules: (modules.data ?? []).map((row) => ({
        id: row.id,
        module_type: row.module_type as ListingAplusModuleDraft['module_type'],
        display_order: row.display_order,
        headline: row.headline,
        body: row.body,
        image_url: row.image_url,
        payload: (row.payload as Record<string, unknown> | null) ?? {},
      })),
      deliveryProfileId: delivery.data?.[0]?.delivery_profile_id ?? null,
      returnPolicyId: returns.data?.[0]?.return_policy_id ?? null,
    })
  } catch (error) {
    return fail(error)
  }
}

async function uploadComplianceFile(
  shopId: string,
  listingId: string,
  file: Blob | File,
  mimeType: string,
): Promise<{ path: string; fileName: string } | { error: string }> {
  const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg'
  const path = `${shopId}/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const uploaded = await uploadStorageObject(COMPLIANCE_BUCKET, path, file, mimeType, {
    maxBytes: 10 * 1024 * 1024,
  })
  if (uploaded.error || !uploaded.data) return { error: uploaded.error ?? 'Could not upload the document.' }
  const fileName = file instanceof File && file.name ? file.name : `document.${ext}`
  return { path: uploaded.data.path, fileName }
}

async function uploadAplusImage(
  listingId: string,
  file: Blob | File,
  mimeType: string,
): Promise<{ url: string } | { error: string }> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `aplus/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const uploaded = await uploadStorageObject(STORAGE_BUCKETS.listingImages, path, file, mimeType)
  if (uploaded.error || !uploaded.data) return { error: uploaded.error ?? 'Could not upload the A+ image.' }
  return { url: uploaded.data.publicUrl }
}

function identifierRow(
  listingId: string,
  draft: ListingProductIdentifierDraft,
  variationId: string | null,
) {
  return {
    listing_id: listingId,
    variation_id: variationId,
    product_id_type: draft.product_id_type || 'none',
    product_id_value: draft.product_id_value?.trim() || null,
    gtin_exemption: Boolean(draft.gtin_exemption),
    gtin_exemption_reason: draft.gtin_exemption ? draft.gtin_exemption_reason || null : null,
  }
}

/**
 * Replace catalog children that are present on the form. Variations must already
 * exist so child barcodes can bind `variation_id` via `tempKeyToVariationId`.
 */
export async function replaceListingCatalog(
  listingId: string,
  formData: Partial<ListingFormData>,
  shopId: string | null | undefined,
  tempKeyToVariationId: Map<string, string> = new Map(),
): Promise<ListingServiceResponse<{ listingId: string }>> {
  try {
    if (formData.product_identifier || Array.isArray(formData.variation_identifiers)) {
      const { error } = await supabase
        .from('listing_product_identifiers')
        .delete()
        .eq('listing_id', listingId)
      if (error) return fail(error)

      const rows = []
      if (formData.product_identifier) {
        const parent = formData.product_identifier
        const hasValue =
          Boolean(parent.product_id_value?.trim()) ||
          Boolean(parent.gtin_exemption) ||
          parent.product_id_type !== 'none'
        if (hasValue) rows.push(identifierRow(listingId, parent, null))
      }
      for (const child of formData.variation_identifiers ?? []) {
        const variationId =
          child.variation_id ||
          (child.variant_temp_key ? tempKeyToVariationId.get(child.variant_temp_key) ?? null : null)
        if (!variationId) continue
        if (!child.product_id_value?.trim() && !child.gtin_exemption) continue
        rows.push(identifierRow(listingId, child, variationId))
      }
      if (rows.length) {
        const { error: insertError } = await supabase.from('listing_product_identifiers').insert(rows)
        if (insertError) return fail(insertError)
      }
    }

    if (Array.isArray(formData.attribute_values)) {
      const { error } = await supabase.from('listing_attribute_values').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      const rows = formData.attribute_values
        .filter((row) => row.attribute_id)
        .map((row) => ({
          listing_id: listingId,
          attribute_id: row.attribute_id,
          variation_id: row.variation_id ?? null,
          value_text: row.value_text?.trim() || null,
          value_number:
            row.value_number === '' || row.value_number == null ? null : Number(row.value_number),
          value_boolean: typeof row.value_boolean === 'boolean' ? row.value_boolean : null,
          value_json: (row.value_json ?? null) as never,
        }))
      if (rows.length) {
        const { error: insertError } = await supabase.from('listing_attribute_values').insert(rows)
        if (insertError) return fail(insertError)
      }
    }

    if (Array.isArray(formData.compliance_documents)) {
      const prepared: ListingComplianceDocumentDraft[] = []
      for (const doc of formData.compliance_documents) {
        if (doc.blob && doc.mimeType) {
          if (!shopId) return fail('A shop is required to upload compliance documents.')
          const uploaded = await uploadComplianceFile(shopId, listingId, doc.blob, doc.mimeType)
          if ('error' in uploaded) return fail(uploaded.error)
          prepared.push({
            ...doc,
            file_url: uploaded.path,
            file_name: doc.file_name || uploaded.fileName,
            blob: undefined,
          })
        } else if (doc.file_url?.trim()) {
          prepared.push(doc)
        }
      }
      const { error } = await supabase
        .from('listing_compliance_documents')
        .delete()
        .eq('listing_id', listingId)
      if (error) return fail(error)
      if (prepared.length) {
        const { error: insertError } = await supabase.from('listing_compliance_documents').insert(
          prepared.map((doc) => ({
            listing_id: listingId,
            requirement_code: doc.requirement_code,
            document_type: doc.document_type,
            file_url: doc.file_url ?? '',
            file_name: doc.file_name ?? null,
            expires_on: doc.expires_on || null,
            notes: doc.notes ?? null,
          })),
        )
        if (insertError) return fail(insertError)
      }
    }

    if (Array.isArray(formData.aplus_modules)) {
      const prepared: ListingAplusModuleDraft[] = []
      for (const [index, module] of formData.aplus_modules.entries()) {
        let imageUrl = module.image_url ?? null
        if (module.blob && module.mimeType) {
          const uploaded = await uploadAplusImage(listingId, module.blob, module.mimeType)
          if ('error' in uploaded) return fail(uploaded.error)
          imageUrl = uploaded.url
        }
        prepared.push({ ...module, image_url: imageUrl, display_order: module.display_order ?? index })
      }
      const { error } = await supabase.from('listing_aplus_modules').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      if (prepared.length) {
        const { error: insertError } = await supabase.from('listing_aplus_modules').insert(
          prepared.map((module, index) => ({
            listing_id: listingId,
            module_type: module.module_type,
            display_order: module.display_order ?? index,
            headline: module.headline ?? null,
            body: module.body ?? null,
            image_url: module.image_url ?? null,
            payload: (module.payload ?? {}) as never,
          })),
        )
        if (insertError) return fail(insertError)
      }
    }

    if ('delivery_profile_id' in formData) {
      const { error } = await supabase.from('listing_delivery_profiles').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      if (formData.delivery_profile_id) {
        const { error: insertError } = await supabase.from('listing_delivery_profiles').insert({
          listing_id: listingId,
          delivery_profile_id: formData.delivery_profile_id,
        })
        if (insertError) return fail(insertError)
      }
    }

    if ('return_policy_id' in formData) {
      const { error } = await supabase.from('listing_return_policies').delete().eq('listing_id', listingId)
      if (error) return fail(error)
      if (formData.return_policy_id) {
        const { error: insertError } = await supabase.from('listing_return_policies').insert({
          listing_id: listingId,
          return_policy_id: formData.return_policy_id,
        })
        if (insertError) return fail(insertError)
      }
    }

    return ok({ listingId })
  } catch (error) {
    return fail(error)
  }
}

export type AdminProductTypeInput = {
  id?: string
  code: string
  name: string
  description?: string | null
  family?: string
  category_id?: string | null
  is_active?: boolean
}

export async function adminUpsertProductType(input: AdminProductTypeInput) {
  const payload = {
    code: input.code.trim(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    family: input.family?.trim() || 'general',
    category_id: input.category_id || null,
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  }
  if (input.id) {
    return supabase.from('product_types').update(payload).eq('id', input.id).select('*').single()
  }
  return supabase.from('product_types').insert(payload).select('*').single()
}

export async function adminUpsertAttribute(input: {
  id?: string
  product_type_id: string
  code: string
  label: string
  data_type: string
  is_required?: boolean
  is_recommended?: boolean
  is_variation_axis?: boolean
  unit?: string | null
  display_order?: number
}) {
  const payload = {
    product_type_id: input.product_type_id,
    code: input.code.trim(),
    label: input.label.trim(),
    data_type: input.data_type,
    is_required: input.is_required ?? false,
    is_recommended: input.is_recommended ?? false,
    is_variation_axis: input.is_variation_axis ?? false,
    unit: input.unit?.trim() || null,
    display_order: input.display_order ?? 0,
    updated_at: new Date().toISOString(),
  }
  if (input.id) {
    return supabase.from('product_type_attributes').update(payload).eq('id', input.id).select('*').single()
  }
  return supabase.from('product_type_attributes').insert(payload).select('*').single()
}

export async function adminReplaceAttributeOptions(
  attributeId: string,
  options: { value: string; label: string }[],
) {
  const { error } = await supabase
    .from('product_type_attribute_options')
    .delete()
    .eq('attribute_id', attributeId)
  if (error) return { error }
  if (!options.length) return { error: null }
  return supabase.from('product_type_attribute_options').insert(
    options.map((option, index) => ({
      attribute_id: attributeId,
      value: option.value.trim(),
      label: option.label.trim() || option.value.trim(),
      display_order: index,
    })),
  )
}

export async function adminDeleteAttribute(attributeId: string) {
  return supabase.from('product_type_attributes').delete().eq('id', attributeId)
}

export async function adminUpsertCompliance(input: {
  id?: string
  product_type_id: string
  code: string
  label: string
  description?: string | null
  is_required?: boolean
  document_types?: string[]
  display_order?: number
}) {
  const payload = {
    product_type_id: input.product_type_id,
    code: input.code.trim(),
    label: input.label.trim(),
    description: input.description?.trim() || null,
    is_required: input.is_required ?? false,
    document_types: input.document_types ?? [],
    display_order: input.display_order ?? 0,
  }
  if (input.id) {
    return supabase
      .from('product_type_compliance_requirements')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
  }
  return supabase.from('product_type_compliance_requirements').insert(payload).select('*').single()
}

export async function adminDeleteCompliance(id: string) {
  return supabase.from('product_type_compliance_requirements').delete().eq('id', id)
}

export async function listProductTypesForAdmin() {
  return supabase
    .from('product_types')
    .select(
      'id, code, name, description, family, category_id, is_active, variation_themes, product_type_attributes(id, code, label, data_type, is_required, is_recommended, is_variation_axis, unit, display_order, product_type_attribute_options(value, label, display_order)), product_type_compliance_requirements(id, code, label, description, is_required, document_types, display_order)',
    )
    .order('name', { ascending: true })
}
