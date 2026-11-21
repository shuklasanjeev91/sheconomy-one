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
import {
  MAX_VARIATION_PROPERTIES,
  validatePersonalization,
} from "~/lib/listing/product-catalog";
import { parseVariationAxes } from "~/commerce/lib/listing-variant-skus";

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
  const photos = list.filter((image) => image.image_type !== "video");
  const videos = list.filter((image) => image.image_type === "video");
  const count = photos.length;

  if (count < LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH) {
    pushIssue(issues, errors, warnings, {
      field: "images",
      severity: "error",
      message: `Upload at least ${LISTING_IMAGE_CONSTRAINTS.MIN_COUNT_PUBLISH} product photo.`,
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
      message: `Maximum ${LISTING_IMAGE_CONSTRAINTS.MAX_COUNT} photos per listing.`,
    });
  }

  if (videos.length > LISTING_IMAGE_CONSTRAINTS.MAX_VIDEOS) {
    pushIssue(issues, errors, warnings, {
      field: "images",
      severity: "error",
      message: "Add only one video.",
    });
  }

  const primary = photos.find((img) => img.is_primary) ?? photos[0];
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

  for (let i = 0; i < photos.length; i++) {
    const edge = imageLongEdge(photos[i]!);
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
function validateVariationQuality(formData: Partial<ListingFormData>): ListingQualityResult {
  const issues: ListingQualityIssue[] = [];
  const errors: Record<string, string> = {};
  const warnings: string[] = [];
  const axes = parseVariationAxes(formData.listing_metadata);
  if (axes.length > MAX_VARIATION_PROPERTIES) {
    pushIssue(issues, errors, warnings, {
      field: "variations",
      severity: "error",
      message: `Use at most ${MAX_VARIATION_PROPERTIES} variation properties.`,
    });
  }
  const children = (formData.variations ?? []).filter((row) =>
    String(row.variation_value ?? "").trim(),
  );
  const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>;
  const pricesVary = meta.variation_prices_vary !== false;
  const quantitiesVary = meta.variation_quantities_vary !== false;

  if (!children.length) {
    if (
      formData.stock === "" ||
      formData.stock === null ||
      formData.stock === undefined
    ) {
      pushIssue(issues, errors, warnings, {
        field: "stock",
        severity: "error",
        message: "Enter how many you have.",
      });
    }
    return finalizeQuality(issues, errors, warnings);
  }

  if (children.some((row) => !String(row.variation_value ?? "").trim())) {
    pushIssue(issues, errors, warnings, {
      field: "variations",
      severity: "error",
      message: "Each variation needs an option value.",
    });
  }
  if (pricesVary && children.some((row) => !Number.isFinite(Number(row.price)) || Number(row.price) < 0)) {
    pushIssue(issues, errors, warnings, {
      field: "variations",
      severity: "error",
      message: "Set a price on every variation.",
    });
  }
  if (
    quantitiesVary &&
    children.some((row) => row.stock == null || !Number.isFinite(Number(row.stock)))
  ) {
    pushIssue(issues, errors, warnings, {
      field: "variations",
      severity: "error",
      message: "Set a quantity on every variation.",
    });
  }
  return finalizeQuality(issues, errors, warnings);
}

export function validateListingQuality(
  formData: Partial<ListingFormData>,
  options: { requireDimensions?: boolean } = {},
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
  } else if (title.length > LISTING_VALIDATION.TITLE.MAX_LENGTH) {
    pushIssue(issues, errors, warnings, {
      field: "title",
      severity: "error",
      message: `Title must be ${LISTING_VALIDATION.TITLE.MAX_LENGTH} characters or fewer.`,
    });
  }

  const tags = (formData.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > LISTING_VALIDATION.TAGS.MAX_COUNT) {
    pushIssue(issues, errors, warnings, {
      field: "tags",
      severity: "error",
      message: `Use at most ${LISTING_VALIDATION.TAGS.MAX_COUNT} tags.`,
    });
  }

  const categoryCount = (formData.categories ?? []).length;
  if (listingType !== LISTING_TYPES.SERVICE && categoryCount !== 1) {
    pushIssue(issues, errors, warnings, {
      field: "categories",
      severity: "error",
      message: "Choose one category.",
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

    if (!Array.isArray(formData.materials) || formData.materials.length === 0) {
      pushIssue(issues, errors, warnings, {
        field: "materials",
        severity: "warning",
        message: "Add materials when they help shoppers compare products.",
      });
    }
    mergeQuality(issues, errors, warnings, validateVariationQuality(formData));
    const meta = (formData.listing_metadata ?? {}) as Record<string, unknown>;
    const weight = Number(formData.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      pushIssue(issues, errors, warnings, {
        field: "weight",
        severity: "error",
        message: "Enter the item weight.",
      });
    }
    for (const [field, label] of [
      ["package_length_cm", "length"],
      ["package_width_cm", "width"],
      ["package_height_cm", "height"],
    ] as const) {
      const size = Number(meta[field]);
      if (!Number.isFinite(size) || size <= 0) {
        pushIssue(issues, errors, warnings, {
          field,
          severity: "error",
          message: `Enter the package ${label}.`,
        });
      }
    }
  }

  if (listingType === LISTING_TYPES.PHYSICAL || listingType === LISTING_TYPES.DIGITAL) {
    if (!formData.who_made) {
      pushIssue(issues, errors, warnings, {
        field: "who_made",
        severity: "error",
        message: "Say who made it.",
      });
    }
    if (!formData.when_made) {
      pushIssue(issues, errors, warnings, {
        field: "when_made",
        severity: "error",
        message: "Say when it was made.",
      });
    }
    if (!formData.what_is_it) {
      pushIssue(issues, errors, warnings, {
        field: "what_is_it",
        severity: "error",
        message: "Say whether this is a finished product or a supply.",
      });
    }
    for (const [field, message] of Object.entries(validatePersonalization(formData))) {
      pushIssue(issues, errors, warnings, { field, severity: "error", message });
    }
  }

  if (listingType === LISTING_TYPES.DIGITAL) {
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
