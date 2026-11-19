import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import { ListingPublishErrorBoundary } from '~/commerce/components/ListingPublishErrorBoundary'
import { PageCenter } from '~/components/layout'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import type { ListingDraftFromImageResult } from '~/lib/ai/client'
import { draftListingFromImage } from '~/lib/ai/client'
import { listingImageDraftToDataUrl } from '~/commerce/lib/listing-image-data-url'
import { searchCategories } from '~/lib/listing/listing-categories.service'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import type { PickedImage } from '~/lib/media/pick-image'
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
  type ListingImageDraft,
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

import { ListingPublishFooter } from '~/commerce/components/vendor/listing-publish/ListingPublishFooter'
import { ListingEditorStatusRail } from '~/commerce/components/vendor/listing-publish/ListingEditorStatusRail'
import {
  ListingPublishPageHeader,
  ListingPublishStepNav,
} from '~/commerce/components/vendor/listing-publish/ListingPublishStepNav'
import { ListingTypeChooser } from '~/commerce/components/vendor/listing-publish/ListingTypeChooser'
import {
  getListingPublishSteps,
  LISTING_PUBLISH_COPY,
  LISTING_PUBLISH_STEP_IDS,
  PRODUCT_STRUCTURES,
  type ListingPublishStepId,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  buildFormFromListingDetails,
  ensureImageBlobsForPublish,
  findStepForErrors,
  formDataToPublishPayload,
  mergeListingMetadata,
  resolveProductStructure,
  updateListingMetadataField,
  validateDraftForm,
  validateFullPublishForm,
  validatePublishStep,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { fetchShopAddressDetails } from '~/commerce/lib/shop-address'
import { seedDefaultWarehouseFromListing } from '~/commerce/lib/warehouse-inventory'
import { BasicInfoStep } from '~/commerce/components/vendor/listing-publish/steps/BasicInfoStep'
import { CategoriesStep } from '~/commerce/components/vendor/listing-publish/steps/CategoriesStep'
import { DetailsStep } from '~/commerce/components/vendor/listing-publish/steps/DetailsStep'
import { ImagesStep } from '~/commerce/components/vendor/listing-publish/steps/ImagesStep'
import { PricingStep } from '~/commerce/components/vendor/listing-publish/steps/PricingStep'
import { SeoStep } from '~/commerce/components/vendor/listing-publish/steps/SeoStep'
import { resolveCountryCode } from '~/lib/geo'

function pickedToDraft(picked: PickedImage, order: number): ListingImageDraft {
  return {
    image_url: picked.uri,
    mimeType: picked.mimeType,
    fileName: picked.fileName,
    blob: picked.file,
    is_primary: order === 0,
    display_order: order,
  }
}
async function settleOr<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch {
    return fallback
  }
}

/** Empty buffer for a listing type — Amazon-style single-SKU default (no forced variants). */
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

  const [activeStep, setActiveStep] = useState<ListingPublishStepId>(LISTING_PUBLISH_STEP_IDS.BASIC)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!isEditMode)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [writingListing, setWritingListing] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  // New listings start on the type chooser; the form is built around that answer.
  const [typeConfirmed, setTypeConfirmed] = useState(isEditMode)
  // The form seeds a physical listing, but nothing is "chosen" until the vendor says so.
  const [typePicked, setTypePicked] = useState(isEditMode)
  const [sellerCountryCode, setSellerCountryCode] = useState(
    shop?.shop_currency === 'INR' ? 'IN' : 'IN',
  )

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

  const shopSlug =
    shop?.slug || shop?.shop_name?.toLowerCase().replace(/\s+/g, '-') || 'shop'

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
      const [imagesResult, variationsResult, materialsResult, attributesResult, categoriesResult] =
        await Promise.all([
          settleOr(dispatch(loadImages(listingId)).unwrap(), { items: [] }),
          settleOr(dispatch(loadVariations(listingId)).unwrap(), { items: [] }),
          settleOr(dispatch(loadMaterials(listingId)).unwrap(), { items: [] }),
          settleOr(dispatch(loadAttributes(listingId)).unwrap(), { items: [] }),
          settleOr(dispatch(loadListingCategories(listingId)).unwrap(), { rows: [] }),
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
        asDuplicate: isDuplicateMode,
      })

      dispatch(loadFormFromListing(hydratedForm))
      if (isDuplicateMode) {
        setTypePicked(true)
        setTypeConfirmed(true)
        setActiveStep(LISTING_PUBLISH_STEP_IDS.BASIC)
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

  const handleChangeType = useCallback(
    (type: ListingType) => {
      if (type === formData.listing_type) return
      // Swap only the type-specific fields — everything the vendor already typed carries over.
      dispatch(
        loadFormFromListing({
          ...seedFormForType(type, shop?.id),
          title: formData.title,
          description: formData.description,
          tags: formData.tags,
          categories: formData.categories,
          images: formData.images,
          price: formData.price,
          quantity: formData.quantity,
          is_featured: formData.is_featured,
          slug: formData.slug,
          meta_title: formData.meta_title,
          meta_description: formData.meta_description,
          listing_metadata: formData.listing_metadata,
        }),
      )
      setLastSavedAt(new Date().toISOString())
    },
    [dispatch, formData, shop?.id],
  )

  const handleConfirmType = useCallback(
    (type: ListingType) => {
      handleChangeType(type)
      setTypePicked(true)
      setTypeConfirmed(true)
      setActiveStep(LISTING_PUBLISH_STEP_IDS.BASIC)
    },
    [handleChangeType],
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
        updateField(
          'categories',
          current.filter((row) => row.category_id !== categoryId),
        )
        return
      }
      updateField('categories', [...current, { category_id: categoryId, is_primary: current.length === 0 }])
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

  const handleApplyAiDraft = useCallback(
    async (draft: ListingDraftFromImageResult) => {
      updateField('title', draft.title)
      updateField('description', draft.description)
      if (draft.tags.length) {
        const existing = new Set((formData.tags ?? []).map((tag) => tag.toLowerCase()))
        const merged = [...(formData.tags ?? [])]
        for (const tag of draft.tags) {
          const normalized = tag.trim()
          if (!normalized || existing.has(normalized.toLowerCase())) continue
          existing.add(normalized.toLowerCase())
          merged.push(normalized)
        }
        updateField('tags', merged.slice(0, 12))
      }
      if (draft.suggestedPriceInr != null && draft.suggestedPriceInr > 0) {
        const currentPrice = Number(formData.price ?? 0)
        if (!currentPrice) {
          updateField('price', draft.suggestedPriceInr)
        }
      }
      if (draft.metaTitle) updateField('meta_title', draft.metaTitle)
      if (draft.metaDescription) updateField('meta_description', draft.metaDescription)
      const hint = draft.categoryHint?.trim() ?? ''
      if (hint.length >= 2) {
        const found = await searchCategories(hint, { limit: 8 })
        const rows = found.data ?? []
        const lowered = hint.toLowerCase()
        const match =
          rows.find((row) => row.category.toLowerCase() === lowered) ??
          rows.find(
            (row) =>
              row.category.toLowerCase().includes(lowered) ||
              lowered.includes(row.category.toLowerCase()),
          )
        const current = formData.categories ?? []
        if (match && !current.some((row) => row.category_id === match.category_id)) {
          updateField('categories', [
            ...current,
            { category_id: match.category_id, is_primary: current.length === 0 },
          ])
        }
      }
      toast.show('Listing draft ready', {
        tone: 'success',
        message: draft.priceNote || 'Review the title, description, and price before publishing.',
      })
      setActiveStep(LISTING_PUBLISH_STEP_IDS.BASIC)
    },
    [formData.categories, formData.price, formData.tags, toast, updateField],
  )

  const writeWithAi = useCallback(async () => {
    if (writingListing) return
    setWritingListing(true)
    try {
      let primary = (formData.images ?? []).find((image) => image.is_primary) ?? formData.images?.[0]
      if (!primary) {
        const picked = await pickImagesWithCrop({
          multiple: false,
          maxCount: 1,
          aspect: 'listing',
          cropTitle: 'Crop listing photo',
        })
        const file = picked[0]
        if (!file) return
        const image = pickedToDraft(file, 0)
        updateField('images', [image])
        primary = image
      }
      const dataUrl = await listingImageDraftToDataUrl(primary)
      const draft = await draftListingFromImage({ dataUrl })
      await handleApplyAiDraft(draft)
    } catch (error) {
      toast.show('Could not draft listing', {
        tone: 'danger',
        message:
          error instanceof Error
            ? error.message
            : "Couldn't read this photo. Try a clearer product picture.",
      })
    } finally {
      setWritingListing(false)
    }
  }, [formData.images, handleApplyAiDraft, toast, updateField, writingListing])

  const productStructure = resolveProductStructure(formData)
  const visibleSteps = useMemo(
    () => getListingPublishSteps(productStructure),
    [productStructure],
  )
  const stepIndex = useMemo(
    () => Math.max(0, visibleSteps.findIndex((step) => step.id === activeStep)),
    [activeStep, visibleSteps],
  )
  const stepConfig = visibleSteps[stepIndex] ?? visibleSteps[0]
  const furthestStepIndex = visibleSteps.length - 1
  const isLastStep = stepIndex >= visibleSteps.length - 1

  // If product type drops Variants, leave that tab.
  useEffect(() => {
    if (
      activeStep === LISTING_PUBLISH_STEP_IDS.VARIANTS &&
      productStructure === PRODUCT_STRUCTURES.SIMPLE
    ) {
      setActiveStep(LISTING_PUBLISH_STEP_IDS.PRICING)
    }
  }, [activeStep, productStructure])

  const goToStep = useCallback((step: ListingPublishStepId) => {
    setActiveStep(step)
  }, [])

  const goNext = useCallback(() => {
    if (isLastStep) return
    const result = validatePublishStep(activeStep, formData)
    setStepErrors(result.errors)
    if (!result.isValid) {
      toast.show('Fix this tab to continue', {
        tone: 'danger',
        message: Object.values(result.errors)[0] ?? `Complete ${stepConfig.label}.`,
      })
      return
    }
    const next = visibleSteps[stepIndex + 1]
    if (next) setActiveStep(next.id)
  }, [activeStep, formData, isLastStep, stepConfig.label, stepIndex, toast, visibleSteps])

  const goBack = useCallback(() => {
    if (stepIndex === 0) {
      router.push(vendorRoutes.products)
      return
    }
    const prev = visibleSteps[stepIndex - 1]
    if (prev) setActiveStep(prev.id)
  }, [router, stepIndex, visibleSteps])

  const saveDraft = useCallback(async () => {
    if (!shop?.id) {
      toast.show('No shop selected', { tone: 'danger', message: 'Create a shop before adding products.' })
      return
    }

    const draft = validateDraftForm(formData)
    if (!draft.isValid) {
      setStepErrors(draft.errors)
      setActiveStep(LISTING_PUBLISH_STEP_IDS.BASIC)
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
      if (failingStep) setActiveStep(failingStep)
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
  const footerClearance = isDesktop ? 0 : 88

  if (!typeConfirmed) {
    return (
      <YStack flex={1} minHeight={0} width="100%" backgroundColor={ui.background}>
        <YStack
          width="100%"
          paddingHorizontal={isDesktop ? '$6' : '$3'}
          paddingTop={isDesktop ? '$5' : '$3'}
          gap="$4"
        >
          <ListingTypeChooser
            ui={ui}
            isDesktop={isDesktop}
            selected={typePicked ? formData.listing_type : undefined}
            onSelect={handleConfirmType}
          />
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack width="100%" backgroundColor={ui.background}>
      <YStack width="100%" minWidth={0}>
        <YStack
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          paddingHorizontal={isDesktop ? '$5' : '$3'}
          paddingTop={isDesktop ? '$4' : '$3'}
          paddingBottom={24 + tabClearance + footerClearance}
          gap="$4"
        >
          <ListingPublishPageHeader
            ui={ui}
            isDesktop={isDesktop}
            headline={stepConfig.headline}
            subtitle={stepConfig.subtitle}
          />

          <ListingPublishStepNav
            ui={ui}
            activeStep={activeStep}
            steps={visibleSteps}
            furthestStepIndex={furthestStepIndex}
            isDesktop={isDesktop}
            onSelect={goToStep}
          />

          <XStack gap="$4" alignItems="flex-start" flexWrap={isDesktop ? 'nowrap' : 'wrap'}>
            <YStack flex={1} minWidth={280} gap="$4">
              {activeStep === LISTING_PUBLISH_STEP_IDS.BASIC ? (
                <BasicInfoStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  isDesktop={isDesktop}
                  onEditType={() => setTypeConfirmed(false)}
                  onUpdate={updateField}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onWriteWithAi={() => void writeWithAi()}
                  writingWithAi={writingListing}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.IMAGES ? (
                <ImagesStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  isDesktop={isDesktop}
                  onChangeImages={handleChangeImages}
                  onApplyAiDraft={handleApplyAiDraft}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.PRICING ? (
                <PricingStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  currencySymbol={currencySymbol}
                  isDesktop={isDesktop}
                  sellerCountryCode={sellerCountryCode}
                  panel="type-and-price"
                  onUpdate={updateField}
                  onUpdateMetadata={updateMetadata}
                  onStructureChange={(next) => {
                    if (next === PRODUCT_STRUCTURES.VARIABLE) {
                      setActiveStep(LISTING_PUBLISH_STEP_IDS.VARIANTS)
                    }
                  }}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.VARIANTS ? (
                <PricingStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  currencySymbol={currencySymbol}
                  isDesktop={isDesktop}
                  sellerCountryCode={sellerCountryCode}
                  panel="variants"
                  onUpdate={updateField}
                  onUpdateMetadata={updateMetadata}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.DETAILS ? (
                <DetailsStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  sellerCountryCode={sellerCountryCode}
                  section="details"
                  onUpdate={updateField}
                  onUpdateMetadata={updateMetadata}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.SHIPPING ? (
                <DetailsStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  sellerCountryCode={sellerCountryCode}
                  section="shipping"
                  onUpdate={updateField}
                  onUpdateMetadata={updateMetadata}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.CATEGORIES ? (
                <CategoriesStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  onToggleCategory={handleToggleCategory}
                  onClearCategories={handleClearCategories}
                />
              ) : null}

              {activeStep === LISTING_PUBLISH_STEP_IDS.SEO ? (
                <SeoStep
                  ui={ui}
                  formData={formData}
                  errors={displayErrors}
                  shopSlug={shopSlug}
                  isDesktop={isDesktop}
                  onUpdate={updateField}
                  onUpdateMetadata={updateMetadata}
                />
              ) : null}
            </YStack>

            {isDesktop ? (
              <YStack width={280} flexShrink={0}>
                <ListingEditorStatusRail
                  ui={ui}
                  formData={formData}
                  currencySymbol={currencySymbol}
                  isEditMode={isEditMode}
                  lastSavedAt={lastSavedAt}
                  isSaving={isSaving}
                  isPublishing={publishProgress.isPublishing}
                  onSaveDraft={() => void saveDraft()}
                  onPublish={() => void publishListingNow()}
                  onCancel={() => router.push(vendorRoutes.products)}
                />
              </YStack>
            ) : null}
          </XStack>
        </YStack>
      </YStack>

      <YStack
        width="100%"
        style={
          Platform.OS === 'web'
            ? ({ position: 'sticky', bottom: tabClearance } as const)
            : undefined
        }
      >
        <ListingPublishFooter
          ui={ui}
          isDesktop={isDesktop}
          safeBottom={safeBottom}
          lastSavedAt={lastSavedAt}
          isSaving={isSaving}
          isPublishing={publishProgress.isPublishing}
          showPublish={isLastStep || isDesktop}
          isFirstStep={stepIndex === 0}
          onBack={goBack}
          onNext={goNext}
          onSaveDraft={() => void saveDraft()}
          onPublish={() => void publishListingNow()}
        />
      </YStack>
    </YStack>
  )
}
