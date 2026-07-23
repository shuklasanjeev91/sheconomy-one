#!/usr/bin/env node
/**
 * react-native-otp-verify: resolve/reject Phone Number Hint promises on cancel,
 * and clear the callback so retries work after dismiss.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-otp-verify',
  'android',
  'src',
  'main',
  'java',
  'com',
  'faizal',
  'OtpVerify',
  'OtpVerifyModule.java',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-otp-verify] skip — module not installed')
  process.exit(0)
}

const source = fs.readFileSync(target, 'utf8')
if (source.includes('USER_CANCELLED')) {
  process.exit(0)
}

const oldBlock = `    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode == RESOLVE_HINT) {
            if (resultCode == Activity.RESULT_OK) {
                String phoneNumber = null;
                try {
                    phoneNumber = Identity.getSignInClient(activity).getPhoneNumberFromIntent(data);
                    requestHintCallback.resolve(phoneNumber);
                } catch (ApiException e) {
                    requestHintCallback.reject(e.getMessage());
                } catch (NullPointerException e) {
                    requestHintCallback.reject(e.getMessage());
                }
            }
        }
    }`

const newBlock = `    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
        if (requestCode != RESOLVE_HINT || requestHintCallback == null) {
            return;
        }
        Promise callback = requestHintCallback;
        requestHintCallback = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            try {
                String phoneNumber = Identity.getSignInClient(activity).getPhoneNumberFromIntent(data);
                callback.resolve(phoneNumber);
            } catch (ApiException e) {
                callback.reject("HINT_FAILED", e.getMessage());
            } catch (NullPointerException e) {
                callback.reject("HINT_FAILED", e.getMessage() != null ? e.getMessage() : "null");
            }
        } else {
            // Previously the promise hung forever on cancel — that blocked retries
            // and made "Use number from this device" appear broken after dismiss.
            callback.reject("USER_CANCELLED", "Phone number hint cancelled");
        }
    }`

if (!source.includes(oldBlock)) {
  console.warn('[patch-otp-verify] unexpected source — skip')
  process.exit(0)
}

fs.writeFileSync(target, source.replace(oldBlock, newBlock))
console.log('[patch-otp-verify] patched OtpVerifyModule.onActivityResult')
