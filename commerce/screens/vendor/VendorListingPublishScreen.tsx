import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import { ListingPublishErrorBoundary } from '~/commerce/components/ListingPublishErrorBoundary'
import { PageCenter } from '~/components/layout'
import { ScrollView, Spinner, YStack, useAppToast } from '~/components/ui'
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
  type ListingFormData,
  type ListingType,
} from '~/lib/listing/listing.type'
import {
  initFormForType,
  loadFormFromListing,
  loadListingDetails,
  resetListingFormData,
  setListingStatus,
  updateListingField,
  updateListingWithDetails,
  validateForm,
} from '~/lib/listing/listing.store'
import { toFriendlyListingError } from '~/lib/listing/listing.errors'
import { DEFAULT_SHOP_CURRENCY } from '~/lib/shop/shop.type'
import { getCurrencySymbol } from '~/lib/shop/shop.utils'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { ListingPublishFooter, ListingPublishTopBar } from '~/commerce/components/vendor/listing-publish/ListingPublishFooter'
import {
  ListingPublishPageHeader,
  ListingPublishStepNav,
} from '~/commerce/components/vendor/listing-publish/ListingPublishStepNav'
import {
  LISTING_PUBLISH_COPY,
  LISTING_PUBLISH_STEP_IDS,
  LISTING_PUBLISH_STEPS,
  type ListingPublishStepId,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  buildFormFromListingDetails,
  ensureImageBlobsForPublish,
  formDataToPublishPayload,
  mergeListingMetadata,
  updateListingMetadataField,
  validateFullPublishForm,
  validatePublishStep,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { BasicInfoStep } from '~/commerce/components/vendor/listing-publish/steps/BasicInfoStep'
import { CategoriesStep } from '~/commerce/components/vendor/listing-publish/steps/CategoriesStep'
import { DetailsStep } from '~/commerce/components/vendor/listing-publish/steps/DetailsStep'
import { ImagesStep } from '~/commerce/components/vendor/listing-publish/steps/ImagesStep'
import { PricingStep } from '~/commerce/components/vendor/listing-publish/steps/PricingStep'
import { SeoStep } from '~/commerce/components/vendor/listing-publish/steps/SeoStep'

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
  const params = useLocalSearchParams<{ id?: string }>()

  const editListingId = typeof params.id === 'string' ? params.id : undefined
  const isEditMode = Boolean(editListingId)

  const shop = useAppSelector((s) => s.shop.currentShop)
  const formData = useAppSelector((s) => s.listing.formData)
  const validation = useAppSelector((s) => s.listing.validation)
  const isLoadingDetails = useAppSelector((s) => s.listing.isLoadingDetails)
  const isUpdating = useAppSelector((s) => s.listing.isUpdating)
  const publishProgress = useAppSelector(selectPublishProgressInfo)

  const [activeStep, setActiveStep] = useState<ListingPublishStepId>(LISTING_PUBLISH_STEP_IDS.BASIC)
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!isEditMode)

  const stepConfig = useMemo(
    () => LISTING_PUBLISH_STEPS.find((step) => step.id === activeStep) ?? LISTING_PUBLISH_STEPS[0],
    [activeStep],
  )

  const currency = shop?.shop_currency || DEFAULT_SHOP_CURRENCY
  const currencySymbol = getCurrencySymbol(currency)
  const shopSlug =
    shop?.slug || shop?.shop_name?.toLowerCase().replace(/\s+/g, '-') || 'shop'

  useEffect(() => {
    if (!isEditMode) {
      dispatch(resetListingFormData())
      dispatch(
        loadFormFromListing({
          ...getDefaultListingFormData(),
          shop_id: shop?.id,
          listing_metadata: mergeListingMetadata(undefined),
          materials: [{ material_name: '', percentage: null, certification: '' }],
          variations: [
            { variation_name: 'Color', variation_value: '', price_adjustment: 0, stock: 0 },
          ],
        }),
      )
      setHydrated(true)
      return
    }

    if (!editListingId) return

    const listingId = editListingId

    async function hydrate() {
      const details = await dispatch(loadListingDetails({ listingId })).unwrap()
      if (!details) return

      const [imagesResult, variationsResult, materialsResult, attributesResult, categoriesResult] =
        await Promise.all([
          dispatch(loadImages(listingId)).unwrap(),
          dispatch(loadVariations(listingId)).unwrap(),
          dispatch(loadMaterials(listingId)).unwrap(),
          dispatch(loadAttributes(listingId)).unwrap(),
          dispatch(loadListingCategories(listingId)).unwrap(),
        ])

      const hydratedForm = buildFormFromListingDetails(details, {
        images: imagesResult.items,
        variations: variationsResult.items,
        materials: materialsResult.items,
        attributes: attributesResult.items,
        categoryIds: categoriesResult.rows.map((row) => ({
          category_id: row.category_id,
          is_primary: row.is_primary ?? false,
        })),
      })

      dispatch(loadFormFromListing(hydratedForm))
      setHydrated(true)
    }

    void hydrate().catch((error) => {
      toast.show('Could not load listing', {
        tone: 'danger',
        message: toFriendlyListingError(error),
      })
    })
  }, [dispatch, editListingId, isEditMode, shop?.id, toast])

  useEffect(() => {
    return () => {
      dispatch(resetPublishState())
    }
  }, [dispatch])

  const updateField = useCallback(
    <K extends keyof ListingFormData>(field: K, value: ListingFormData[K]) => {
      dispatch(updateListingField({ field, value }))
      setLastSavedAt(new Date().toISOString())
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
      dispatch(initFormForType(type))
      dispatch(updateListingField({ field: 'shop_id', value: shop?.id }))
      setLastSavedAt(new Date().toISOString())
    },
    [dispatch, shop?.id],
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

  const runStepValidation = useCallback(
    (stepId: ListingPublishStepId) => {
      const result = validatePublishStep(stepId, formData)
      setStepErrors(result.errors)
      dispatch(validateForm())
      return result.isValid
    },
    [dispatch, formData],
  )

  const saveDraft = useCallback(async () => {
    if (!shop?.id) {
      toast.show('No shop selected', { tone: 'danger', message: 'Create a shop before adding products.' })
      return
    }

    const full = validateFullPublishForm(formData)
    if (!full.isValid) {
      setStepErrors(full.errors)
      toast.show('Fix validation errors', {
        tone: 'danger',
        message: Object.values(full.errors)[0] ?? 'Please complete required fields.',
      })
      return
    }

    try {
      if (isEditMode && editListingId) {
        const payload = formDataToPublishPayload(formData, shop.id)
        await dispatch(
          updateListingWithDetails({ listingId: editListingId, formData: payload }),
        ).unwrap()
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

      setLastSavedAt(new Date().toISOString())
      toast.show('Draft saved', { tone: 'success', message: 'Your listing was saved as a draft.' })
      if (result.listing_id) {
        router.replace(`${vendorRoutes.createListing}?id=${encodeURIComponent(result.listing_id)}` as never)
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

    const full = validateFullPublishForm(formData)
    if (!full.isValid) {
      setStepErrors(full.errors)
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

      toast.show('Published', { tone: 'success', message: 'Your listing is now live.' })
      router.push(vendorRoutes.products)
    } catch (error) {
      toast.show('Publish failed', {
        tone: 'danger',
        message: toFriendlyListingError(error),
      })
    }
  }, [dispatch, editListingId, formData, isEditMode, router, shop?.id, toast])

  const isSaving = isUpdating || publishProgress.isPublishing

  if (!shop || (isEditMode && (!hydrated || isLoadingDetails))) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  const displayErrors = { ...validation.errors, ...stepErrors }
  const showPublish = activeStep === LISTING_PUBLISH_STEP_IDS.SEO

  return (
    <YStack
      flex={1}
      minHeight={0}
      width="100%"
      backgroundColor={ui.background}
      style={
        Platform.OS === 'web'
          ? ({ height: '100%', maxHeight: '100%', overflow: 'hidden' } as const)
          : undefined
      }
    >
      <ScrollView
        flex={1}
        width="100%"
        minHeight={0}
        showsVerticalScrollIndicator={false}
        style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
      >
        <YStack
          width="100%"
          maxWidth={1200}
          alignSelf="center"
          paddingHorizontal={isDesktop ? '$6' : '$4'}
          paddingTop={isDesktop ? '$5' : '$3'}
          paddingBottom="$6"
          gap="$4"
        >
          {/* <ListingPublishTopBar
            ui={ui}
            title={isEditMode ? LISTING_PUBLISH_COPY.PAGE_TITLE_EDIT : LISTING_PUBLISH_COPY.PAGE_TITLE_CREATE}
            isSaving={isSaving}
            onBack={() => router.push(vendorRoutes.products)}
            onSaveDraft={() => void saveDraft()}
          /> */}

          <ListingPublishPageHeader
            ui={ui}
            headline={stepConfig.headline}
            subtitle={stepConfig.subtitle}
          />

          <ListingPublishStepNav
            ui={ui}
            activeStep={activeStep}
            isDesktop={isDesktop}
            onSelect={(step) => {
              runStepValidation(activeStep)
              setActiveStep(step)
            }}
          />

          {activeStep === LISTING_PUBLISH_STEP_IDS.BASIC ? (
            <BasicInfoStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              onChangeType={handleChangeType}
              onUpdate={updateField}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          ) : null}

          {activeStep === LISTING_PUBLISH_STEP_IDS.DETAILS ? (
            <DetailsStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              onUpdate={updateField}
              onUpdateMetadata={updateMetadata}
            />
          ) : null}

          {activeStep === LISTING_PUBLISH_STEP_IDS.PRICING ? (
            <PricingStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              currencySymbol={currencySymbol}
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

          {activeStep === LISTING_PUBLISH_STEP_IDS.IMAGES ? (
            <ImagesStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              onChangeImages={handleChangeImages}
            />
          ) : null}

          {activeStep === LISTING_PUBLISH_STEP_IDS.SEO ? (
            <SeoStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              shopSlug={shopSlug}
              onUpdate={updateField}
              onUpdateMetadata={updateMetadata}
            />
          ) : null}
        </YStack>
      </ScrollView>

      <ListingPublishFooter
        ui={ui}
        isDesktop={isDesktop}
        safeBottom={safeBottom}
        lastSavedAt={lastSavedAt}
        isSaving={isSaving}
        isPublishing={publishProgress.isPublishing}
        showPublish={showPublish}
        onSaveDraft={() => void saveDraft()}
        onPublish={() => void publishListingNow()}
      />
    </YStack>
  )
}
