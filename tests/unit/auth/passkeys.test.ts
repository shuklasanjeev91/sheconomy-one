import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signInWithPasskeyMock, registerPasskeyMock, passkeyListMock, passkeyUpdateMock } =
  vi.hoisted(() => ({
    signInWithPasskeyMock: vi.fn(),
    registerPasskeyMock: vi.fn(),
    passkeyListMock: vi.fn(),
    passkeyUpdateMock: vi.fn(),
  }))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPasskey: signInWithPasskeyMock,
      registerPasskey: registerPasskeyMock,
      passkey: {
        list: passkeyListMock,
        update: passkeyUpdateMock,
      },
    },
  },
}))

import {
  isPasskeyDisabledError,
  isPasskeyLoginEnabled,
  isPasskeySignInSupported,
  listPasskeys,
  registerPasskey,
  signInWithPasskey,
} from '~/features/auth/services/passkeys'

function stubWebAuthn() {
  const PublicKeyCredential = class PublicKeyCredential {}
  const credentials = {
    create: vi.fn(),
    get: vi.fn(),
  }
  vi.stubGlobal('window', { PublicKeyCredential })
  vi.stubGlobal('navigator', { credentials })
}

describe('passkey auth service', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.stubEnv('EXPO_PUBLIC_ENABLE_PASSKEY_LOGIN', 'true')
    signInWithPasskeyMock.mockReset()
    registerPasskeyMock.mockReset()
    passkeyListMock.mockReset()
    passkeyUpdateMock.mockReset()
  })

  it('allows passkeys by default when WebAuthn is available', () => {
    stubWebAuthn()

    expect(isPasskeyLoginEnabled()).toBe(true)
    expect(isPasskeySignInSupported()).toBe(true)
  })

  it('honors the deployment passkey kill switch before reporting support', () => {
    stubWebAuthn()
    vi.stubEnv('EXPO_PUBLIC_ENABLE_PASSKEY_LOGIN', 'false')

    expect(isPasskeyLoginEnabled()).toBe(false)
    expect(isPasskeySignInSupported()).toBe(false)
  })

  it('only reports support when WebAuthn credential APIs are present', () => {
    expect(isPasskeySignInSupported()).toBe(false)

    vi.stubGlobal('window', { PublicKeyCredential: class PublicKeyCredential {} })
    vi.stubGlobal('navigator', { credentials: { get: vi.fn() } })
    expect(isPasskeySignInSupported()).toBe(false)

    stubWebAuthn()
    expect(isPasskeySignInSupported()).toBe(true)
  })

  it('signs in through Supabase passkeys when supported', async () => {
    stubWebAuthn()
    signInWithPasskeyMock.mockResolvedValue({ error: null })

    await expect(signInWithPasskey()).resolves.toEqual({ error: null })
    expect(signInWithPasskeyMock).toHaveBeenCalledTimes(1)
  })

  it('does not call Supabase passkey sign-in when WebAuthn is unavailable', async () => {
    await expect(signInWithPasskey()).resolves.toEqual({
      error: 'Passkeys are not available on this device yet.',
    })
    expect(signInWithPasskeyMock).not.toHaveBeenCalled()
  })

  it('maps disabled server passkeys to a fallback message', async () => {
    stubWebAuthn()
    signInWithPasskeyMock.mockResolvedValue({ error: { message: 'Passkeys are disabled' } })

    await expect(signInWithPasskey()).resolves.toEqual({
      error: 'Passkey login is not enabled yet. Use email or phone to continue.',
      disabled: true,
    })
  })

  it('detects disabled passkey errors', () => {
    expect(isPasskeyDisabledError('Passkeys are disabled')).toBe(true)
    expect(isPasskeyDisabledError('Passkey provider not enabled')).toBe(true)
    expect(isPasskeyDisabledError('User cancelled')).toBe(false)
  })

  it('registers and renames a passkey', async () => {
    stubWebAuthn()
    registerPasskeyMock.mockResolvedValue({ data: { id: 'pk_123' }, error: null })
    passkeyUpdateMock.mockResolvedValue({ error: null })

    await expect(registerPasskey('Work laptop')).resolves.toEqual({ error: null })
    expect(registerPasskeyMock).toHaveBeenCalledTimes(1)
    expect(passkeyUpdateMock).toHaveBeenCalledWith({
      passkeyId: 'pk_123',
      friendlyName: 'Work laptop',
    })
  })

  it('lists passkeys from Supabase', async () => {
    passkeyListMock.mockResolvedValue({
      data: [{ id: 'pk_123', friendly_name: 'Work laptop' }],
      error: null,
    })

    await expect(listPasskeys()).resolves.toEqual({
      passkeys: [{ id: 'pk_123', friendly_name: 'Work laptop' }],
      error: null,
    })
  })
})
