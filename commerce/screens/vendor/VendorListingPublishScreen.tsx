import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'one'

import { ListingPublishErrorBoundary } from '~/commerce/components/ListingPublishErrorBoundary'
import { PageCenter } from '~/components/layout'
import { ScrollView, Spinner, YStack, useAppToast } from '~/components/ui'
import type { ListingDraftFromImageResult } from '~/lib/ai/client'
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
  validateForm,
} from '~/lib/listing/listing.store'
import { toFriendlyListingError } from '~/lib/listing/listing.errors'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { vendorRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { ListingPublishFooter, ListingPublishTopBar } from '~/commerce/components/vendor/listing-publish/ListingPublishFooter'
import {
  ListingPublishPageHeader,
  ListingPublishStepNav,
} from '~/commerce/components/vendor/listing-publish/ListingPublishStepNav'
import { ListingTypeChooser } from '~/commerce/components/vendor/listing-publish/ListingTypeChooser'
import {
  LISTING_PUBLISH_COPY,
  LISTING_PUBLISH_STEP_IDS,
  LISTING_PUBLISH_STEPS,
  type ListingPublishStepId,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'
import {
  buildFormFromListingDetails,
  ensureImageBlobsForPublish,
  findStepForErrors,
  formDataToPublishPayload,
  mergeListingMetadata,
  updateListingMetadataField,
  validateDraftForm,
  validateFullPublishForm,
  validatePublishStep,
} from '~/commerce/components/vendor/listing-publish/listing-publish.utils'
import { BasicInfoStep } from '~/commerce/components/vendor/listing-publish/steps/BasicInfoStep'
import { CategoriesStep } from '~/commerce/components/vendor/listing-publish/steps/CategoriesStep'
import { DetailsStep } from '~/commerce/components/vendor/listing-publish/steps/DetailsStep'
import { ImagesStep } from '~/commerce/components/vendor/listing-publish/steps/ImagesStep'
import { PricingStep } from '~/commerce/components/vendor/listing-publish/steps/PricingStep'
import { SeoStep } from '~/commerce/components/vendor/listing-publish/steps/SeoStep'

/** Empty buffer for a listing type, with the one-row seeds the physical form expects. */
function seedFormForType(listingType: ListingType, shopId?: string): ListingFormData {
  const base: ListingFormData = {
    ...getDefaultListingFormData(listingType),
    shop_id: shopId,
    listing_metadata: mergeListingMetadata(undefined),
  }
  if (listingType !== LISTING_TYPES.PHYSICAL) return base
  return {
    ...base,
    materials: [{ material_name: '', percentage: null, certification: '' }],
    variations: [{ variation_name: 'Color', variation_value: '', price_adjustment: 0, stock: 0 }],
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
  const params = useLocalSearchParams<{ id?: string }>()

  const editListingId = typeof params.id === 'string' ? params.id : undefined
  const isEditMode = Boolean(editListingId)

  const shop = useAppSelector((s) => s.shop.currentShop)
  const formData = useAppSelector((s) => s.listing.formData)
  const validation = useAppSelector((s) => s.listing.validation)
  const isLoadingDetails = useAppSelector((s) => s.listing.isLoadingDetails)
  const isUpdating = useAppSelector((s) => s.listing.isUpdating)
  const publishProgress = useAppSelector(selectPublishProgressInfo)
  const { currency, currencySymbol } = useVendorCurrency()

  const [activeStep, setActiveStep] = useState<ListingPublishStepId>(LISTING_PUBLISH_STEP_IDS.BASIC)
  // Editing an existing listing unlocks every step; a new listing is walked in order.
  const [furthestStepIndex, setFurthestStepIndex] = useState(
    isEditMode ? LISTING_PUBLISH_STEPS.length - 1 : 0,
  )
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(!isEditMode)
  // New listings start on the type chooser; the form is built around that answer.
  const [typeConfirmed, setTypeConfirmed] = useState(isEditMode)
  // The form seeds a physical listing, but nothing is "chosen" until the vendor says so.
  const [typePicked, setTypePicked] = useState(isEditMode)

  const stepIndex = useMemo(
    () => Math.max(0, LISTING_PUBLISH_STEPS.findIndex((step) => step.id === activeStep)),
    [activeStep],
  )
  const stepConfig = LISTING_PUBLISH_STEPS[stepIndex]
  const isLastStep = stepIndex === LISTING_PUBLISH_STEPS.length - 1

  const shopSlug =
    shop?.slug || shop?.shop_name?.toLowerCase().replace(/\s+/g, '-') || 'shop'

  useEffect(() => {
    if (!isEditMode) {
      dispatch(resetListingFormData())
      dispatch(loadFormFromListing(seedFormForType(LISTING_TYPES.PHYSICAL, shop?.id)))
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
    (draft: ListingDraftFromImageResult) => {
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
      setActiveStep(LISTING_PUBLISH_STEP_IDS.BASIC)
    },
    [formData.price, formData.tags, updateField],
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

  const goToStep = useCallback(
    (step: ListingPublishStepId) => {
      const target = LISTING_PUBLISH_STEPS.findIndex((entry) => entry.id === step)
      if (target < 0 || target === stepIndex) return
      if (target > furthestStepIndex) {
        toast.show(LISTING_PUBLISH_COPY.STEP_LOCKED, {
          tone: 'warning',
          message: `Complete ${stepConfig.label} to continue.`,
        })
        return
      }
      runStepValidation(activeStep)
      setActiveStep(step)
    },
    [activeStep, furthestStepIndex, runStepValidation, stepConfig.label, stepIndex, toast],
  )

  const goNext = useCallback(() => {
    if (isLastStep) return
    if (!runStepValidation(activeStep)) {
      toast.show('Fix this step to continue', {
        tone: 'danger',
        message: `Complete the required fields in ${stepConfig.label}.`,
      })
      return
    }
    const next = stepIndex + 1
    setFurthestStepIndex((current) => Math.max(current, next))
    setActiveStep(LISTING_PUBLISH_STEPS[next].id)
  }, [activeStep, isLastStep, runStepValidation, stepConfig.label, stepIndex, toast])

  const goBack = useCallback(() => {
    if (stepIndex === 0) return
    setActiveStep(LISTING_PUBLISH_STEPS[stepIndex - 1].id)
  }, [stepIndex])

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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
      >
        <YStack
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          paddingHorizontal={isDesktop ? '$6' : '$3'}
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
            isDesktop={isDesktop}
            headline={stepConfig.headline}
            subtitle={stepConfig.subtitle}
          />

          <ListingPublishStepNav
            ui={ui}
            activeStep={activeStep}
            furthestStepIndex={furthestStepIndex}
            isDesktop={isDesktop}
            onSelect={goToStep}
          />

          {activeStep === LISTING_PUBLISH_STEP_IDS.BASIC ? (
            <BasicInfoStep
              ui={ui}
              formData={formData}
              errors={displayErrors}
              isDesktop={isDesktop}
              onEditType={() => setTypeConfirmed(false)}
              onUpdate={updateField}
              onUpdateMetadata={updateMetadata}
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
              isDesktop={isDesktop}
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
              isDesktop={isDesktop}
              onChangeImages={handleChangeImages}
              onApplyAiDraft={handleApplyAiDraft}
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
      </ScrollView>

      <ListingPublishFooter
        ui={ui}
        isDesktop={isDesktop}
        safeBottom={safeBottom}
        lastSavedAt={lastSavedAt}
        isSaving={isSaving}
        isPublishing={publishProgress.isPublishing}
        showPublish={isLastStep}
        isFirstStep={stepIndex === 0}
        onBack={goBack}
        onNext={goNext}
        onSaveDraft={() => void saveDraft()}
        onPublish={() => void publishListingNow()}
      />
    </YStack>
  )
}
