import { useEffect, useState } from 'react'

import { ImageUploadField, preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import { CommercePanel } from '~/commerce/components'
import {
  shopAnnouncementFromMetadata,
  updateShopAnnouncement,
} from '~/commerce/components/ShopAnnouncementBanner'
import { LocationFields } from '~/components/geo'
import { PhoneInput } from '~/components/forms/PhoneInput'
import {
  fetchShopAddressForOwner,
  shopAddressInputFromRow,
  upsertShopAddress,
} from '~/commerce/lib/shop-address'
import { updateShopLogo, updateShopProfile } from '~/commerce/lib/seller-listings'
import type { ShopAddress } from '~/commerce/lib/shop-location'
import type { VendorShop } from '~/hooks/useVendorShops'
import type { GeoLocationParts } from '~/lib/geo'
import type { PickedImage } from '~/lib/media/pick-image'
import { uploadShopLogoImage } from '~/lib/supabase/storage-upload'
import { useUploadProgress } from '~/hooks/useUploadProgress'
import {
  Avatar,
  Button,
  Field,
  Input,
  Spinner,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShopSettingsPanelProps = {
  shop: VendorShop
  onUpdated?: (shop: VendorShop) => void
}

export function ShopSettingsPanel({ shop, onUpdated }: ShopSettingsPanelProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [shopName, setShopName] = useState(shop.shop_name)
  const [shopDescription, setShopDescription] = useState(shop.shop_description ?? '')
  const [announcement, setAnnouncement] = useState(
    () => shopAnnouncementFromMetadata(shop.shop_metadata) ?? '',
  )
  const [shopEmail, setShopEmail] = useState(shop.shop_email ?? '')
  const [shopPhone, setShopPhone] = useState(shop.shop_phone_number ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(shop.website_url ?? '')
  const [isActive, setIsActive] = useState(shop.is_active)
  const [logoImages, setLogoImages] = useState<PickedImage[]>([])
  const [addressValue, setAddressValue] = useState<GeoLocationParts>(() =>
    shopAddressInputFromRow(shop.address ?? null),
  )
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()

  useEffect(() => {
    setShopName(shop.shop_name)
    setShopDescription(shop.shop_description ?? '')
    setAnnouncement(shopAnnouncementFromMetadata(shop.shop_metadata) ?? '')
    setShopEmail(shop.shop_email ?? '')
    setShopPhone(shop.shop_phone_number ?? '')
    setWebsiteUrl(shop.website_url ?? '')
    setIsActive(shop.is_active)
    setLogoImages([])
    setAddressValue(shopAddressInputFromRow(shop.address ?? null))
  }, [shop])

  useEffect(() => {
    if (!user?.id || shop.address) return

    let active = true
    setIsLoadingAddress(true)
    void fetchShopAddressForOwner(shop.id, user.id).then(({ address, error }) => {
      if (!active) return
      if (address) {
        setAddressValue(shopAddressInputFromRow(address))
      }
      if (error) {
        toast.show('Could not load shop location', { tone: 'danger', message: error })
      }
      setIsLoadingAddress(false)
    })

    return () => {
      active = false
    }
  }, [shop.address, shop.id, toast, user?.id])

  async function handleSave() {
    if (!user || shopName.trim().length < 2) return

    setIsSaving(true)

    let latestShop: VendorShop | null = null
    let latestAddress: ShopAddress | null = shop.address ?? null

    if (logoImages.length > 0) {
      try {
        const [file] = await preparePickedImagesForUpload(logoImages.slice(0, 1))
        trackUpload(1)
        const { data, error: uploadError } = await uploadShopLogoImage(user.id, shop.id, file, {
          onProgress: trackUpload,
        })

        if (uploadError || !data) {
          setIsSaving(false)
          resetUpload()
          toast.show('Logo upload failed', { tone: 'danger', message: uploadError ?? 'Try again.' })
          return
        }

        const { shop: withLogo, error: logoError } = await updateShopLogo(shop.id, user.id, data.publicUrl)
        if (logoError || !withLogo) {
          setIsSaving(false)
          toast.show('Could not save logo', { tone: 'danger', message: logoError ?? 'Try again.' })
          return
        }

        latestShop = withLogo as VendorShop
      } catch (error) {
        setIsSaving(false)
        toast.show('Logo upload failed', {
          tone: 'danger',
          message: error instanceof Error ? error.message : 'Try again.',
        })
        return
      }
    }

    const { shop: updated, error } = await updateShopProfile(shop.id, user.id, {
      shop_name: shopName.trim(),
      shop_description: shopDescription.trim() || null,
      shop_email: shopEmail.trim() || null,
      shop_phone_number: shopPhone.trim() || null,
      website_url: websiteUrl.trim() || null,
      is_active: isActive,
      shop_metadata: updateShopAnnouncement(shop.shop_metadata, announcement),
    })

    if (error || !updated) {
      setIsSaving(false)
      toast.show('Could not save shop', { tone: 'danger', message: error ?? 'Try again.' })
      return
    }

    const { address: savedAddress, error: addressError } = await upsertShopAddress(
      shop.id,
      user.id,
      addressValue,
      shopName.trim(),
    )

    setIsSaving(false)
    resetUpload()

    if (addressError) {
      toast.show('Shop saved, location not updated', { tone: 'danger', message: addressError })
    } else {
      latestAddress = savedAddress
      toast.show('Shop updated', { tone: 'success' })
    }

    onUpdated?.({
      ...((latestShop ?? updated) as VendorShop),
      address: latestAddress,
    })
    setLogoImages([])
  }

  return (
    <CommercePanel gap="$4">
      <YStack gap="$1">
        <Text fontSize={18} fontWeight="700" color={ui.text}>
          Shop settings
        </Text>
        <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
          Manage storefront details and business location visible to buyers.
        </Text>
      </YStack>

      <XStack gap="$3" alignItems="center">
        <Avatar name={shop.shop_name} src={shop.logo_url ?? undefined} size="$6" />
        <YStack gap="$1" flex={1}>
          <Text fontSize={14} fontWeight="600" color={ui.text}>
            Shop logo
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            {shop.logo_url ? 'Upload a new logo to replace the current one.' : 'Add a logo so buyers recognize your shop.'}
          </Text>
        </YStack>
      </XStack>

      <YStack gap="$3">
        <ImageUploadField
          label="Upload logo"
          value={logoImages}
          onChange={setLogoImages}
          disabled={isSaving}
          hint="Square images work best. Saved to shop storage when you tap Save."
          uploadProgress={uploadProgress}
          uploadLabel="Uploading logo…"
        />
        <Field label="Shop name" required>
          <Input value={shopName} onChangeText={setShopName} />
        </Field>
        <Field label="Description">
          <TextArea value={shopDescription} onChangeText={setShopDescription} minHeight={100} />
        </Field>
        <Field
          label="Shop announcement"
          hint="Shown on your shop page (sales, delays, custom orders)."
        >
          <TextArea
            value={announcement}
            onChangeText={setAnnouncement}
            minHeight={72}
            placeholder="Free gift wrap this week · Ships in 2–3 days"
          />
        </Field>
        <Field label="Support email">
          <Input value={shopEmail} onChangeText={setShopEmail} autoCapitalize="none" keyboardType="email-address" />
        </Field>
        <Field label="Phone">
          <PhoneInput value={shopPhone} onChange={setShopPhone} />
        </Field>
        <Field label="Website">
          <Input value={websiteUrl} onChangeText={setWebsiteUrl} autoCapitalize="none" />
        </Field>

        <YStack gap="$2">
          <Text fontSize={15} fontWeight="700" color={ui.text}>
            Business location
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            Used for shop discovery, shipping estimates, and marketplace personalization.
          </Text>
          {isLoadingAddress ? (
            <XStack alignItems="center" gap="$2" paddingVertical="$3">
              <Spinner size="small" />
              <Text fontSize={13} color={ui.textMuted}>
                Loading location…
              </Text>
            </XStack>
          ) : (
            <LocationFields value={addressValue} onChange={setAddressValue} disabled={isSaving} />
          )}
        </YStack>

        <YStack gap="$2">
          <Text fontSize={14} fontWeight="600" color={ui.text}>
            Shop visible to buyers
          </Text>
          <XStack alignItems="center" gap="$3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Text fontSize={13} color={ui.textSecondary}>
              {isActive ? 'Open for sales' : 'Hidden from marketplace'}
            </Text>
          </XStack>
        </YStack>
      </YStack>

      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        disabled={isSaving || shopName.trim().length < 2 || isLoadingAddress}
        onPress={() => void handleSave()}
        icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
      >
        {isSaving ? 'Saving…' : 'Save shop settings'}
      </Button>
    </CommercePanel>
  )
}
