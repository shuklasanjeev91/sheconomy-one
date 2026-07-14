import type { Country } from '~/lib/phone/countries'

export type OtpChannel = 'email' | 'phone'

export type OtpPurpose = 'login' | 'register' | 'verify'

export type AuthOnboardingForm = {
  fullName: string
  email: string
  country: Country
  mobile: string
  acceptedTerms: boolean
}

export type SendOtpRequest = {
  countryCode: string
  mobile: string
  purpose: OtpPurpose
}

export type SendOtpResponse = {
  success: boolean
  verificationId: string
  expiresIn: number
  resendAfter: number
  error?: string
}

export type VerifyOtpRequest = {
  verificationId: string
  otp: string
}

export type VerifyOtpResponse = {
  success: boolean
  accessToken?: string
  refreshToken?: string
  user?: {
    id: string
    name: string | null
    email: string | null
    mobile: string | null
  }
  error?: string
  code?: 'invalid' | 'expired' | 'rate_limited' | 'network' | 'unknown'
}

export type OtpUiState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'verifying'
  | 'success'
  | 'invalid'
  | 'expired'
  | 'network_error'

export interface OtpAutofillService {
  isSupported(): boolean
  startListening(options?: { abortSignal?: AbortSignal }): Promise<string | null>
  stopListening(): void
}
