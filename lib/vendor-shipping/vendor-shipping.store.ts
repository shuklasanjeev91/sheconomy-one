import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { AppDispatch, RootState } from '~/lib/store'

import * as vendorShippingService from '~/lib/vendor-shipping/vendor-shipping.service'
import type {
  ConnectShiprocketInput,
  CustomPartnerFormInput,
  CustomPartnerInput,
  CustomShippingPartner,
  ShiprocketStatus,
  VendorShippingAccessContext,
} from '~/lib/vendor-shipping/vendor-shipping.type'
import { emptyCustomPartnerForm } from '~/lib/vendor-shipping/vendor-shipping.type'
import { toFriendlyVendorShippingError } from '~/lib/vendor-shipping/vendor-shipping.errors'

type VendorShippingState = {
  shopId: string | null
  shiprocketStatus: ShiprocketStatus | null
  customPartners: CustomShippingPartner[]
  partnerForm: CustomPartnerFormInput
  loadingStatus: boolean
  connecting: boolean
  disconnecting: boolean
  loadingPartners: boolean
  creatingPartner: boolean
  error: string | null
}

const initialState: VendorShippingState = {
  shopId: null,
  shiprocketStatus: null,
  customPartners: [],
  partnerForm: emptyCustomPartnerForm(),
  loadingStatus: false,
  connecting: false,
  disconnecting: false,
  loadingPartners: false,
  creatingPartner: false,
  error: null,
}

type ThunkConfig = { state: RootState; dispatch: AppDispatch; rejectValue: string }

function resolveResponse<T>(
  result: { success: boolean; data: T | null; error: string | null },
  rejectWithValue: (value: string) => unknown,
): T {
  if (!result.success || result.data == null) {
    return rejectWithValue(result.error ?? 'Request failed.') as never
  }
  return result.data
}

export const loadShiprocketStatus = createAsyncThunk<
  ShiprocketStatus,
  { shopId: string; accessContext?: VendorShippingAccessContext },
  ThunkConfig
>('vendorShipping/loadShiprocketStatus', async (arg, { rejectWithValue }) =>
  resolveResponse(await vendorShippingService.getShiprocketStatus(arg.shopId, arg.accessContext), rejectWithValue),
)

export const connectShiprocketAccount = createAsyncThunk<
  ShiprocketStatus,
  ConnectShiprocketInput,
  ThunkConfig
>('vendorShipping/connectShiprocket', async (arg, { rejectWithValue }) =>
  resolveResponse(await vendorShippingService.connectShiprocket(arg), rejectWithValue),
)

export const disconnectShiprocketAccount = createAsyncThunk<
  { disconnected: true },
  { shopId: string; accessContext?: VendorShippingAccessContext },
  ThunkConfig
>('vendorShipping/disconnectShiprocket', async (arg, { rejectWithValue }) =>
  resolveResponse(await vendorShippingService.disconnectShiprocket(arg.shopId, arg.accessContext), rejectWithValue),
)

export const loadCustomShippingPartners = createAsyncThunk<
  CustomShippingPartner[],
  { shopId: string; accessContext?: VendorShippingAccessContext },
  ThunkConfig
>('vendorShipping/loadCustomPartners', async (arg, { rejectWithValue }) =>
  resolveResponse(
    await vendorShippingService.listCustomShippingPartners(arg.shopId, arg.accessContext),
    rejectWithValue,
  ),
)

export const createCustomShippingPartner = createAsyncThunk<
  CustomShippingPartner,
  { shopId: string; input: CustomPartnerInput; accessContext?: VendorShippingAccessContext },
  ThunkConfig
>('vendorShipping/createCustomPartner', async (arg, { rejectWithValue }) =>
  resolveResponse(
    await vendorShippingService.createCustomShippingPartner(arg.shopId, arg.input, arg.accessContext),
    rejectWithValue,
  ),
)

const vendorShippingSlice = createSlice({
  name: 'vendorShipping',
  initialState,
  reducers: {
    setVendorShippingShopId(state, action: PayloadAction<string | null>) {
      state.shopId = action.payload
    },
    setCustomPartnerForm(state, action: PayloadAction<Partial<CustomPartnerFormInput>>) {
      state.partnerForm = {
        ...state.partnerForm,
        ...action.payload,
        pickup_address: {
          ...state.partnerForm.pickup_address,
          ...(action.payload.pickup_address ?? {}),
        },
      }
    },
    resetCustomPartnerForm(state) {
      state.partnerForm = emptyCustomPartnerForm()
    },
    clearVendorShippingError(state) {
      state.error = null
    },
    resetVendorShipping(state) {
      Object.assign(state, initialState)
      state.partnerForm = emptyCustomPartnerForm()
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadShiprocketStatus.pending, (state) => {
        state.loadingStatus = true
        state.error = null
      })
      .addCase(loadShiprocketStatus.fulfilled, (state, action) => {
        state.loadingStatus = false
        state.shiprocketStatus = action.payload
      })
      .addCase(loadShiprocketStatus.rejected, (state, action) => {
        state.loadingStatus = false
        state.error = action.payload ?? null
      })
      .addCase(connectShiprocketAccount.pending, (state) => {
        state.connecting = true
        state.error = null
      })
      .addCase(connectShiprocketAccount.fulfilled, (state, action) => {
        state.connecting = false
        state.shiprocketStatus = action.payload
      })
      .addCase(connectShiprocketAccount.rejected, (state, action) => {
        state.connecting = false
        state.error = action.payload ?? null
      })
      .addCase(disconnectShiprocketAccount.pending, (state) => {
        state.disconnecting = true
        state.error = null
      })
      .addCase(disconnectShiprocketAccount.fulfilled, (state) => {
        state.disconnecting = false
        state.shiprocketStatus = { connected: false, message: 'Shiprocket not connected' }
      })
      .addCase(disconnectShiprocketAccount.rejected, (state, action) => {
        state.disconnecting = false
        state.error = action.payload ?? null
      })
      .addCase(loadCustomShippingPartners.pending, (state) => {
        state.loadingPartners = true
        state.error = null
      })
      .addCase(loadCustomShippingPartners.fulfilled, (state, action) => {
        state.loadingPartners = false
        state.customPartners = action.payload
      })
      .addCase(loadCustomShippingPartners.rejected, (state, action) => {
        state.loadingPartners = false
        state.error = action.payload ?? null
      })
      .addCase(createCustomShippingPartner.pending, (state) => {
        state.creatingPartner = true
        state.error = null
      })
      .addCase(createCustomShippingPartner.fulfilled, (state, action) => {
        state.creatingPartner = false
        state.customPartners = [action.payload, ...state.customPartners]
        state.partnerForm = emptyCustomPartnerForm()
      })
      .addCase(createCustomShippingPartner.rejected, (state, action) => {
        state.creatingPartner = false
        state.error = action.payload ?? null
      })
  },
})

export const {
  setVendorShippingShopId,
  setCustomPartnerForm,
  resetCustomPartnerForm,
  clearVendorShippingError,
  resetVendorShipping,
} = vendorShippingSlice.actions

export const vendorShippingReducer = vendorShippingSlice.reducer

export const selectShiprocketStatus = (state: RootState) => state.vendorShipping.shiprocketStatus
export const selectCustomShippingPartners = (state: RootState) => state.vendorShipping.customPartners
export const selectCustomPartnerForm = (state: RootState) => state.vendorShipping.partnerForm

export { toFriendlyVendorShippingError }
