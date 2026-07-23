/**
 * Domain field validators for `useFormValidation` / `Validated*` fields.
 * Re-exports keep screens from importing deep domain modules for common plugs.
 */

export {
  addressLine1Validator,
  cityValidator,
  stateValidator,
  validateAddressField,
} from '~/lib/address/address.validation'

export {
  listingDescriptionValidator,
  listingFieldValidators,
  listingMetaDescriptionValidator,
  listingMetaTitleValidator,
  listingPriceValidator,
  listingSkuValidator,
  listingSlugValidator,
  listingTitleValidator,
  validateListingField,
} from '~/lib/listing/listing.validation'

export {
  bioValidator,
  businessNameValidator,
  fullNameValidator,
} from '~/lib/profile/profile.validation'

export {
  shopDescriptionValidator,
  shopEmailValidator,
  shopFieldValidators,
  shopNameValidator,
  shopPhoneValidator,
  validateShopField,
  validateShopPhoneNumber,
  websiteUrlValidator,
} from '~/lib/shop/shop.validation'
