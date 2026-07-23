# Vendor Shipping — Developer Guide

Vendor delivery provider management (`/vendor/delivery`) — Shiprocket integration and custom shipping partners.

> **TL;DR** — Dispatch thunks from `~/lib/vendor-shipping/vendor-shipping.store`. Shiprocket connect/status/disconnect runs through the `vendor-shipping-shiprocket` edge function (server-side Shiprocket API). Custom partners use direct Supabase writes with RLS.

## Legacy mapping

| Legacy | New |
|--------|-----|
| `app/vendor/delivery/page.js` | `commerce/screens/vendor/VendorDeliveryScreen.tsx` |
| `components/vendor/delivery/ShiprocketConnection.js` | `commerce/components/vendor/delivery/ShiprocketConnectionPanel.tsx` |
| `components/vendor/delivery/CustomShippingPartner.js` | `commerce/components/vendor/delivery/CustomShippingPartnerPanel.tsx` |
| `/api/vendor/shipping/shiprocket/*` | `supabase/functions/vendor-shipping-shiprocket` |
| `/api/vendor/shipping/custom/*` | `lib/vendor-shipping/vendor-shipping.service.ts` |

Redux key: **`vendorShipping`**.

## Thunks

- `loadShiprocketStatus({ shopId, accessContext })`
- `connectShiprocketAccount({ shopId, email, password, accessContext })`
- `disconnectShiprocketAccount({ shopId, accessContext })`
- `loadCustomShippingPartners({ shopId, accessContext })`
- `createCustomShippingPartner({ shopId, input, accessContext })`

## Deploy note

Shiprocket connect requires the edge function:

```bash
supabase functions deploy vendor-shipping-shiprocket
```
