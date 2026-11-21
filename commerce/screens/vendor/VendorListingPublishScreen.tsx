import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import { ListingPublishErrorBoundary } from '~/commerce/components/ListingPublishErrorBoundary'
import { PageCenter } from '~/components/layout'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { loadAttributes } from '~/lib/listing/listing-attributes.store'
import { loadImages } from '~/lib/listing/listing-images.store'
import { loadMaterials } from '~/lib/listing/listing-materials.store'
import { loadVariations } from '~/lib/listing/listing-variations.store'
import { loadListingCategories } from '~/lib/listing/listing-categories.store'
import {
  publishListing,
  resetPublishState,
  selectPublishProgressInfo,
} from '~/lib/listing/listing-publish.store'
import {
  getDefaultListingFormData,
  LISTING_STATUS,
  LISTING_TYPES,
  type ListingFormData,
  type ListingType,
} from '~/lib/listing/listing.type'
import { validateListingField } from '~/lib/listing/listing.validation'
import {
  loadFormFromListing,
  loadListingDetails,
  resetListingFormData,
  setListingStatus,
  updateListingField,
  updateListingWithDetails,
} from '~/lib/listing/listing.store'
import { toFriendlyListingError } from '~/lib/listing/listing.errors'
import { useShopPayuKyc } from '~/commerce/hooks/useShopPayuKyc'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { ListingEditorForm, scrollToListingSection } from '~/commerce/components/vendor/listing-publish/ListingEditorForm'
import { ListingPublishFooter } from '~/commerce/components/vendor/listing-publish/ListingPublishFooter'
import { ListingPublishPageHeader } from '~/commerce/components/vendor/listing-publish/ListingPublishStepNav'
import { LISTING_PUBLISH_COPY } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  buildFormFromListingDetails,
  ensureImageBlobsForPublish,
  findStepForErrors,
  formDataToPublishPayload,
  mergeListingMetadata,
  updateListingMetadataField,
  validateDraftForm,
  validateFullPublishForm,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { fetchShopAddressDetails } from '~/commerce/lib/shop-address'
import { seedDefaultWarehouseFromListing } from '~/commerce/lib/warehouse-inventory'
import { resolveCountryCode } from '~/lib/geo'
import { supabase } from '~/lib/supabase'
import { loadListingCatalogChildren } from '~/lib/listing/product-catalog.service'

async function settleOr<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch {
    return fallback
  }
}

/** Empty buffer for a listing type. New listings start as one SKU until options are added. */
function seedFormForType(listingType: ListingType, shopId?: string): ListingFormData {
  return {
    ...getDefaultListingFormData(listingType),
    shop_id: shopId,
    listing_metadata: mergeListingMetadata(undefined),
    materials: [],
    variations: [],
  }
}

export function VendorListingPublishScreen() {
  return (
    <ListingPublishErrorBoundary
      scope="VendorListingPublish"
      title="We couldn't load the listing composer"
      onReset={() => {
        // Parent remount handled by retry in boundary; publish state reset on next mount.
      }}
    >
      <VendorListingPublishContent />
    </ListingPublishErrorBoundary>
  )
}

function VendorListingPublishContent() {
  const ui = useAppUi()
  const router = useRouter()
  const toast = useAppToast()
  const dispatch = useAppDispatch()
  const { isDesktop, safeBottom } = useAppLayout()
  const params = useLocalSearchParams<{ id?: string; copyFrom?: string }>()

  const editListingId = typeof params.id === 'string' ? params.id : undefined
  const copyFromId = typeof params.copyFrom === 'string' ? params.copyFrom : undefined
  const isEditMode = Boolean(editListingId)
  const isDuplicateMode = Boolean(copyFromId) && !isEditMode
  const hydrateListingId = editListingId ?? copyFromId

  const shop = useAppSelector((s) => s.shop.currentShop)
  const { allowsSelling: kycAllowsSelling, isLoading: kycLoading } = useShopPayuKyc(shop?.id)
  const myShopsLoaded = useAppSelector((s) => s.shop.myShopsLoaded)
  const formData = useAppSelector((s) => s.listing.formData)
  const validation = useAppSelector((s) => s.listing.validation)
  const isLoadingDetails = useAppSelector((s) => s.listing.isLoadingDetails)
  const isUpdating = useAppSelector((s) => s.listing.isUpdating)
  const publishProgress = useAppSelector(selectPublishProgressInfo)
  const { currencySymbol } = useVendorCurrency()

  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!hydrateListingId)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [sellerCountryCode, setSellerCountryCode] = useState('IN')
  const [deliveryProfiles, setDeliveryProfiles] = useState<{ id: string; profile_name: string }[]>([])
  const [returnPolicies, setReturnPolicies] = useState<{ id: string; policy_name: string }[]>([])
  const [shopSections, setShopSections] = useState<{ id: string; section_name: string }[]>([])

  useEffect(() => {
    if (!shop?.id) return
    let cancelled = false
    void fetchShopAddressDetails(shop.id).then(({ address }) => {
      if (cancelled || !address?.country) return
      setSellerCountryCode(resolveCountryCode(address.country) || 'IN')
    })
    return () => {
      cancelled = true
    }
  }, [shop?.id])

  useEffect(() => {
    if (!shop?.id) return
    let cancelled = false
    void Promise.all([
      supabase
        .from('delivery_profiles')
        .select('id, profile_name')
        .eq('shop_id', shop.id)
        .eq('is_active', true),
      supabase
        .from('return_policies')
        .select('id, policy_name')
        .eq('shop_id', shop.id)
        .eq('is_active', true),
      supabase
        .from('shop_sections')
        .select('id, section_name')
        .eq('shop_id', shop.id)
        .eq('is_active', true),
    ]).then(([delivery, returns, sections]) => {
      if (cancelled) return
      setDeliveryProfiles(delivery.data ?? [])
      setReturnPolicies(returns.data ?? [])
      setShopSections(sections.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [shop?.id])

  useEffect(() => {
    if (!hydrateListingId) {
      dispatch(resetListingFormData())
      dispatch(loadFormFromListing(seedFormForType(LISTING_TYPES.PHYSICAL, shop?.id)))
      setHydrated(true)
      return
    }

    const listingId = hydrateListingId
    let cancelled = false

    setLoadError(null)

    async function hydrate() {
      const details = await dispatch(loadListingDetails({ listingId })).unwrap()
      if (cancelled) return
      if (!details) {
        setLoadError(LISTING_PUBLISH_COPY.LOAD_MISSING)
        return
      }

      // A missing side-table (or a policy that hides it) must not strand the
      // whole composer — hydrate what loaded and let the vendor re-enter the rest.
      const [imagesResult, variationsResult, materialsResult, attributesResult, categoriesResult, catalogResult] =
        await Promise.all([
          settleOr(dispatch(loadImages(listingId)).unwrap(), { listingId, items: [] }),
          settleOr(dispatch(loadVariations(listingId)).unwrap(), { listingId, items: [] }),
          settleOr(dispatch(loadMaterials(listingId)).unwrap(), { listingId, items: [] }),
          settleOr(dispatch(loadAttributes(listingId)).unwrap(), { listingId, items: [] }),
          settleOr(dispatch(loadListingCategories(listingId)).unwrap(), { listingId, rows: [] }),
          loadListingCatalogChildren(listingId),
        ])
      if (cancelled) return

      const hydratedForm = buildFormFromListingDetails(details, {
        images: imagesResult.items,
        variations: variationsResult.items,
        materials: materialsResult.items,
        attributes: attributesResult.items,
        categoryIds: categoriesResult.rows.map((row) => ({
          category_id: row.category_id,
          is_primary: row.is_primary ?? false,
        })),
        catalog: catalogResult.data ?? undefined,
        asDuplicate: isDuplicateMode,
      })

      dispatch(loadFormFromListing(hydratedForm))
      if (isDuplicateMode) {
        toast.show('Listing copied', {
          tone: 'success',
          message: 'Review the copy, then save as draft or publish.',
        })
      }
      setHydrated(true)
    }

    void hydrate().catch((error) => {
      if (cancelled) return
      setLoadError(toFriendlyListingError(error))
      toast.show('Could not load listing', {
        tone: 'danger',
        message: toFriendlyListingError(error),
      })
    })

    return () => {
      cancelled = true
    }
  }, [dispatch, hydrateListingId, isDuplicateMode, reloadToken, shop?.id, toast])

  const retryHydrate = useCallback(() => {
    setLoadError(null)
    setHydrated(false)
    setReloadToken((token) => token + 1)
  }, [])

  useEffect(() => {
    return () => {
      dispatch(resetPublishState())
    }
  }, [dispatch])

  const updateField = useCallback(
    <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => {
      dispatch(updateListingField({ field, value }))
      setLastSavedAt(new Date().toISOString())
      // Realtime field errors for string-backed publish fields.
      if (typeof value === 'string') {
        const { error } = validateListingField(field, value)
        setStepErrors((current) => {
          const next = { ...current }
          if (error) next[field as string] = error
          else delete next[field as string]
          return next
        })
      }
    },
    [dispatch],
  )

  const updateMetadata = useCallback(
    (key: string, value: unknown) => {
      const next = updateListingMetadataField(
        formData.listing_metadata as Record<string, unknown>,
        key as never,
        value,
      )
      dispatch(updateListingField({ field: 'listing_metadata', value: next }))
      setLastSavedAt(new Date().toISOString())
    },
    [dispatch, formData.listing_metadata],
  )

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = tag.trim()
      if (!normalized) return
      const tags = formData.tags ?? []
      if (tags.includes(normalized)) return
      updateField('tags', [...tags, normalized])
    },
    [formData.tags, updateField],
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      updateField('tags', (formData.tags ?? []).filter((entry) => entry !== tag))
    },
    [formData.tags, updateField],
  )

  const handleToggleCategory = useCallback(
    (categoryId: string) => {
      const current = formData.categories ?? []
      const exists = current.some((row) => row.category_id === categoryId)
      if (exists) {
        updateField('categories', [])
        return
      }
      updateField('categories', [{ category_id: categoryId, is_primary: true }])
    },
    [formData.categories, updateField],
  )

  const handleClearCategories = useCallback(() => {
    updateField('categories', [])
  }, [updateField])

  const handleChangeImages = useCallback(
    (images: ListingFormData['images']) => {
      updateField('images', images ?? [])
    },
    [updateField],
  )

  const saveDraft = useCallback(async () => {
    if (!shop?.id) {
      toast.show('No shop selected', { tone: 'danger', message: 'Create a shop before adding products.' })
      return
    }

    const draft = validateDraftForm(formData)
    if (!draft.isValid) {
      setStepErrors(draft.errors)
      scrollToListingSection('about')
      toast.show('Add a title first', {
        tone: 'danger',
        message: Object.values(draft.errors)[0] ?? 'Please complete required fields.',
      })
      return
    }

    try {
      if (isEditMode && editListingId) {
        const payload = formDataToPublishPayload(formData, shop.id)
        await dispatch(
          updateListingWithDetails({ listingId: editListingId, formData: payload }),
        ).unwrap()
        void seedDefaultWarehouseFromListing({
          shopId: shop.id,
          listingId: editListingId,
          quantity: formData.quantity,
        })
        setLastSavedAt(new Date().toISOString())
        toast.show('Draft saved', { tone: 'success', message: 'Your listing changes were saved.' })
        return
      }

      const images = await ensureImageBlobsForPublish(formData.images)
      const payload = formDataToPublishPayload({ ...formData, images }, shop.id)
      const result = await dispatch(
        publishListing({ listingData: payload, options: { publishImmediately: false } }),
      ).unwrap()

      if (!result.success) {
        throw new Error(
          typeof result.error_details === 'string'
            ? result.error_details
            : 'Could not save draft.',
        )
      }

      if (result.listing_id) {
        void seedDefaultWarehouseFromListing({
          shopId: shop.id,
          listingId: result.listing_id,
          quantity: formData.quantity,
        })
      }

      setLastSavedAt(new Date().toISOString())
      toast.show('Draft saved', { tone: 'success', message: 'Your listing was saved as a draft.' })
      if (result.listing_id) {
        router.push(`${vendorRoutes.createListing}?id=${encodeURIComponent(result.listing_id)}` as never)
      }
    } catch (error) {
      toast.show('Save failed', {
        tone: 'danger',
        message: toFriendlyListingError(error),
      })
    }
  }, [dispatch, editListingId, formData, isEditMode, router, shop?.id, toast])

  const publishListingNow = useCallback(async () => {
    if (!shop?.id) {
      toast.show('No shop selected', { tone: 'danger' })
      return
    }
    if (kycLoading) {
      toast.show('Checking verification…', { tone: 'warning' })
      return
    }
    if (!kycAllowsSelling) {
      toast.show('Complete verification to publish', {
        tone: 'danger',
        message: 'Payout KYC must be verified before listings can go live.',
      })
      router.push(vendorRoutes.settingsSection('verification'))
      return
    }

    const full = validateFullPublishForm(formData)
    if (!full.isValid) {
      setStepErrors(full.errors)
      const failingStep = findStepForErrors(full.errors)
      if (failingStep) scrollToListingSection(failingStep)
      toast.show('Fix validation errors', {
        tone: 'danger',
        message: Object.values(full.errors)[0] ?? 'Please complete required fields.',
      })
      return
    }

    try {
      if (isEditMode && editListingId) {
        const images = await ensureImageBlobsForPublish(formData.images)
        const payload = formDataToPublishPayload({ ...formData, images }, shop.id)
        await dispatch(
          updateListingWithDetails({
            listingId: editListingId,
            formData: { ...payload, listing_status: LISTING_STATUS.ACTIVE, is_active: true },
          }),
        ).unwrap()
        await dispatch(
          setListingStatus({ listingId: editListingId, status: LISTING_STATUS.ACTIVE }),
        ).unwrap()
        void seedDefaultWarehouseFromListing({
          shopId: shop.id,
          listingId: editListingId,
          quantity: formData.quantity,
        })
        toast.show('Published', { tone: 'success', message: 'Your listing is now live.' })
        router.push(vendorRoutes.products)
        return
      }

      const images = await ensureImageBlobsForPublish(formData.images)
      const payload = formDataToPublishPayload({ ...formData, images }, shop.id)
      const result = await dispatch(
        publishListing({ listingData: payload, options: { publishImmediately: true } }),
      ).unwrap()

      if (!result.success) {
        throw new Error(
          typeof result.error_details === 'string'
            ? result.error_details
            : 'Publication failed.',
        )
      }

      if (result.listing_id) {
        void seedDefaultWarehouseFromListing({
          shopId: shop.id,
          listingId: result.listing_id,
          quantity: formData.quantity,
        })
      }

      toast.show('Published', { tone: 'success', message: 'Your listing is now live.' })
      router.push(vendorRoutes.products)
    } catch (error) {
      toast.show('Publish failed', {
        tone: 'danger',
        message: toFriendlyListingError(error),
      })
    }
  }, [
    dispatch,
    editListingId,
    formData,
    isEditMode,
    kycAllowsSelling,
    kycLoading,
    router,
    shop?.id,
    toast,
  ])

  const isSaving = isUpdating || publishProgress.isPublishing

  if (loadError) {
    return (
      <PageCenter>
        <YStack gap="$4" alignItems="center" maxWidth={420}>
          <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
            {LISTING_PUBLISH_COPY.LOAD_FAILED_TITLE}
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            {loadError}
          </Text>
          <XStack gap="$2" flexWrap="wrap" justifyContent="center">
            <Button tone="primary" size="$4" borderRadius={999} onPress={retryHydrate}>
              {LISTING_PUBLISH_COPY.LOAD_RETRY}
            </Button>
            <Button
              tone="outline"
              size="$4"
              borderRadius={999}
              onPress={() => router.push(vendorRoutes.products)}
            >
              {LISTING_PUBLISH_COPY.BACK_TO_PRODUCTS}
            </Button>
          </XStack>
        </YStack>
      </PageCenter>
    )
  }

  // A vendor with no shop would otherwise wait on a spinner that never resolves.
  if (!shop && myShopsLoaded) {
    return (
      <PageCenter>
        <YStack gap="$4" alignItems="center" maxWidth={420}>
          <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
            {LISTING_PUBLISH_COPY.NO_SHOP_TITLE}
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            {LISTING_PUBLISH_COPY.NO_SHOP_MESSAGE}
          </Text>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            onPress={() => router.push(vendorRoutes.myShop)}
          >
            {LISTING_PUBLISH_COPY.NO_SHOP_ACTION}
          </Button>
        </YStack>
      </PageCenter>
    )
  }

  if (!shop || (isEditMode && (!hydrated || isLoadingDetails))) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  const displayErrors = { ...validation.errors, ...stepErrors }
  const tabClearance = isDesktop ? 0 : APP_LAYOUT.mobileTabBarHeight + safeBottom
  // Room for the fixed footer so the last fields stay scrollable above it.
  const footerClearance = isDesktop ? 96 : 120

  const pageTitle = isEditMode
    ? LISTING_PUBLISH_COPY.PAGE_TITLE_EDIT
    : isDuplicateMode
      ? LISTING_PUBLISH_COPY.PAGE_TITLE_DUPLICATE
      : LISTING_PUBLISH_COPY.PAGE_TITLE_CREATE

  return (
    <YStack
      flex={1}
      minHeight={0}
      width="100%"
      backgroundColor={ui.background}
      style={
        Platform.OS === 'web'
          ? ({ minHeight: '100dvh', position: 'relative' } as const)
          : undefined
      }
    >
      <YStack
        flex={1}
        minHeight={0}
        width="100%"
        paddingHorizontal={isDesktop ? '$5' : '$3'}
        paddingTop={isDesktop ? '$4' : '$3'}
        paddingBottom={24 + tabClearance + footerClearance}
        gap="$4"
      >
        <ListingPublishPageHeader
          ui={ui}
          isDesktop={isDesktop}
          headline={pageTitle}
          subtitle="Photos, price, variations, shipping, and who made it. Save a draft any time."
        />

        <ListingEditorForm
          ui={ui}
          formData={formData}
          errors={displayErrors}
          isDesktop={isDesktop}
          currencySymbol={currencySymbol}
          sellerCountryCode={sellerCountryCode}
          deliveryProfiles={deliveryProfiles}
          returnPolicies={returnPolicies}
          shopSections={shopSections}
          onUpdate={updateField}
          onUpdateMetadata={updateMetadata}
          onChangeImages={handleChangeImages}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onToggleCategory={handleToggleCategory}
          onClearCategories={handleClearCategories}
        />
      </YStack>

      <YStack
        width="100%"
        zIndex={40}
        style={
          {
            position: Platform.OS === 'web' ? 'fixed' : 'absolute',
            left: 0,
            right: 0,
            bottom: tabClearance,
          } as const
        }
      >
        <ListingPublishFooter
          ui={ui}
          isDesktop={isDesktop}
          safeBottom={isDesktop ? safeBottom : 0}
          lastSavedAt={lastSavedAt}
          isSaving={isSaving}
          isPublishing={publishProgress.isPublishing}
          showPublish
          isFirstStep
          onBack={() => router.push(vendorRoutes.products)}
          onNext={() => void publishListingNow()}
          onSaveDraft={() => void saveDraft()}
          onPublish={() => void publishListingNow()}
        />
      </YStack>
    </YStack>
  )
}
