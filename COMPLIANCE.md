# SHEconomy marketplace compliance

This document is the ops source of truth for money movement and shipping credentials on the platform.

## Shipping credit (Easyship)

Buyer checkout shipping is **Easyship DDP** landed cost (shipping + tax + duty + handling). Cash from that remittance stays on the **platform PayU (SHEPay) account** to fund carriers/customs.

Separately, each shop has an **Easyship shipping credit ledger** (`easyship_shipping_credits`):

- When an order becomes **paid**, buyer-paid freight (`shipment_charge` / `shipping_amount`) is **auto-credited** to the shop ledger.
- Buying an Easyship label **debits** that ledger. Insufficient credit returns HTTP **402** with recharge CTA (`/vendor/wallet`).
- Platform `GET /account` available balance must also cover the label; ops tops up the shared Easyship payment method from retained DDP.
- India origin requires linking **FedEx** or **UPS** own courier accounts on Easyship (no prepaid DHL from IN).

SHEconomy does **not** operate seller Shiprocket connect, wallet mirrors, Shiprocket AWB purchase, platform SheDelivery, or manual AWB fulfill. Outbound and return labels are **Easyship only**.

## SHEPay (PayU) split payouts (commerce checkout)

Marketplace buyer online payments are collected through the platform **PayU (SHEPay)** account.

1. PayU success webhook → mark orders paid via the checkout payment webhook (`shepay-payu-webhook`).
2. Each shop's item subtotal is split to the seller's PayU child merchant. Platform fee on item price is **0%**.
3. Shipping + import tax + duty (DDP) stay on the platform account to fund Easyship/customs.
4. Held settlements (`shepay_pending_settlements`) release only after delivery + return window + no open dispute (`shepay-release-settlement`).
5. Paid orders also credit `easyship_shipping_credits` (triggers on `order_payments` / leaving `awaiting_payment`).
6. Marketplace refunds go through PayU refunds (`process-refund`).

See `doc/payment/payu/README.md`.

**Sponsored ads / post boosts** also charge via PayU (`sponsored-payu-*`).

## Admin observability

- Audit: `log_admin_action` / `log_admin_action_as` → `admin_audit_logs`
- Marketplace recon: `shepay-reconcile-daily` + SHEPay release cron
- Edge errors: optional `SENTRY_DSN` on Edge Functions (`_shared/sentry.ts`)

## Secrets

Payment salts, cron secrets, and service-role keys live **only** in Edge Function / Vault environment — never in client bundles, migrations committed with live values, or `EXPO_PUBLIC_*` vars.
