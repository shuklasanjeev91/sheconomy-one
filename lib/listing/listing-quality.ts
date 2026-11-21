/**
 * Listing quality rules for SHEconomy seller publish.
 * Used by the publish wizard, Zod schema, and activate/republish gates.
 */

import {
  normalizeProductInfoDate,
  parseKeyFeatures,
  parseListingProductInfo,
} from "~/commerce/lib/listing-product-info";
import {
  LISTING_IMAGE_CONSTRAINTS,
  LISTING_TYPES,
  LISTING_VALIDATION,
  type ListingFormData,
  type ListingImageDraft,
  type ListingType,
} from "~/lib/listing/listing.type";
import type { ProductTypeCatalog } from "~/lib/listing/product-catalog";
import {
  validateProductIdentifier,
  validateRequiredAttributes,
  validateRequiredCompliance,
} from "~/lib/listing/product-catalog";

export type ListingQualityIssue = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ListingQualityResult = {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
  issues: ListingQualityIssue[];
  score: number;
};

function pushIssue(
  issues: ListingQualityIssue[],
  errors: Record<string, string>,
  warnings: string[],
  issue: ListingQualityIssue,
) {
  issues.push(issue);
  if (issue.severity === "error") {
    if (!errors[issue.field]) errors[issue.field] = issue.message;
  } else {
    warnings.push(issue.message);
  }
}

function imageLongEdge(image: ListingImageDraft): number | null {
  const w = Number(image.width);
  const h = Number(image.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
    return null;
  return Math.max(w, h);
}

/** Validate image set for publish. */
export function validateListingImagesQuality(
  images: ListingImageDraft[] | undefined,
  options: { requireDimensions?: boolean } = {},
): ListingQualityResult {
  const issues: ListingQualityIssue[] = [];
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const list = images ?? [];
  const count = list.length;

  if (count < LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH) {
    pushIssue(issues, errors, warnings, {
      field: "images",
      severity: "error",
      message: `Upload at least ${LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH} product images (main + detail shots).`,
    });
  } else if (count < LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_RECOMMENDED) {
    pushIssue(issues, errors, warnings, {
      field: "images",
      severity: "warning",
      message: `Add ${LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_RECOMMENDED}+ images (lifestyle, detail, size) for better conversion.`,
    });
  }

  if (count > LISTING_IMAGE_CONSTRAINTS.MAX_COUNT) {
    pushIssue(issues, errors, warnings, {
      field: "images",
      severity: "error",
      message: `Maximum ${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} images per listing.`,
    });
  }

  const primary = list.find((img) => img.is_primary) ?? list[0];
  if (primary) {
    const edge = imageLongEdge(primary);
    if (edge != null && edge < LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX) {
      pushIssue(issues, errors, warnings, {
        field: "images",
        severity: "error",
        message: `Main image must be at least ${LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX}px on the longest side for zoom quality.`,
      });
    } else if (
      edge != null &&
      edge < LISTING_IMAGE_CONSTRAINTS.RECOMMENDED_LONG_EDGE_PX
    ) {
      pushIssue(issues, errors, warnings, {
        field: "images",
        severity: "warning",
        message: `Main image is under ${LISTING_IMAGE_CONSTRAINTS.RECOMMENDED_LONG_EDGE_PX}px — upload a sharper photo for zoom.`,
      });
    } else if (edge == null && options.requireDimensions) {
      pushIssue(issues, errors, warnings, {
        field: "images",
        severity: "warning",
        message:
          "Could not verify main image resolution. Prefer 1600px+ square photos.",
      });
    }
  }

  for (let i = 0; i < list.length; i++) {
    const edge = imageLongEdge(list[i]!);
    if (edge != null && edge < LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX) {
      pushIssue(issues, errors, warnings, {
        field: "images",
        severity: "error",
        message: `Image ${i + 1} is below ${LISTING_IMAGE_CONSTRAINTS.MIN_LONG_EDGE_PX}px. Replace with a higher-resolution photo.`,
      });
      break;
    }
  }

  return finalizeQuality(issues, errors, warnings);
}

/** Physical product manufacturing / legal info. */
export function validatePhysicalProductInfoQuality(
  productInfoRaw: unknown,
  listingMetadata?: unknown,
): ListingQualityResult {
  const issues: ListingQualityIssue[] = [];
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const info = parseListingProductInfo(productInfoRaw, listingMetadata);
  const features = parseKeyFeatures(info.keyFeatures);

  if (!info.brand) {
    pushIssue(issues, errors, warnings, {
      field: "brand",
      severity: "error",
      message: "Brand is required.",
    });
  }
  if (!info.genericName) {
    pushIssue(issues, errors, warnings, {
      field: "generic_name",
      severity: "error",
      message: "Generic / product name is required.",
    });
  }
  if (!info.manufacturerName) {
    pushIssue(issues, errors, warnings, {
      field: "manufacturer_name",
      severity: "error",
      message: "Manufacturer name is required for physical products.",
    });
  }
  if (!info.manufacturerAddress) {
    pushIssue(issues, errors, warnings, {
      field: "manufacturer_address",
      severity: "error",
      message: "Manufacturer address is required (legal / packaged goods).",
    });
  }
  if (!info.countryOfOrigin) {
    pushIssue(issues, errors, warnings, {
      field: "country_of_origin",
      severity: "error",
      message: "Country of origin is required.",
    });
  }
  if (features.length < LISTING_VALIDATION.KEY_FEATURES.MIN_COUNT) {
    pushIssue(issues, errors, warnings, {
      field: "key_features",
      severity: "error",
      message: `Add at least ${LISTING_VALIDATION.KEY_FEATURES.MIN_COUNT} key feature bullets.`,
    });
  } else {
    for (let i = 0; i < features.length; i++) {
      const bullet = features[i]!;
      if (bullet.length < LISTING_VALIDATION.KEY_FEATURES.MIN_LENGTH) {
        pushIssue(issues, errors, warnings, {
          field: "key_features",
          severity: "error",
          message: `Key feature ${i + 1} is too short (min ${LISTING_VALIDATION.KEY_FEATURES.MIN_LENGTH} characters).`,
        });
        break;
      }
    }
  }

  if (!info.netQuantity) {
    pushIssue(issues, errors, warnings, {
      field: "net_quantity",
      severity: "warning",
      message:
        "Add net quantity (e.g. 1 piece / 250 g) for packaged goods compliance.",
    });
  }
  if (!info.hsnCode) {
    pushIssue(issues, errors, warnings, {
      field: "hsn_code",
      severity: "warning",
      message: "Add an HSN code for tax / customs clarity.",
    });
  }

  const manufactured = normalizeProductInfoDate(info.manufacturingDate);
  const expiry = normalizeProductInfoDate(info.expiryDate);
  if (manufactured && expiry && expiry < manufactured) {
    pushIssue(issues, errors, warnings, {
      field: "expiry_date",
      severity: "error",
      message: "Best before must be on or after the manufacturing date.",
    });
  }

  return finalizeQuality(issues, errors, warnings);
}

/** Full publish quality gate for create + edit. */
export function validateListingQuality(
  formData: Partial<ListingFormData>,
  options: { requireDimensions?: boolean; catalog?: ProductTypeCatalog | null } = {},
): ListingQualityResult {
  const issues: ListingQualityIssue[] = [];
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const listingType = (formData.listing_type ??
    LISTING_TYPES.PHYSICAL) as ListingType;

  const title = (formData.title ?? "").trim();
  if (title.length < LISTING_VALIDATION.TITLE.MIN_LENGTH) {
    pushIssue(issues, errors, warnings, {
      field: "title",
      severity: "error",
      message: `Title must be at least ${LISTING_VALIDATION.TITLE.MIN_LENGTH} characters.`,
    });
  }

  const description = (formData.description ?? "").trim();
  if (description.length < LISTING_VALIDATION.DESCRIPTION.MIN_LENGTH) {
    pushIssue(issues, errors, warnings, {
      field: "description",
      severity: "error",
      message: `Description must be at least ${LISTING_VALIDATION.DESCRIPTION.MIN_LENGTH} characters.`,
    });
  }

  const imageResult = validateListingImagesQuality(formData.images, options);
  mergeQuality(issues, errors, warnings, imageResult);

  if (listingType === LISTING_TYPES.PHYSICAL) {
    const productResult = validatePhysicalProductInfoQuality(
      formData.product_info,
      formData.listing_metadata,
    );
    mergeQuality(issues, errors, warnings, productResult);

    // Materials & variations are optional (Amazon-style single-SKU default).
    if (!Array.isArray(formData.materials) || formData.materials.length === 0) {
      pushIssue(issues, errors, warnings, {
        field: "materials",
        severity: "warning",
        message: "Add materials when relevant to help shoppers compare products.",
      });
    }
    if (
      Array.isArray(formData.variations) &&
      formData.variations.some((row) => !String(row.variation_value ?? "").trim())
    ) {
      pushIssue(issues, errors, warnings, {
        field: "variations",
        severity: "error",
        message: "Each variation needs an option value, or remove empty variations.",
      });
    }
    const hasChildSkus =
      Array.isArray(formData.variations) &&
      formData.variations.some((row) => String(row.variation_value ?? "").trim());
    if (
      !hasChildSkus &&
      (formData.stock === "" ||
        formData.stock === null ||
        formData.stock === undefined)
    ) {
      pushIssue(issues, errors, warnings, {
        field: "stock",
        severity: "error",
        message: "Enter quantity in stock for this product.",
      });
    }

    if (!formData.product_type_id) {
      pushIssue(issues, errors, warnings, {
        field: "product_type_id",
        severity: "error",
        message: "Choose a product type.",
      });
    }
    if (!formData.item_condition) {
      pushIssue(issues, errors, warnings, {
        field: "item_condition",
        severity: "error",
        message: "Choose the item condition.",
      });
    }
    const identifierErrors = validateProductIdentifier(formData.product_identifier, {
      required: true,
    });
    for (const [field, message] of Object.entries(identifierErrors)) {
      pushIssue(issues, errors, warnings, { field, severity: "error", message });
    }
    const attributeErrors = validateRequiredAttributes(
      options.catalog,
      formData.attribute_values,
    );
    for (const [field, message] of Object.entries(attributeErrors)) {
      pushIssue(issues, errors, warnings, { field, severity: "error", message });
    }
    const complianceErrors = validateRequiredCompliance(
      options.catalog,
      formData.compliance_documents,
    );
    for (const [field, message] of Object.entries(complianceErrors)) {
      pushIssue(issues, errors, warnings, { field, severity: "error", message });
    }
  }

  if (listingType === LISTING_TYPES.DIGITAL) {
    if (!formData.product_type_id) {
      pushIssue(issues, errors, warnings, {
        field: "product_type_id",
        severity: "error",
        message: "Choose a product type.",
      });
    }
    const attributeErrors = validateRequiredAttributes(
      options.catalog,
      formData.attribute_values,
    );
    for (const [field, message] of Object.entries(attributeErrors)) {
      pushIssue(issues, errors, warnings, { field, severity: "error", message });
    }
    if (!String(formData.digital_file_url ?? "").trim()) {
      pushIssue(issues, errors, warnings, {
        field: "digital_file_url",
        severity: "error",
        message: "A download URL is required for digital products.",
      });
    }
    if (!String(formData.digital_file_type ?? "").trim()) {
      pushIssue(issues, errors, warnings, {
        field: "digital_file_type",
        severity: "error",
        message: "File type is required for digital products.",
      });
    }
  }

  if (listingType === LISTING_TYPES.SERVICE) {
    const duration = Number(formData.booking_duration_minutes);
    if (
      !Number.isFinite(duration) ||
      duration < LISTING_VALIDATION.BOOKING_DURATION.MIN
    ) {
      pushIssue(issues, errors, warnings, {
        field: "booking_duration_minutes",
        severity: "error",
        message: "Booking duration is required for services.",
      });
    }
  }

  return finalizeQuality(issues, errors, warnings);
}

function mergeQuality(
  issues: ListingQualityIssue[],
  errors: Record<string, string>,
  warnings: string[],
  other: ListingQualityResult,
) {
  for (const issue of other.issues) {
    pushIssue(issues, errors, warnings, issue);
  }
}

function finalizeQuality(
  issues: ListingQualityIssue[],
  errors: Record<string, string>,
  warnings: string[],
): ListingQualityResult {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const score = Math.max(0, 100 - errorCount * 18 - warningCount * 6);
  return {
    isValid: errorCount === 0,
    errors,
    warnings,
    issues,
    score,
  };
}
