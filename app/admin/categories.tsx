import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'one'

import {
  ImageUploadField,
  preparePickedImagesForUpload,
} from '~/components/media/ImageUploadField'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Icons,
  Image,
  Input,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import { optimizeCategoryImages } from '~/lib/media/optimize-category-image'
import type { PickedImage } from '~/lib/media/pick-image'
import { commerceRoutes } from '~/lib/routes'
import { supabase, type Json, type Tables, type TablesInsert, type TablesUpdate } from '~/lib/supabase'
import { uploadCategoryImage } from '~/lib/supabase/storage-upload'

type CategoryRow = Tables<'categories'>
type CategoryInsert = TablesInsert<'categories'>
type CategoryUpdate = TablesUpdate<'categories'>
type CategoryAssignmentRow = Tables<'category_assignments'>
type ListingRow = Tables<'listings'>
type ListingImageRow = Tables<'listing_images'>
type ShopRow = Tables<'shops'>
type CategoryStatus = CategoryRow['status']
type StatusFilter = 'all' | CategoryStatus

type CategoryNode = CategoryRow & {
  depth: number
  childCount: number
  hasChildren: boolean
}

type ProductBundle = {
  listing: ListingRow
  assignment: CategoryAssignmentRow
  image: ListingImageRow | null
  shop: ShopRow | null
}

type CategoryForm = {
  category: string
  parent_id: string
  description: string
  status: CategoryStatus
  position: string
  product_count: string
  lang_code: string
  seo_name: string
  page_title: string
  meta_title: string
  meta_keywords: string
  meta_description: string
  category_image_url: string
  category_icon: string
  og_image: string
  mainPairText: string
  categoryMetaText: string
}

const EMPTY_FORM: CategoryForm = {
  category: '',
  parent_id: '',
  description: '',
  status: 'A',
  position: '0',
  product_count: '0',
  lang_code: 'en',
  seo_name: '',
  page_title: '',
  meta_title: '',
  meta_keywords: '',
  meta_description: '',
  category_image_url: '',
  category_icon: '',
  og_image: '',
  mainPairText: '{}',
  categoryMetaText: '{}',
}

export default function AdminCategoriesPage() {
  return <AdminCategoriesManager />
}

function AdminCategoriesManager() {
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductBundle[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [includeChildren, setIncludeChildren] = useState(true)
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)
  const [imageImages, setImageImages] = useState<PickedImage[]>([])
  const [isOptimizingImage, setIsOptimizingImage] = useState(false)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()
  const formBusy = saving || isUploadingImage || isOptimizingImage

  async function handleImageImagesChange(images: PickedImage[]) {
    if (!images.length) {
      setImageImages([])
      return
    }
    setIsOptimizingImage(true)
    try {
      const optimized = await optimizeCategoryImages(images.slice(0, 1))
      setImageImages(optimized)
    } catch {
      setImageImages(images.slice(0, 1))
      toast.show('Image optimization skipped', {
        tone: 'warning',
        message: 'The original image will be used.',
      })
    } finally {
      setIsOptimizingImage(false)
    }
  }

  const selected = categories.find((category) => category.category_id === selectedId) ?? categories[0] ?? null
  const nodes = useMemo(() => flattenCategoryTree(categories), [categories])
  const visibleNodes = useMemo(() => filterNodes(nodes, search, statusFilter), [nodes, search, statusFilter])
  const childCategories = selected ? categories.filter((category) => normalizeParentId(category.parent_id) === selected.category_id).sort(sortCategoryRows) : []
  const selectedDescendants = selected ? getDescendantRows(categories, selected.category_id) : []
  const breadcrumb = selected ? getCategoryBreadcrumb(categories, selected) : []
  const stats = useMemo(() => getStats(categories), [categories])

  useEffect(() => {
    void loadCategories()
  }, [])

  useEffect(() => {
    if (!selectedId && categories[0]) {
      setSelectedId(categories[0].category_id)
    }
  }, [categories, selectedId])

  useEffect(() => {
    if (selected) {
      void loadProductsForCategory(selected)
    } else {
      setProducts([])
    }
  }, [selected?.category_id, includeChildren])

  async function loadCategories() {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('categories')
      .select('*')
      .order('level', { ascending: true })
      .order('position', { ascending: true })
      .order('category', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setCategories((data ?? []) as CategoryRow[])
    setLoading(false)
  }

  async function loadProductsForCategory(category: CategoryRow) {
    setProductsLoading(true)
    setError(null)
    const categoryIds = includeChildren ? [category.category_id, ...getDescendantIds(categories, category.category_id)] : [category.category_id]

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('category_assignments')
      .select('*')
      .in('category_id', categoryIds)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (assignmentsError) {
      setError(assignmentsError.message)
      setProductsLoading(false)
      return
    }

    const assignments = (assignmentsData ?? []) as CategoryAssignmentRow[]
    const listingIds = unique(assignments.map((assignment) => assignment.listing_id))
    if (!listingIds.length) {
      setProducts([])
      setProductsLoading(false)
      return
    }

    const [listingsRes, imagesRes] = await Promise.all([
      supabase.from('listings').select('*').in('id', listingIds).order('created_at', { ascending: false }),
      supabase
        .from('listing_images')
        .select('*')
        .in('listing_id', listingIds)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true }),
    ])

    const firstError = listingsRes.error ?? imagesRes.error
    if (firstError) {
      setError(firstError.message)
      setProductsLoading(false)
      return
    }

    const listings = (listingsRes.data ?? []) as ListingRow[]
    const images = (imagesRes.data ?? []) as ListingImageRow[]
    const shopIds = unique(listings.map((listing) => listing.shop_id))
    const shopsRes = shopIds.length ? await supabase.from('shops').select('*').in('id', shopIds) : { data: [], error: null }

    if (shopsRes.error) {
      setError(shopsRes.error.message)
      setProductsLoading(false)
      return
    }

    const listingById = indexBy(listings, 'id')
    const imagesByListingId = groupBy(images, 'listing_id')
    const shopsById = indexBy((shopsRes.data ?? []) as ShopRow[], 'id')

    setProducts(
      assignments
        .map((assignment) => {
          const listing = listingById[assignment.listing_id]
          if (!listing) return null
          return {
            listing,
            assignment,
            image: getPrimaryImage(imagesByListingId[listing.id] ?? []),
            shop: shopsById[listing.shop_id] ?? null,
          }
        })
        .filter(Boolean) as ProductBundle[],
    )
    setProductsLoading(false)
  }

  function openCreate(parentId?: string | null) {
    const parent = parentId ? categories.find((category) => category.category_id === parentId) : null
    setFormMode('create')
    if (parent) setSelectedId(parent.category_id)
    setForm({ ...EMPTY_FORM, parent_id: parentId ?? '', position: String(getNextPosition(categories, parentId ?? null)) })
    setImageImages([])
    resetUpload()
    setFormOpen(true)
  }

  function openEdit(category: CategoryRow) {
    setFormMode('edit')
    setForm(categoryToForm(category))
    setImageImages([])
    resetUpload()
    setFormOpen(true)
  }

  async function resolveCategoryImageUrl() {
    if (!imageImages.length) return form.category_image_url

    const [file] = await preparePickedImagesForUpload(imageImages.slice(0, 1))
    if (!file) throw new Error('Please select a valid image.')

    setIsUploadingImage(true)
    trackUpload(1)
    const { data, error: uploadError } = await uploadCategoryImage(file, {
      categoryId: formMode === 'edit' ? selected?.category_id : null,
      onProgress: trackUpload,
    })
    if (uploadError || !data) {
      throw new Error(uploadError ?? 'Category image upload failed.')
    }
    return data.publicUrl
  }

  async function submitForm() {
    const validationError = validateForm(form, categories, formMode === 'edit' ? selected?.category_id ?? null : null)
    if (validationError) {
      toast.show('Check category', { tone: 'danger', message: validationError })
      return
    }

    setSaving(true)
    try {
      const categoryImageUrl = await resolveCategoryImageUrl()
      const payload = formToPayload({ ...form, category_image_url: categoryImageUrl })
      const result =
        formMode === 'create'
          ? await supabase.from('categories').insert(payload as CategoryInsert).select('*').single()
          : selected
            ? await supabase.from('categories').update(payload as CategoryUpdate).eq('category_id', selected.category_id).select('*').single()
            : null

      if (!result) return

      if (result.error) {
        setError(result.error.message)
        toast.show('Unable to save category', { tone: 'danger', message: result.error.message })
        return
      }

      const saved = result.data as CategoryRow
      setCategories((current) => (formMode === 'create' ? [...current, saved] : current.map((row) => (row.category_id === saved.category_id ? saved : row))))
      setSelectedId(saved.category_id)
      setImageImages([])
      resetUpload()
      setFormOpen(false)
      toast.show(formMode === 'create' ? 'Category created' : 'Category updated', { tone: 'success' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Try again.'
      setError(message)
      toast.show('Unable to save category', { tone: 'danger', message })
    } finally {
      setIsUploadingImage(false)
      setSaving(false)
      resetUpload()
    }
  }

  async function updateStatus(category: CategoryRow, status: CategoryStatus) {
    await updateCategory(category, { status })
  }

  async function updateCategory(category: CategoryRow, patch: CategoryUpdate) {
    setSaving(true)
    const { data, error: updateError } = await supabase
      .from('categories')
      .update(patch)
      .eq('category_id', category.category_id)
      .select('*')
      .single()

    if (updateError) {
      setError(updateError.message)
      toast.show('Unable to update category', { tone: 'danger', message: updateError.message })
    } else {
      const updated = data as CategoryRow
      setCategories((current) => current.map((row) => (row.category_id === updated.category_id ? updated : row)))
    }
    setSaving(false)
  }

  async function deleteCategory(category: CategoryRow) {
    const childCount = categories.filter((row) => row.parent_id === category.category_id).length
    if (childCount > 0) {
      toast.show('Cannot delete category', { tone: 'danger', message: 'Move or delete its subcategories first.' })
      return
    }

    if (products.length > 0) {
      toast.show('Cannot delete category', { tone: 'danger', message: 'Remove assigned products before deleting this category.' })
      return
    }

    setSaving(true)
    const { error: deleteError } = await supabase.from('categories').delete().eq('category_id', category.category_id)
    if (deleteError) {
      setError(deleteError.message)
      toast.show('Unable to delete category', { tone: 'danger', message: deleteError.message })
    } else {
      setCategories((current) => current.filter((row) => row.category_id !== category.category_id))
      setSelectedId(null)
      setProducts([])
      toast.show('Category deleted', { tone: 'success' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <YStack minHeight={420} alignItems="center" justifyContent="center" gap="$3">
        <Spinner size="large" />
        <Text color="$color10">Loading category hierarchy...</Text>
      </YStack>
    )
  }

  return (
    <YStack width="100%" gap="$5" paddingHorizontal={isDesktop ? '$6' : '$4'} paddingTop="$5" paddingBottom={safeBottom + 28}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={28} fontWeight="800" color="$color12">Category Management</Text>
          <Text color="$color10">Manage hierarchical categories, SEO fields, media, status, and assigned products.</Text>
        </YStack>
        <Button icon={Icons.Plus} onPress={() => openCreate(null)}>Create main category</Button>
      </XStack>

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">{error}</Text>
        </YStack>
      ) : null}

      <XStack gap="$3" flexWrap="wrap">
        <StatCard label="Total categories" value={stats.total} tone="info" />
        <StatCard label="Active" value={stats.active} tone="success" />
        <StatCard label="Disabled" value={stats.disabled} tone="danger" />
        <StatCard label="Hidden" value={stats.hidden} tone="warning" />
        <StatCard label="Assigned products" value={stats.products} tone="brand" />
      </XStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={1} minWidth={isDesktop ? 400 : 300} gap="$3">
          <FilterPanel
            search={search}
            statusFilter={statusFilter}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
          />
          <CategoryTreePanel
            nodes={visibleNodes}
            selectedId={selected?.category_id ?? null}
            onSelect={setSelectedId}
            onCreateChild={(parentId) => openCreate(parentId)}
          />
        </YStack>

        <YStack flex={1.4} minWidth={isDesktop ? 520 : 300} gap="$4">
          {selected ? (
            <CategoryDetailsPanel
              category={selected}
              breadcrumb={breadcrumb}
              childCategories={childCategories}
              descendantCategories={selectedDescendants}
              products={products}
              productsLoading={productsLoading}
              includeChildren={includeChildren}
              busy={saving}
              onToggleIncludeChildren={() => setIncludeChildren((value) => !value)}
              onCreateChild={() => openCreate(selected.category_id)}
              onEdit={() => openEdit(selected)}
              onDelete={() => deleteCategory(selected)}
              onStatusChange={(status) => updateStatus(selected, status)}
              onSelectCategory={setSelectedId}
              onOpenProduct={(listing) => router.push(commerceRoutes.listing(listing.slug ?? listing.id))}
              onOpenAdminProducts={() => router.push('/admin/products' as any)}
            />
          ) : (
            <EmptyPanel title="No category selected" description="Select a category to view details and assigned products." />
          )}
        </YStack>
      </XStack>

      <CategoryEditorDialog
        open={formOpen}
        mode={formMode}
        form={form}
        categories={categories}
        selectedId={formMode === 'edit' ? selected?.category_id ?? null : null}
        createUnderCategory={formMode === 'create' && form.parent_id ? categories.find((category) => category.category_id === form.parent_id) ?? null : null}
        busy={formBusy}
        imageImages={imageImages}
        uploadProgress={uploadProgress}
        onImageImagesChange={handleImageImagesChange}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setImageImages([])
            resetUpload()
          }
        }}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitForm}
      />
    </YStack>
  )
}

function FilterPanel({
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: {
  search: string
  statusFilter: StatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
}) {
  return (
    <YStack gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontWeight="800" color="$color12">Find categories</Text>
          <Text color="$color10" fontSize={12}>Search name, description, SEO slug, or ID.</Text>
        </YStack>
        <Button tone="ghost" size="$3" onPress={() => { onSearchChange(''); onStatusChange('all') }}>Reset</Button>
      </XStack>
      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
        <Field label="Search">
          <Input value={search} onChangeText={onSearchChange} minWidth={220} placeholder="Women fashion, CAT_, seo slug..." />
        </Field>
        <Field label="Status">
          <FilterSelect value={statusFilter} options={[{ value: 'all', label: 'All statuses' }, ...statusOptions()]} onValueChange={(value) => onStatusChange(value as StatusFilter)} />
        </Field>
      </XStack>
    </YStack>
  )
}

function CategoryTreePanel({
  nodes,
  selectedId,
  onSelect,
  onCreateChild,
}: {
  nodes: CategoryNode[]
  selectedId: string | null
  onSelect: (categoryId: string) => void
  onCreateChild: (categoryId: string) => void
}) {
  return (
    <YStack gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <Text fontWeight="800" color="$color12">Category hierarchy</Text>
        <Badge tone="info">{nodes.length} shown</Badge>
      </XStack>
      <ScrollView maxHeight={620} showsVerticalScrollIndicator={false}>
        <YStack gap="$2">
          {nodes.length ? nodes.map((node) => (
            <XStack
              key={node.category_id}
              gap="$2"
              alignItems="center"
              padding="$2.5"
              paddingLeft={Math.min(36, node.depth * 14) + 10}
              borderRadius={radius.chip}
              borderWidth={1}
              borderColor={node.category_id === selectedId ? '$color9' : '$borderColor'}
              backgroundColor={node.category_id === selectedId ? '$color2' : '$background'}
              cursor="pointer"
              hoverStyle={{ borderColor: '$color8' }}
              onPress={() => onSelect(node.category_id)}
            >
              <CategoryAvatar category={node} size={38} />
              <YStack flex={1} minWidth={0}>
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <Text fontWeight="800" color="$color12" numberOfLines={1}>{node.category}</Text>
                  <Badge tone={categoryStatusTone(node.status)} size="sm">{statusLabel(node.status)}</Badge>
                </XStack>
                <Text color="$color10" fontSize={12} numberOfLines={1}>
                  {node.depth === 0 ? 'Main category' : `Subcategory level ${node.depth}`} • Position {node.position ?? 0} • {node.childCount} subcategories • {node.product_count ?? 0} products
                </Text>
              </YStack>
              <Button size="$2.5" tone="outline" icon={Icons.Plus} onPress={() => onCreateChild(node.category_id)}>Add subcategory</Button>
            </XStack>
          )) : <Text color="$color10">No categories match the current filters.</Text>}
        </YStack>
      </ScrollView>
    </YStack>
  )
}

function CategoryDetailsPanel({
  category,
  breadcrumb,
  childCategories,
  descendantCategories,
  products,
  productsLoading,
  includeChildren,
  busy,
  onToggleIncludeChildren,
  onCreateChild,
  onEdit,
  onDelete,
  onStatusChange,
  onSelectCategory,
  onOpenProduct,
  onOpenAdminProducts,
}: {
  category: CategoryRow
  breadcrumb: CategoryRow[]
  childCategories: CategoryRow[]
  descendantCategories: CategoryNode[]
  products: ProductBundle[]
  productsLoading: boolean
  includeChildren: boolean
  busy: boolean
  onToggleIncludeChildren: () => void
  onCreateChild: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: CategoryStatus) => void
  onSelectCategory: (categoryId: string) => void
  onOpenProduct: (listing: ListingRow) => void
  onOpenAdminProducts: () => void
}) {
  const mainCategory = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null
  const rootCategory = breadcrumb[0] ?? category
  const categoryType = category.parent_id ? 'Subcategory' : 'Main category'

  return (
    <YStack gap="$4">
      <YStack gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
        <XStack gap="$3" alignItems="center">
          <CategoryAvatar category={category} size={74} />
          <YStack flex={1} minWidth={0}>
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <Text fontSize={22} fontWeight="800" color="$color12" numberOfLines={1}>{category.category}</Text>
              <Badge tone={categoryStatusTone(category.status)}>{statusLabel(category.status)}</Badge>
            </XStack>
            <Text color="$color10" numberOfLines={2}>{category.description || 'No description set.'}</Text>
            <Text color="$color10" fontSize={12} marginTop="$1">{category.category_id}</Text>
          </YStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          {breadcrumb.map((item, index) => (
            <XStack key={item.category_id} gap="$2" alignItems="center">
              <Button size="$2.5" tone={item.category_id === category.category_id ? 'secondary' : 'ghost'} onPress={() => onSelectCategory(item.category_id)}>
                {item.category}
              </Button>
              {index < breadcrumb.length - 1 ? <Icons.ChevronRight size={14} color="$color10" /> : null}
            </XStack>
          ))}
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button size="$3" icon={Icons.Plus} onPress={onCreateChild}>Add subcategory</Button>
          <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit}>Edit category</Button>
          <FilterSelect value={category.status} options={statusOptions()} onValueChange={(value) => onStatusChange(value as CategoryStatus)} />
          <ConfirmDialog
            title="Delete category?"
            description="Delete is blocked when subcategories or product assignments exist."
            confirmLabel="Delete category"
            destructive
            onConfirm={onDelete}
            trigger={<Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>Delete</Button>}
          />
        </XStack>
      </YStack>

      <DetailSection title="Category details">
        <DetailRow label="Category type" value={categoryType} />
        <DetailRow label="Main category" value={mainCategory?.category ?? (category.parent_id ? category.parent_id : 'This is a main category')} />
        <DetailRow label="Top category" value={rootCategory.category} />
        <DetailRow label="Subcategories" value={childCategories.length} />
        <DetailRow label="Level" value={category.level ?? 0} />
        <DetailRow label="Position" value={category.position ?? 0} />
        <DetailRow label="Product count" value={category.product_count ?? 0} />
        <DetailRow label="Language" value={category.lang_code} />
        <DetailRow label="SEO name" value={category.seo_name ?? 'Not set'} />
        <DetailRow label="SEO path" value={category.seo_path ?? 'Generated by database'} />
        <DetailRow label="ID path" value={category.id_path ?? 'Generated by database'} />
        <DetailRow label="Created" value={formatDate(category.created_at)} />
        <DetailRow label="Updated" value={formatDate(category.updated_at)} />
      </DetailSection>

      <DetailSection title="Direct subcategories">
        {childCategories.length ? childCategories.map((child) => (
          <XStack key={child.category_id} gap="$3" alignItems="center" padding="$2.5" borderRadius={radius.chip} backgroundColor="$color2" cursor="pointer" onPress={() => onSelectCategory(child.category_id)}>
            <CategoryAvatar category={child} size={38} />
            <YStack flex={1} minWidth={0}>
              <Text fontWeight="800" color="$color12" numberOfLines={1}>{child.category}</Text>
              <Text color="$color10" fontSize={12}>{child.product_count ?? 0} products • {statusLabel(child.status)} • Open to see full details</Text>
            </YStack>
            <Button size="$2.5" tone="outline" onPress={() => onSelectCategory(child.category_id)}>Open</Button>
            <Icons.ChevronRight size={16} color="$color10" />
          </XStack>
        )) : <Text color="$color10">No subcategories. Use "Add subcategory" to create one under this category.</Text>}
      </DetailSection>

      {descendantCategories.length > childCategories.length ? (
        <DetailSection title="All nested subcategories">
          {descendantCategories.map((child) => (
            <XStack key={child.category_id} gap="$3" alignItems="center" padding="$2.5" paddingLeft={Math.min(42, child.depth * 14) + 10} borderRadius={radius.chip} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" cursor="pointer" onPress={() => onSelectCategory(child.category_id)}>
              <CategoryAvatar category={child} size={34} />
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="800" color="$color12" numberOfLines={1}>{child.category}</Text>
                <Text color="$color10" fontSize={12}>Subcategory level {child.depth} • {child.childCount} inside • {child.product_count ?? 0} products</Text>
              </YStack>
              <Button size="$2.5" tone="outline" onPress={() => onSelectCategory(child.category_id)}>Open</Button>
            </XStack>
          ))}
        </DetailSection>
      ) : null}

      <DetailSection title="Related products">
        <XStack justifyContent="space-between" gap="$3" flexWrap="wrap" alignItems="center">
          <Text color="$color10" fontSize={12}>
            Showing products assigned to {includeChildren ? 'this category and all subcategories' : 'this category only'}.
          </Text>
          <XStack gap="$2">
            <Button size="$3" tone="outline" onPress={onToggleIncludeChildren}>
              {includeChildren ? 'Only this category' : 'Include subcategories'}
            </Button>
            <Button size="$3" tone="outline" icon={Icons.Package} onPress={onOpenAdminProducts}>All products</Button>
          </XStack>
        </XStack>
        {productsLoading ? (
          <XStack gap="$2" alignItems="center"><Spinner /><Text color="$color10">Loading products...</Text></XStack>
        ) : products.length ? (
          products.map((bundle) => (
            <ProductRow key={`${bundle.assignment.id}-${bundle.listing.id}`} bundle={bundle} onOpen={() => onOpenProduct(bundle.listing)} />
          ))
        ) : (
          <Text color="$color10">No products are assigned to this category.</Text>
        )}
      </DetailSection>

      <DetailSection title="SEO and media">
        <DetailRow label="Page title" value={category.page_title ?? 'Not set'} />
        <DetailRow label="Meta title" value={category.meta_title ?? 'Not set'} />
        <DetailRow label="Meta keywords" value={category.meta_keywords ?? 'Not set'} />
        <DetailRow label="Meta description" value={category.meta_description ?? 'Not set'} />
        <DetailRow label="OG image" value={category.og_image ?? 'Not set'} />
        <DetailRow label="Icon" value={category.category_icon ?? 'Not set'} />
      </DetailSection>
    </YStack>
  )
}

function ProductRow({ bundle, onOpen }: { bundle: ProductBundle; onOpen: () => void }) {
  const { listing, assignment, image, shop } = bundle
  return (
    <XStack gap="$3" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$color2" alignItems="center">
      <ProductThumb image={image} size={56} />
      <YStack flex={1} minWidth={0}>
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Text fontWeight="800" color="$color12" numberOfLines={1}>{listing.title}</Text>
          {assignment.is_primary ? <Badge tone="success" size="sm">Primary</Badge> : <Badge tone="neutral" size="sm">Secondary</Badge>}
          <Badge tone={listing.is_active ? 'success' : 'warning'} size="sm">{listing.is_active ? 'Active' : 'Inactive'}</Badge>
        </XStack>
        <Text color="$color10" fontSize={12} numberOfLines={1}>
          {shop?.shop_name ?? listing.shop_id} • {formatMoney(listing.price)} • {listing.listing_status}
        </Text>
      </YStack>
      <Button size="$3" tone="outline" icon={Icons.ExternalLink} onPress={onOpen}>Open</Button>
    </XStack>
  )
}

function CategoryEditorDialog({
  open,
  mode,
  form,
  categories,
  selectedId,
  createUnderCategory,
  busy,
  imageImages,
  uploadProgress,
  onImageImagesChange,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean
  mode: 'create' | 'edit'
  form: CategoryForm
  categories: CategoryRow[]
  selectedId: string | null
  createUnderCategory: CategoryRow | null
  busy: boolean
  imageImages: PickedImage[]
  uploadProgress: number | null
  onImageImagesChange: (images: PickedImage[]) => void
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<CategoryForm>) => void
  onSubmit: () => void
}) {
  const mainCategoryOptions = getParentOptions(categories, selectedId)
  const isCreatingSubcategory = mode === 'create' && !!createUnderCategory
  const currentImageUrl = form.category_image_url.trim()
  const showCurrentImage = !!currentImageUrl && imageImages.length === 0

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={880} maxHeight="92vh" width="94%" overflow="hidden">
          <YStack gap="$3" maxHeight="100%" width="100%">
            <YStack gap="$2" flexShrink={0} paddingRight="$6">
              <DialogTitle>{mode === 'create' ? (isCreatingSubcategory ? 'Create subcategory' : 'Create main category') : 'Edit category'}</DialogTitle>
              <DialogDescription>
                {isCreatingSubcategory
                  ? `This new category will be placed under ${createUnderCategory.category}.`
                  : 'Manage category hierarchy, SEO metadata, image fields, and visibility.'}
              </DialogDescription>
            </YStack>

            <ScrollView
              flex={1}
              maxHeight="58vh"
              minHeight={180}
              showsVerticalScrollIndicator
            >
              <YStack gap="$3" paddingRight="$1" paddingBottom="$2">
              <Field label="Category name" required>
                <Input value={form.category} onChangeText={(category) => onChange({ category, seo_name: form.seo_name || generateSeoName(category) })} />
              </Field>
              <Field label="Description">
                <TextArea value={form.description} onChangeText={(description) => onChange({ description })} />
              </Field>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Place under">
                    <FilterSelect value={form.parent_id || 'root'} options={mainCategoryOptions} onValueChange={(parent_id) => onChange({ parent_id: parent_id === 'root' ? '' : parent_id })} />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={160}>
                  <Field label="Status">
                    <FilterSelect value={form.status} options={statusOptions()} onValueChange={(status) => onChange({ status: status as CategoryStatus })} />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={120}>
                  <Field label="Position">
                    <Input value={form.position} keyboardType="number-pad" onChangeText={(position) => onChange({ position })} />
                  </Field>
                </YStack>
              </XStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}>
                  <Field label="Language code">
                    <Input value={form.lang_code} onChangeText={(lang_code) => onChange({ lang_code })} placeholder="en" />
                  </Field>
                </YStack>
                <YStack flex={2} minWidth={220}>
                  <Field label="SEO name">
                    <Input value={form.seo_name} onChangeText={(seo_name) => onChange({ seo_name })} placeholder="women-fashion" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={160}>
                  <Field label="Product count">
                    <Input value={form.product_count} keyboardType="number-pad" onChangeText={(product_count) => onChange({ product_count })} />
                  </Field>
                </YStack>
              </XStack>
              <YStack gap="$2">
                {showCurrentImage ? (
                  <YStack
                    width="100%"
                    height={180}
                    borderRadius={radius.card}
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="$color3"
                    overflow="hidden"
                    alignItems="center"
                    justifyContent="center"
                    position="relative"
                  >
                    <Image
                      src={currentImageUrl}
                      alt={form.category || 'Category image'}
                      width="100%"
                      height="100%"
                      objectFit="contain"
                      {...({ loading: 'lazy' } as object)}
                    />
                  </YStack>
                ) : null}
                {showCurrentImage ? (
                  <Text fontSize={12} color="$color10">
                    Current image shown above. Select a new image to replace it, or leave empty to keep this one.
                  </Text>
                ) : null}
                <ImageUploadField
                  label={showCurrentImage ? 'Replace category image' : 'Category image'}
                  value={imageImages}
                  onChange={onImageImagesChange}
                  disabled={busy}
                  skipCrop
                  previewObjectFit="contain"
                  hint="Drag and drop or browse. PNG, JPG, WebP, or GIF up to 8 MB. Oversized images are resized automatically (aspect ratio kept). Uploads when you save."
                  uploadProgress={uploadProgress}
                  uploadLabel="Uploading to categories_media…"
                />
              </YStack>
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Category icon">
                    <Input value={form.category_icon} onChangeText={(category_icon) => onChange({ category_icon })} />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={220}>
                  <Field label="OG image">
                    <Input value={form.og_image} onChangeText={(og_image) => onChange({ og_image })} />
                  </Field>
                </YStack>
              </XStack>
              <Field label="Page title">
                <Input value={form.page_title} onChangeText={(page_title) => onChange({ page_title })} />
              </Field>
              <Field label="Meta title">
                <Input value={form.meta_title} onChangeText={(meta_title) => onChange({ meta_title })} />
              </Field>
              <Field label="Meta keywords">
                <Input value={form.meta_keywords} onChangeText={(meta_keywords) => onChange({ meta_keywords })} />
              </Field>
              <Field label="Meta description">
                <TextArea value={form.meta_description} onChangeText={(meta_description) => onChange({ meta_description })} />
              </Field>
              <Field label="main_pair JSON">
                <TextArea value={form.mainPairText} onChangeText={(mainPairText) => onChange({ mainPairText })} />
              </Field>
              <Field label="category_meta JSON">
                <TextArea value={form.categoryMetaText} onChangeText={(categoryMetaText) => onChange({ categoryMetaText })} />
              </Field>
              </YStack>
            </ScrollView>

            <XStack
              gap="$2"
              justifyContent="flex-end"
              flexWrap="wrap"
              flexShrink={0}
              paddingTop="$2"
              paddingBottom="$2"
              borderTopWidth={1}
              borderTopColor="$borderColor"
            >
              <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onPress={onSubmit} disabled={busy || !form.category.trim()}>
                {busy ? (uploadProgress != null ? 'Uploading…' : 'Saving...') : 'Save category'}
              </Button>
            </XStack>
          </YStack>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" gap="$2">
        <YStack width={4} height={18} borderRadius={999} backgroundColor="$color9" />
        <Text fontWeight="800" color="$color12">{title}</Text>
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
    </YStack>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color="$color10" fontSize={12}>{label}</Text>
      <Text flex={2} color="$color12" fontSize={12} fontWeight="600" textAlign="right">{String(value)}</Text>
    </XStack>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color="$color11">{label}{required ? ' *' : ''}</Text>
      {children}
    </YStack>
  )
}

function FilterSelect({ value, options, onValueChange }: { value: string; options: { value: string; label: string }[]; onValueChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger minWidth={170} iconAfter={<Icons.ChevronDown size={16} />}>
        <Select.Value />
      </SelectTrigger>
      <SelectContent zIndex={300000}>
        <SelectViewport maxHeight={340}>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </Select>
  )
}

function CategoryAvatar({ category, size }: { category: Pick<CategoryRow, 'category' | 'category_image_url' | 'category_icon' | 'main_pair'>; size: number }) {
  const imageUrl = getCategoryImage(category)
  if (imageUrl) {
    return (
      <YStack
        width={size}
        height={size}
        borderRadius={radius.card}
        backgroundColor="$color3"
        overflow="hidden"
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        <Image
          src={imageUrl}
          alt={category.category}
          width="100%"
          height="100%"
          objectFit="contain"
          {...({ loading: 'lazy' } as object)}
        />
      </YStack>
    )
  }

  return (
    <YStack width={size} height={size} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
      {category.category_icon ? <Text fontSize={Math.max(14, size * 0.32)}>{category.category_icon}</Text> : <Icons.FolderTree size={Math.round(size * 0.38)} color="$color10" />}
    </YStack>
  )
}

function ProductThumb({ image, size }: { image: ListingImageRow | null; size: number }) {
  if (image?.image_url) {
    return <Image src={image.image_url} alt={image.alt_text ?? 'Product'} width={size} height={size} objectFit="cover" borderRadius={radius.card} backgroundColor="$color3" />
  }
  return (
    <YStack width={size} height={size} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.Package size={Math.round(size * 0.4)} color="$color10" />
    </YStack>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'info' | 'success' | 'danger' | 'warning' | 'brand' }) {
  return (
    <YStack flex={1} minWidth={150} padding="$3" gap="$2" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <Badge tone={tone}>{label}</Badge>
      <Text fontSize={24} fontWeight="800" color="$color12">{value}</Text>
    </YStack>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={260} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.FolderTree size={30} color="$color10" />
      <Text fontWeight="800" color="$color12">{title}</Text>
      <Text color="$color10" textAlign="center">{description}</Text>
    </YStack>
  )
}

function flattenCategoryTree(categories: CategoryRow[]) {
  const ids = new Set(categories.map((category) => category.category_id))
  const childrenByParent = new Map<string, CategoryRow[]>()
  for (const category of categories) {
    const parentId = normalizeParentId(category.parent_id)
    const key = parentId && ids.has(parentId) ? parentId : 'root'
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), category])
  }
  for (const [key, rows] of childrenByParent) {
    childrenByParent.set(key, rows.sort(sortCategoryRows))
  }

  const flattened: CategoryNode[] = []
  const visited = new Set<string>()
  const visit = (category: CategoryRow, depth: number) => {
    if (visited.has(category.category_id)) return
    visited.add(category.category_id)
    const children = childrenByParent.get(category.category_id) ?? []
    flattened.push({ ...category, depth, childCount: children.length, hasChildren: children.length > 0 })
    for (const child of children) visit(child, depth + 1)
  }

  for (const root of childrenByParent.get('root') ?? []) {
    visit(root, 0)
  }
  for (const category of [...categories].sort(sortCategoryRows)) {
    visit(category, 0)
  }

  return flattened
}

function filterNodes(nodes: CategoryNode[], search: string, status: StatusFilter) {
  const term = search.trim().toLowerCase()
  const matches = nodes.filter((node) => {
    const matchesStatus = status === 'all' || node.status === status
    const matchesSearch =
      !term ||
      node.category.toLowerCase().includes(term) ||
      node.category_id.toLowerCase().includes(term) ||
      (node.description ?? '').toLowerCase().includes(term) ||
      (node.seo_name ?? '').toLowerCase().includes(term)
    return matchesStatus && matchesSearch
  })
  if (!term) return matches

  const nodeById = indexBy(nodes, 'category_id')
  const childrenByParent = new Map<string, CategoryNode[]>()
  for (const node of nodes) {
    const parentId = normalizeParentId(node.parent_id)
    if (!parentId) continue
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), node])
  }
  const visibleIds = new Set<string>()

  const includeDescendants = (categoryId: string) => {
    for (const child of childrenByParent.get(categoryId) ?? []) {
      visibleIds.add(child.category_id)
      includeDescendants(child.category_id)
    }
  }

  for (const node of matches) {
    visibleIds.add(node.category_id)
    includeDescendants(node.category_id)
    let current = normalizeParentId(node.parent_id) ? nodeById[normalizeParentId(node.parent_id) as string] : undefined
    while (current) {
      visibleIds.add(current.category_id)
      const parentId = normalizeParentId(current.parent_id)
      current = parentId ? nodeById[parentId] : undefined
    }
  }

  return nodes.filter((node) => visibleIds.has(node.category_id) && (status === 'all' || node.status === status))
}

function categoryToForm(category: CategoryRow): CategoryForm {
  return {
    category: category.category,
    parent_id: category.parent_id ?? '',
    description: category.description ?? '',
    status: category.status,
    position: String(category.position ?? 0),
    product_count: String(category.product_count ?? 0),
    lang_code: category.lang_code,
    seo_name: category.seo_name ?? '',
    page_title: category.page_title ?? '',
    meta_title: category.meta_title ?? '',
    meta_keywords: category.meta_keywords ?? '',
    meta_description: category.meta_description ?? '',
    category_image_url: category.category_image_url ?? '',
    category_icon: category.category_icon ?? '',
    og_image: category.og_image ?? '',
    mainPairText: stringifyJson(category.main_pair),
    categoryMetaText: stringifyJson(category.category_meta),
  }
}

function formToPayload(form: CategoryForm): CategoryInsert | CategoryUpdate {
  return {
    category: form.category.trim(),
    parent_id: nullableText(form.parent_id),
    description: nullableText(form.description),
    status: form.status,
    position: toNumber(form.position, 0),
    product_count: toNumber(form.product_count, 0),
    lang_code: form.lang_code.trim() || 'en',
    seo_name: nullableText(form.seo_name),
    page_title: nullableText(form.page_title),
    meta_title: nullableText(form.meta_title),
    meta_keywords: nullableText(form.meta_keywords),
    meta_description: nullableText(form.meta_description),
    category_image_url: nullableText(form.category_image_url),
    category_icon: nullableText(form.category_icon),
    og_image: nullableText(form.og_image),
    main_pair: parseJson(form.mainPairText, {}) as Json,
    category_meta: parseJson(form.categoryMetaText, {}) as Json,
  }
}

function validateForm(form: CategoryForm, categories: CategoryRow[], selectedId: string | null) {
  if (!form.category.trim()) return 'Category name is required.'
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(form.lang_code.trim() || 'en')) return 'Language code must look like en or en-US.'
  if (form.seo_name.trim() && !/^[a-z0-9_-]+$/i.test(form.seo_name.trim())) return 'SEO name can use letters, numbers, underscores, and dashes only.'
  if (toNumber(form.position, -1) < 0) return 'Position must be zero or greater.'
  if (toNumber(form.product_count, -1) < 0) return 'Product count must be zero or greater.'
  if (!isJsonObject(form.mainPairText)) return 'main_pair must be a valid JSON object.'
  if (!isJsonObject(form.categoryMetaText)) return 'category_meta must be a valid JSON object.'
  if (selectedId && form.parent_id) {
    if (selectedId === form.parent_id) return 'A category cannot be placed under itself.'
    if (getDescendantIds(categories, selectedId).includes(form.parent_id)) return 'A category cannot move inside its own subcategory.'
  }
  return null
}

function getParentOptions(categories: CategoryRow[], selectedId: string | null) {
  const blocked = selectedId ? new Set([selectedId, ...getDescendantIds(categories, selectedId)]) : new Set<string>()
  return [
    { value: 'root', label: 'Make it a main category' },
    ...flattenCategoryTree(categories)
      .filter((node) => !blocked.has(node.category_id))
      .map((node) => ({ value: node.category_id, label: `${'— '.repeat(node.depth)}${node.category}` })),
  ]
}

function getCategoryBreadcrumb(categories: CategoryRow[], category: CategoryRow) {
  const byId = indexBy(categories, 'category_id')
  const path: CategoryRow[] = []
  let current: CategoryRow | undefined = category
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current.category_id)) break
    visited.add(current.category_id)
    path.unshift(current)
    const parentId = normalizeParentId(current.parent_id)
    current = parentId ? byId[parentId] : undefined
  }
  return path
}

function getDescendantIds(categories: CategoryRow[], categoryId: string): string[] {
  return getDescendantRows(categories, categoryId).map((category) => category.category_id)
}

function getDescendantRows(categories: CategoryRow[], categoryId: string): CategoryNode[] {
  const childrenByParent = new Map<string, CategoryRow[]>()
  for (const category of categories) {
    const parentId = normalizeParentId(category.parent_id)
    if (!parentId) continue
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), category])
  }
  for (const [key, rows] of childrenByParent) {
    childrenByParent.set(key, rows.sort(sortCategoryRows))
  }

  const descendants: CategoryNode[] = []
  const visited = new Set<string>()
  const visit = (parentId: string, depth: number) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (visited.has(child.category_id)) continue
      visited.add(child.category_id)
      const nested = childrenByParent.get(child.category_id) ?? []
      descendants.push({ ...child, depth, childCount: nested.length, hasChildren: nested.length > 0 })
      visit(child.category_id, depth + 1)
    }
  }
  visit(categoryId, 1)
  return descendants
}

function normalizeParentId(parentId: string | null | undefined) {
  const normalized = parentId?.trim()
  return normalized || null
}

function getStats(categories: CategoryRow[]) {
  return {
    total: categories.length,
    active: categories.filter((category) => category.status === 'A').length,
    disabled: categories.filter((category) => category.status === 'D').length,
    hidden: categories.filter((category) => category.status === 'H').length,
    products: categories.reduce((sum, category) => sum + (category.product_count ?? 0), 0),
  }
}

function statusOptions() {
  return [
    { value: 'A', label: 'Active' },
    { value: 'D', label: 'Disabled' },
    { value: 'H', label: 'Hidden' },
  ]
}

function categoryStatusTone(status: CategoryStatus) {
  if (status === 'A') return 'success' as const
  if (status === 'D') return 'danger' as const
  return 'warning' as const
}

function statusLabel(status: CategoryStatus) {
  if (status === 'A') return 'Active'
  if (status === 'D') return 'Disabled'
  return 'Hidden'
}

function getCategoryImage(category: Pick<CategoryRow, 'category_image_url' | 'main_pair'>) {
  if (category.category_image_url) return category.category_image_url
  const pair = category.main_pair
  if (!pair || typeof pair !== 'object' || Array.isArray(pair)) return null
  const detailed = (pair as Record<string, unknown>).detailed
  if (detailed && typeof detailed === 'object' && !Array.isArray(detailed)) {
    const record = detailed as Record<string, unknown>
    return [record.url, record.https_image_path, record.image_path, record.http_image_path].find((value): value is string => typeof value === 'string' && value.length > 0) ?? null
  }
  const icon = (pair as Record<string, unknown>).icon
  return typeof icon === 'string' ? icon : null
}

function getPrimaryImage(images: ListingImageRow[]) {
  return images.find((image) => image.is_primary) ?? images[0] ?? null
}

function getNextPosition(categories: CategoryRow[], parentId: string | null) {
  const siblings = categories.filter((category) => normalizeParentId(category.parent_id) === normalizeParentId(parentId))
  return Math.max(0, ...siblings.map((category) => category.position ?? 0)) + 10
}

function sortCategoryRows(a: CategoryRow, b: CategoryRow) {
  if ((a.position ?? 0) !== (b.position ?? 0)) return (a.position ?? 0) - (b.position ?? 0)
  return a.category.localeCompare(b.category)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function indexBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T>>((acc, row) => {
    acc[String(row[key])] = row
    return acc
  }, {})
}

function groupBy<T extends Record<string, any>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const id = String(row[key])
    acc[id] = [...(acc[id] ?? []), row]
    return acc
  }, {})
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseJson(value: string, fallback: Record<string, unknown>) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function isJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value || '{}')
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed)
  } catch {
    return false
  }
}

function stringifyJson(value: unknown) {
  if (!value || typeof value !== 'object') return '{}'
  return JSON.stringify(value)
}

function generateSeoName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0))
}
