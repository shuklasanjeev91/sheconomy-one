# SHEconomy marketplace compliance

This document is the ops source of truth for money movement and shipping credentials on the platform.

## Shipping credit (Easyship)

**0% commission / seller-direct charges.** SHEconomy does not retain buyer freight or take a cut of item price. Every logistics charge is the seller’s responsibility and is auto-debited from the seller shipping wallet.

Buyer checkout shipping is **Easyship DDP** landed cost (shipping + tax + duty + handling). That amount is included in the shop’s PayU absolute split to the seller child MID (same as item subtotal).

Each shop has an **Easyship shipping credit ledger** (`easyship_shipping_credits`):

- Sellers **self-fund** the wallet (top-up). Buyer remittance is **not** auto-credited to the ledger.
- Buying an outbound or return Easyship label **debits** that ledger. Insufficient credit returns HTTP **402** with recharge CTA (`/vendor/wallet`).
- Shared Easyship merchant-of-record balance is plumbing only; it must stay funded from seller collections — SHEconomy does not keep DDP as platform revenue.
- India origin requires linking **FedEx** or **UPS** own courier accounts on Easyship (no prepaid DHL from IN).

SHEconomy does **not** operate seller Shiprocket connect, wallet mirrors, Shiprocket AWB purchase, platform SheDelivery, or manual AWB fulfill. Outbound and return labels are **Easyship only**.

## SHEPay (PayU) split payouts (commerce checkout)

Marketplace buyer online payments are collected through the platform **PayU (SHEPay)** account. SHEconomy takes **0% commission on item price**. The **PayU payment processing fee** (`platform_fee_rules.shepay_payment`, default **1.5%**) is deducted from the seller payout via Automate `aggregatorCharges`.

1. Admin approves seller KYC → `shepay-create-child` creates the PayU sub-merchant; `shepay-sync-kyc` activates when PayU verifies docs.
2. PayU success webhook → mark orders paid (`shepay-payu-webhook`).
3. Each shop’s gross (item subtotal + shipping/DDP) is absolute-split: child gets `seller_amount`, parent gets `payment_fee_amount` as `aggregatorCharges` (PayU TDR comes from that share). `platform_fee_amount` (SHEconomy commission) stays **0**.
4. Held settlements (`shepay_pending_settlements`) release only after delivery + return window + no open dispute (`shepay-release-settlement`).
5. Label / RTO / return freight is debited from the seller’s `easyship_shipping_credits` wallet (seller-funded).
6. Marketplace refunds go through PayU refunds (`process-refund`).

See `doc/payment/payu/README.md`.

**Sponsored ads / post boosts** also charge via PayU (`sponsored-payu-*`).

## Admin observability

- Audit: `log_admin_action` / `log_admin_action_as` → `admin_audit_logs`
- Marketplace recon: `shepay-reconcile-daily` + SHEPay release cron
- Edge errors: optional `SENTRY_DSN` on Edge Functions (`_shared/sentry.ts`)

## Secrets

Payment salts, cron secrets, and service-role keys live **only** in Edge Function / Vault environment — never in client bundles, migrations committed with live values, or `EXPO_PUBLIC_*` vars.
