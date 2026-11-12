# Vendor Shipping — Developer Guide

Vendor delivery (`/vendor/delivery`) — **Easyship only** labels funded by per-shop shipping credit.

> **TL;DR** — Checkout quotes DDP via `easyship-ddp-rates`. Paid orders auto-credit `easyship_shipping_credits`. Vendors buy every label (outbound + return) with `easyship-process-shipment` (402 if short). Manual AWB, custom courier partners, Shiprocket, and SheDelivery are not used for marketplace fulfill.

## Easyship shipping credit

| Capability | Edge / RPC |
|---|---|
| Checkout DDP rates | `easyship-ddp-rates` |
| Credit balance + ledger | `easyship-shipping-credit` |
| Process label (re-rate, gate, buy, debit) | `easyship-process-shipment` |
| Credit on paid order | `easyship_credit_shipping_from_order` / payment + order triggers / PayU (SHEPay) webhook |
| Debit on label | `easyship_debit_shipping_for_label` |
| Manual top-up | `easyship_topup_shipping_credit` |

**Policy:** Buyer DDP cash stays on the platform PayU (SHEPay) account. Seller ledger is a prepaid gate for labels. See [`COMPLIANCE.md`](../../COMPLIANCE.md).

**UI:** `/vendor/wallet` (Shipping credit), order drawer **Process via Easyship**.

## Returns

Accepted returns/exchanges use an **Easyship reverse label** from the order drawer — no paste-AWB path.

## Deploy

```bash
supabase functions deploy easyship-ddp-rates
supabase functions deploy easyship-shipping-credit
supabase functions deploy easyship-process-shipment
supabase functions deploy shepay-payu-webhook
supabase functions deploy admin-ops
supabase functions deploy courier-track-sync
```
