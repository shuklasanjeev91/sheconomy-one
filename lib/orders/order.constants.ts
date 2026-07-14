/**
 * Shared order-system constants.
 *
 * Migrated from the legacy `lib/utils/orders/constants.js`, trimmed to the
 * pieces the marketplace actually uses and aligned to the generated Supabase
 * enums (`order_status_enum`, `delivery_status_enum`, `payment_*_enum`).
 *
 * These are **shared** across vendor / customer / admin order code. Only the
 * vendor surface is wired up today; the rest is migrated later on top of this.
 */

import type { Database } from '~/lib/supabase'

// ============= ENUM-BACKED UNIONS =============

/** A row status for both `orders.order_status` and `order_items.item_status`. */
export type OrderStatus = Database['public']['Enums']['order_status_enum']
export type DeliveryStatus = Database['public']['Enums']['delivery_status_enum']
export type PaymentStatus = Database['public']['Enums']['payment_status_enum']
export type PaymentMode = Database['public']['Enums']['payment_mode_enum']
export type FulfillmentStatus = Database['public']['Enums']['fulfillment_status_enum']

// ============= ORDER STATUS =============

export const ORDER_STATUS = {
  PENDING: 'pending',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAYMENT_FAILED: 'payment_failed',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  PARTIALLY_SHIPPED: 'partially_shipped',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  RETURNED: 'returned',
  DISPUTED: 'disputed',
  ON_HOLD: 'on_hold',
  FAILED_DELIVERY: 'failed_delivery',
} as const satisfies Record<string, OrderStatus>

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  ON_HOLD: 'on_hold',
} as const satisfies Record<string, PaymentStatus>

export const PAYMENT_MODE = {
  ONLINE: 'online',
  COD: 'cod',
  WALLET: 'wallet',
  UPI: 'upi',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  EMI: 'emi',
  PAY_LATER: 'pay_later',
} as const satisfies Record<string, PaymentMode>

export const DELIVERY_STATUS = {
  PENDING: 'pending',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  FAILED_DELIVERY: 'failed_delivery',
  RETURNED_TO_SENDER: 'returned_to_sender',
  LOST: 'lost',
  DAMAGED: 'damaged',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, DeliveryStatus>

// ============= STATUS MACHINE =============

/**
 * Allowed status transitions. A vendor may only move an item forward along
 * these edges; admins get a few override targets (see `order.utils`).
 */
export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.PENDING]: [
    ORDER_STATUS.AWAITING_PAYMENT,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.AWAITING_PAYMENT]: [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PAYMENT_FAILED,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.ON_HOLD,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.PROCESSING]: [
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.PARTIALLY_SHIPPED,
    ORDER_STATUS.ON_HOLD,
    ORDER_STATUS.CANCELLED,
  ],
  [ORDER_STATUS.SHIPPED]: [
    ORDER_STATUS.IN_TRANSIT,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.PARTIALLY_SHIPPED]: [
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.IN_TRANSIT,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.IN_TRANSIT]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.FAILED_DELIVERY,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.DELIVERED]: [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.RETURNED,
    ORDER_STATUS.DISPUTED,
  ],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.RETURNED, ORDER_STATUS.DISPUTED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: [],
  [ORDER_STATUS.RETURNED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.DISPUTED]: [
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.REFUNDED,
    ORDER_STATUS.RETURNED,
  ],
  [ORDER_STATUS.ON_HOLD]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.FAILED_DELIVERY]: [
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.RETURNED,
    ORDER_STATUS.ON_HOLD,
  ],
}

/** Statuses an admin can force from (almost) anywhere. */
export const ADMIN_OVERRIDE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.ON_HOLD,
]

/** Terminal statuses with no outgoing transitions. */
export const FINAL_ORDER_STATUSES: OrderStatus[] = [
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
]

// ============= DISPLAY / PRESENTATION =============

/** Semantic colour token per status (map to your theme in the UI layer). */
export type OrderStatusTone = 'yellow' | 'orange' | 'red' | 'blue' | 'purple' | 'green' | 'gray'

export type OrderStatusDisplay = {
  label: string
  tone: OrderStatusTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
  description: string
}

export const ORDER_STATUS_DISPLAY: Record<OrderStatus, OrderStatusDisplay> = {
  [ORDER_STATUS.PENDING]: { label: 'Pending', tone: 'yellow', icon: 'Clock', description: 'Order is being processed' },
  [ORDER_STATUS.AWAITING_PAYMENT]: { label: 'Awaiting Payment', tone: 'orange', icon: 'CreditCard', description: 'Payment is being processed' },
  [ORDER_STATUS.PAYMENT_FAILED]: { label: 'Payment Failed', tone: 'red', icon: 'CreditCard', description: 'Payment could not be processed' },
  [ORDER_STATUS.CONFIRMED]: { label: 'Confirmed', tone: 'blue', icon: 'CheckCircle', description: 'Order confirmed and being prepared' },
  [ORDER_STATUS.PROCESSING]: { label: 'Processing', tone: 'orange', icon: 'Package', description: 'Order is being prepared for shipment' },
  [ORDER_STATUS.SHIPPED]: { label: 'Shipped', tone: 'purple', icon: 'Truck', description: 'Order has been shipped' },
  [ORDER_STATUS.PARTIALLY_SHIPPED]: { label: 'Partially Shipped', tone: 'purple', icon: 'Truck', description: 'Some items have been shipped' },
  [ORDER_STATUS.IN_TRANSIT]: { label: 'In Transit', tone: 'blue', icon: 'Truck', description: 'Order is on the way' },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { label: 'Out for Delivery', tone: 'green', icon: 'Truck', description: 'Order is out for delivery' },
  [ORDER_STATUS.DELIVERED]: { label: 'Delivered', tone: 'green', icon: 'PackageCheck', description: 'Order has been delivered' },
  [ORDER_STATUS.COMPLETED]: { label: 'Completed', tone: 'green', icon: 'CheckCircle2', description: 'Order completed successfully' },
  [ORDER_STATUS.CANCELLED]: { label: 'Cancelled', tone: 'red', icon: 'XCircle', description: 'Order has been cancelled' },
  [ORDER_STATUS.REFUNDED]: { label: 'Refunded', tone: 'gray', icon: 'ArrowLeftRight', description: 'Order amount has been refunded' },
  [ORDER_STATUS.RETURNED]: { label: 'Returned', tone: 'orange', icon: 'RotateCcw', description: 'Order has been returned' },
  [ORDER_STATUS.DISPUTED]: { label: 'Disputed', tone: 'red', icon: 'AlertTriangle', description: 'Order is under dispute' },
  [ORDER_STATUS.ON_HOLD]: { label: 'On Hold', tone: 'gray', icon: 'PauseCircle', description: 'Order is temporarily on hold' },
  [ORDER_STATUS.FAILED_DELIVERY]: { label: 'Delivery Failed', tone: 'red', icon: 'AlertTriangle', description: 'A delivery attempt failed' },
}

/** Progress percentage (0–100) used by order-tracking UIs. */
export const ORDER_STATUS_PROGRESS: Record<OrderStatus, number> = {
  [ORDER_STATUS.PENDING]: 10,
  [ORDER_STATUS.AWAITING_PAYMENT]: 15,
  [ORDER_STATUS.PAYMENT_FAILED]: 10,
  [ORDER_STATUS.CONFIRMED]: 25,
  [ORDER_STATUS.PROCESSING]: 40,
  [ORDER_STATUS.PARTIALLY_SHIPPED]: 55,
  [ORDER_STATUS.SHIPPED]: 60,
  [ORDER_STATUS.IN_TRANSIT]: 75,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 90,
  [ORDER_STATUS.DELIVERED]: 95,
  [ORDER_STATUS.COMPLETED]: 100,
  [ORDER_STATUS.CANCELLED]: 0,
  [ORDER_STATUS.RETURNED]: 0,
  [ORDER_STATUS.REFUNDED]: 0,
  [ORDER_STATUS.DISPUTED]: 50,
  [ORDER_STATUS.ON_HOLD]: 30,
  [ORDER_STATUS.FAILED_DELIVERY]: 70,
}

// ============= DEFAULTS / RULES =============

export const ORDER_DEFAULTS = {
  CURRENCY: 'INR',
  PAGE: 1,
  PAGE_SIZE: 20,
  ANALYTICS_WINDOW_DAYS: 30,
  SUMMARY_WINDOW_DAYS: 7,
  RETURN_WINDOW_DAYS: 7,
} as const

/** Vendor-editable fields on an order item (mirrors the legacy allow-list). */
export const VENDOR_EDITABLE_ITEM_FIELDS = [
  'item_status',
  'digital_download_url',
  'download_expires_at',
] as const

export type VendorEditableItemField = (typeof VENDOR_EDITABLE_ITEM_FIELDS)[number]

// ============= ORDER ISSUES =============
//
// `order_issues.issue_type` / `issue_priority` / `status` are stored as plain
// strings in the DB (no enum), so these are the canonical value sets the app
// writes and filters on.

export const ISSUE_STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  WAITING_CUSTOMER: 'waiting_customer',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const

export type IssueStatus = (typeof ISSUE_STATUS)[keyof typeof ISSUE_STATUS]

export const ISSUE_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical',
} as const

export type IssuePriority = (typeof ISSUE_PRIORITY)[keyof typeof ISSUE_PRIORITY]

export const ORDER_ISSUE_TYPE = {
  DELIVERY_DELAY: 'delivery_delay',
  PRODUCT_DEFECT: 'product_defect',
  WRONG_ITEM: 'wrong_item',
  MISSING_ITEM: 'missing_item',
  DAMAGED_ITEM: 'damaged_item',
  INCORRECT_ITEM: 'incorrect_item',
  DAMAGED_PACKAGE: 'damaged_package',
  LATE_DELIVERY: 'late_delivery',
  SIZE_ISSUE: 'size_issue',
  QUALITY_ISSUE: 'quality_issue',
  PAYMENT_ISSUE: 'payment_issue',
  BILLING_ISSUE: 'billing_issue',
  RETURN_REQUEST: 'return_request',
  REFUND_REQUEST: 'refund_request',
  CUSTOMER_COMPLAINT: 'customer_complaint',
  SHIPPING_ISSUE: 'shipping_issue',
  DELIVERY_ISSUE: 'delivery_issue',
  OTHER: 'other',
} as const

export type OrderIssueType = (typeof ORDER_ISSUE_TYPE)[keyof typeof ORDER_ISSUE_TYPE]

/** Issue statuses considered "still needing attention". */
export const OPEN_ISSUE_STATUSES: IssueStatus[] = [
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.WAITING_CUSTOMER,
  ISSUE_STATUS.ESCALATED,
]

/** Terminal issue statuses. */
export const CLOSED_ISSUE_STATUSES: IssueStatus[] = [
  ISSUE_STATUS.RESOLVED,
  ISSUE_STATUS.CLOSED,
  ISSUE_STATUS.CANCELLED,
]

/** Priorities treated as high-attention in dashboards. */
export const HIGH_ISSUE_PRIORITIES: IssuePriority[] = [
  ISSUE_PRIORITY.HIGH,
  ISSUE_PRIORITY.URGENT,
  ISSUE_PRIORITY.CRITICAL,
]

// ============= FULFILLMENT =============
//
// `order_fulfillments.fulfillment_status` is enum-backed, so this set is aligned
// to `fulfillment_status_enum` (the modern lifecycle — no picking/packing sub
// states from the legacy service).

export const FULFILLMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  DELIVERY_FAILED: 'delivery_failed',
  RETURNED_TO_SENDER: 'returned_to_sender',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
  EXCEPTION: 'exception',
} as const satisfies Record<string, FulfillmentStatus>

/** Fulfillment event `event_type` values (stored as plain strings in the DB). */
export const FULFILLMENT_EVENT_TYPE = {
  STATUS_CHANGE: 'status_change',
  CARRIER_SCAN: 'carrier_scan',
  DELIVERY_ATTEMPT: 'delivery_attempt',
  EXCEPTION: 'exception',
  PACKAGE_PICKUP: 'package_pickup',
  PACKAGE_SORTED: 'package_sorted',
  TRANSIT_UPDATE: 'transit_update',
  DELIVERY_RESCHEDULED: 'delivery_rescheduled',
  RETURN_INITIATED: 'return_initiated',
  CUSTOMS_CLEARANCE: 'customs_clearance',
} as const

export type FulfillmentEventType = (typeof FULFILLMENT_EVENT_TYPE)[keyof typeof FULFILLMENT_EVENT_TYPE]

/** Statuses that still need warehouse/vendor action. */
export const PENDING_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  FULFILLMENT_STATUS.PENDING,
  FULFILLMENT_STATUS.PROCESSING,
  FULFILLMENT_STATUS.READY_TO_SHIP,
]

/** Terminal fulfillment statuses (used for overdue / completion checks). */
export const FINAL_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  FULFILLMENT_STATUS.DELIVERED,
  FULFILLMENT_STATUS.CANCELLED,
  FULFILLMENT_STATUS.RETURNED,
  FULFILLMENT_STATUS.RETURNED_TO_SENDER,
]

export const FULFILLMENT_DEFAULTS = {
  /** `priority_level` is numeric in the modern schema (lower = higher priority). */
  PRIORITY_LEVEL: 3,
  /** Prefix for auto-generated `fulfillment_number`s. */
  NUMBER_PREFIX: 'FUL',
  EVENT_SOURCE_SYSTEM: 'internal',
} as const
