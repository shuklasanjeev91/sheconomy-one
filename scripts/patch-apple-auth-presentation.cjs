/**
 * Patch expo-apple-authentication presentation anchor for iPad / multi-scene.
 * UIApplication.shared.keyWindow is deprecated and often nil/wrong on iPadOS,
 * which breaks ASAuthorizationController ("Sign in to your Apple Account" sheet).
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-apple-authentication',
  'ios',
  'AppleAuthenticationRequest.swift',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-apple-auth-presentation] skip: file missing')
  process.exit(0)
}

let source = fs.readFileSync(target, 'utf8')

if (source.includes('Scene-aware lookup: keyWindow is unreliable')) {
  console.log('[patch-apple-auth-presentation] already applied')
  process.exit(0)
}

const oldFn = `  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    guard let window = UIApplication.shared.keyWindow else {
      fatalError("Unable to present authentication modal because UIApplication.shared.keyWindow is not available")
    }
    return window
  }`

const newFn = `  func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
    // Scene-aware lookup: keyWindow is unreliable on iPadOS / multi-window.
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let activeScene =
      scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first

    if let window =
      activeScene?.windows.first(where: { $0.isKeyWindow }) ??
      activeScene?.windows.first(where: { !$0.isHidden && $0.alpha > 0 }) ??
      activeScene?.windows.first
    {
      return window
    }

    if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) ??
      UIApplication.shared.windows.first
    {
      return window
    }

    // Last resort: attach a temporary window to the active scene so
    // ASAuthorizationController still has a valid presentation anchor.
    if let scene = activeScene {
      let fallback = UIWindow(windowScene: scene)
      fallback.frame = scene.coordinateSpace.bounds
      fallback.isHidden = false
      return fallback
    }

    return UIWindow(frame: UIScreen.main.bounds)
  }`

if (!source.includes(oldFn)) {
  console.warn('[patch-apple-auth-presentation] unexpected source; skip')
  process.exit(0)
}

source = source.replace(oldFn, newFn)
fs.writeFileSync(target, source)
console.log('[patch-apple-auth-presentation] applied')
