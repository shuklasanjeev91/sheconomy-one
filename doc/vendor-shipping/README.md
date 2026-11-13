# Vendor Shipping — Developer Guide

Vendor delivery (`/vendor/delivery`) — **Easyship only** labels funded by per-shop shipping credit.

> **TL;DR** — 0% commission. Checkout quotes DDP via `easyship-ddp-rates`; buyer pay (items + shipping) absolute-splits to the seller. Sellers self-fund `easyship_shipping_credits`; every label (outbound + return) debits that wallet via `easyship-process-shipment` (402 if short). SHEconomy does not retain freight. Manual AWB / Shiprocket / SheDelivery are not used.

## Easyship shipping credit

| Capability | Edge / RPC |
|---|---|
| Checkout DDP rates | `easyship-ddp-rates` |
| PDP pin estimate | `easyship-listing-rates` |
| Credit balance + ledger | `easyship-shipping-credit` |
| Process label (re-rate, gate, buy, debit) | `easyship-process-shipment` |
| Debit on label | `easyship_debit_shipping_for_label` |
| Seller top-up | `easyship_topup_shipping_credit` |
| Tracking / RTO status | `easyship-webhook` |

**Policy:** Seller-direct charges only. See [`COMPLIANCE.md`](../../COMPLIANCE.md).

**UI:** `/vendor/wallet` (Shipping credit), order drawer **Process via Easyship**.

## Returns

Accepted returns/exchanges use an **Easyship reverse label** from the order drawer — no paste-AWB path.

## Deploy

```bash
supabase functions deploy easyship-ddp-rates
supabase functions deploy easyship-listing-rates
supabase functions deploy easyship-shipping-credit
supabase functions deploy easyship-process-shipment
supabase functions deploy shepay-payu-webhook
supabase functions deploy admin-ops
supabase functions deploy courier-track-sync
```
