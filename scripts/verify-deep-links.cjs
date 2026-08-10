#!/usr/bin/env node
/**
 * Deep link doctor for Android App Links + iOS Universal Links.
 *
 * Checks every layer that has to line up before
 * https://www.sheconomy.in/co-work/meeting/<code>/live opens the installed app
 * instead of a browser:
 *
 *   1. app.json declares each host with autoVerify in its own intent filter.
 *   2. /.well-known/assetlinks.json is reachable with NO redirect (Android's
 *      fetcher refuses to follow them) and lists the signing certificate of the
 *      build that is actually installed.
 *   3. /.well-known/apple-app-site-association is reachable with NO redirect
 *      and names the correct Team ID + bundle identifier.
 *   4. Google's Digital Asset Links API and Apple's AASA CDN agree.
 *   5. The connected Android device reports the domain as "verified".
 *
 * Usage:  yarn verify:deep-links
 */

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const expo = appJson.expo

const ANDROID_PACKAGE = expo.android.package
const IOS_BUNDLE_ID = expo.ios.bundleIdentifier
const IOS_TEAM_ID = expo.ios.appleTeamId
const APP_ID = `${IOS_TEAM_ID}.${IOS_BUNDLE_ID}`

const problems = []
const warnings = []

function fail(message, hint) {
  problems.push({ message, hint })
  console.log(`  FAIL  ${message}`)
  if (hint) console.log(`        → ${hint}`)
}

function warn(message, hint) {
  warnings.push({ message, hint })
  console.log(`  WARN  ${message}`)
  if (hint) console.log(`        → ${hint}`)
}

function pass(message) {
  console.log(`  OK    ${message}`)
}

function heading(title) {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
}

/** Hosts declared in an autoVerify intent filter, and how they are grouped. */
function readAndroidHosts() {
  const filters = (expo.android.intentFilters || []).filter((f) => f.autoVerify)
  return filters.map((filter) =>
    (filter.data || [])
      .filter((d) => d.scheme === 'https' && d.host)
      .map((d) => d.host)
  )
}

function readIosDomains() {
  return (expo.ios.associatedDomains || [])
    .filter((entry) => entry.startsWith('applinks:'))
    .map((entry) => entry.slice('applinks:'.length))
}

async function fetchNoRedirect(url) {
  try {
    const res = await fetch(url, { redirect: 'manual' })
    const location = res.headers.get('location')
    const body = res.status >= 200 && res.status < 300 ? await res.text() : ''
    return {
      status: res.status,
      location,
      contentType: res.headers.get('content-type') || '',
      body,
    }
  } catch (error) {
    return { error: error.message }
  }
}

async function checkAssetLinks(host) {
  const url = `https://${host}/.well-known/assetlinks.json`
  const res = await fetchNoRedirect(url)

  if (res.error) {
    fail(`${host}: assetlinks.json unreachable (${res.error})`)
    return null
  }
  if (res.status >= 300 && res.status < 400) {
    fail(
      `${host}: assetlinks.json redirects (${res.status} → ${res.location})`,
      'Android does not follow redirects. Serve this file directly on this host, ' +
        'or drop the host from the autoVerify intent filter.'
    )
    return null
  }
  if (res.status !== 200) {
    fail(`${host}: assetlinks.json returned HTTP ${res.status}`)
    return null
  }
  if (!res.contentType.includes('application/json')) {
    warn(
      `${host}: assetlinks.json Content-Type is "${res.contentType}"`,
      'Should be application/json.'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(res.body)
  } catch {
    fail(`${host}: assetlinks.json is not valid JSON`)
    return null
  }

  const statement = (Array.isArray(parsed) ? parsed : []).find(
    (entry) => entry?.target?.package_name === ANDROID_PACKAGE
  )
  if (!statement) {
    fail(`${host}: assetlinks.json has no statement for ${ANDROID_PACKAGE}`)
    return null
  }

  const fingerprints = (statement.target.sha256_cert_fingerprints || []).map((fp) =>
    fp.toUpperCase().replace(/\s/g, '')
  )
  pass(`${host}: assetlinks.json served directly with ${fingerprints.length} fingerprint(s)`)
  return fingerprints
}

async function checkAasa(host) {
  const url = `https://${host}/.well-known/apple-app-site-association`
  const res = await fetchNoRedirect(url)

  if (res.error) {
    fail(`${host}: AASA unreachable (${res.error})`)
    return
  }
  if (res.status >= 300 && res.status < 400) {
    // Since iOS 9.3 devices read the association from Apple's CDN rather than
    // from the origin, so a redirect here is only a problem if the CDN check
    // below also fails.
    warn(
      `${host}: AASA redirects (${res.status} → ${res.location})`,
      "Apple's CDN result below is what iOS actually uses — check that instead."
    )
    return
  }
  if (res.status !== 200) {
    fail(`${host}: AASA returned HTTP ${res.status}`)
    return
  }

  let parsed
  try {
    parsed = JSON.parse(res.body)
  } catch {
    fail(`${host}: AASA is not valid JSON`, 'The file must have no .json extension but JSON content.')
    return
  }

  const details = parsed?.applinks?.details || []
  const declared = details.flatMap((d) => d.appIDs || (d.appID ? [d.appID] : []))
  if (!declared.includes(APP_ID)) {
    fail(
      `${host}: AASA does not list ${APP_ID}`,
      `Found: ${declared.join(', ') || '(none)'}`
    )
    return
  }
  pass(`${host}: AASA served directly and lists ${APP_ID}`)
}

async function checkGoogleVerifier(host) {
  const url =
    'https://digitalassetlinks.googleapis.com/v1/statements:list' +
    `?source.web.site=https://${host}&relation=delegate_permission/common.handle_all_urls`
  try {
    const res = await fetch(url)
    const json = await res.json()
    if (json.errorCode || json.debugString) {
      const code = (json.errorCode || []).join(', ')
      fail(
        `${host}: Google's verifier rejects this domain${code ? ` (${code})` : ''}`,
        (json.debugString || '').trim().split('\n').filter(Boolean).pop()
      )
      return
    }
    const matches = (json.statements || []).some(
      (s) => s?.target?.androidApp?.packageName === ANDROID_PACKAGE
    )
    if (!matches) {
      fail(`${host}: Google's verifier returned no statement for ${ANDROID_PACKAGE}`)
      return
    }
    pass(`${host}: Google's verifier accepts the association`)
  } catch (error) {
    warn(`${host}: could not reach Google's verifier (${error.message})`)
  }
}

async function checkAppleCdn(host) {
  try {
    const res = await fetch(`https://app-site-association.cdn-apple.com/a/v1/${host}`)
    if (res.status !== 200) {
      warn(
        `${host}: Apple's CDN has no cached association (HTTP ${res.status})`,
        'Apple refreshes on its own schedule; retry after deploying.'
      )
      return
    }
    const json = await res.json()
    const declared = (json?.applinks?.details || []).flatMap(
      (d) => d.appIDs || (d.appID ? [d.appID] : [])
    )
    if (!declared.includes(APP_ID)) {
      fail(`${host}: Apple's CDN has a stale association (${declared.join(', ') || 'empty'})`)
      return
    }
    pass(`${host}: Apple's CDN serves the current association`)
  } catch (error) {
    warn(`${host}: could not reach Apple's CDN (${error.message})`)
  }
}

/** SHA-256 of every keystore we can find locally, so mismatches are obvious. */
function localKeystoreFingerprints() {
  const candidates = [
    { label: 'android debug keystore', file: 'android/app/debug.keystore', alias: 'androiddebugkey', pass: 'android' },
    { label: 'release keystore', file: 'android/app/release.keystore', alias: null, pass: null },
  ]

  const found = []
  for (const candidate of candidates) {
    const file = path.join(ROOT, candidate.file)
    if (!fs.existsSync(file)) continue
    if (!candidate.alias) {
      found.push({ label: candidate.label, fingerprint: null, file: candidate.file })
      continue
    }
    try {
      const out = execFileSync(
        'keytool',
        ['-list', '-v', '-keystore', file, '-alias', candidate.alias, '-storepass', candidate.pass, '-keypass', candidate.pass],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
      )
      const match = out.match(/SHA256:\s*([A-F0-9:]+)/i)
      if (match) {
        found.push({ label: candidate.label, fingerprint: match[1].toUpperCase(), file: candidate.file })
      }
    } catch {
      // keytool missing or keystore locked — not fatal
    }
  }
  return found
}

function checkDevice() {
  let devices = []
  try {
    const out = execFileSync('adb', ['devices'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    devices = out
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('device'))
  } catch {
    console.log('  SKIP  adb not available — connect an Android device to check on-device state')
    return
  }

  if (devices.length === 0) {
    console.log('  SKIP  no Android device connected')
    return
  }

  try {
    const out = execFileSync('adb', ['shell', 'pm', 'get-app-links', ANDROID_PACKAGE], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    console.log(out.trim().split('\n').map((l) => `        ${l}`).join('\n'))

    if (/verified/.test(out)) {
      pass(`device reports at least one verified domain for ${ANDROID_PACKAGE}`)
    } else {
      fail(
        `device reports no verified domain for ${ANDROID_PACKAGE}`,
        `Re-run verification with: adb shell pm verify-app-links --re-verify ${ANDROID_PACKAGE}`
      )
    }
  } catch (error) {
    warn(`could not query app links on device (${error.message})`)
  }
}

async function main() {
  console.log(`SHEconomy deep link check`)
  console.log(`package=${ANDROID_PACKAGE}  appID=${APP_ID}`)

  heading('1. Android intent filters (app.json)')
  const groups = readAndroidHosts()
  const androidHosts = [...new Set(groups.flat())]
  if (androidHosts.length === 0) {
    fail('no autoVerify intent filter declares an https host')
  }
  for (const group of groups) {
    if (group.length > 1) {
      warn(
        `hosts ${group.join(', ')} share one intent filter`,
        'On Android 11 and lower one failing host invalidates the whole filter. Give each host its own filter.'
      )
    }
  }
  if (groups.every((g) => g.length <= 1) && androidHosts.length > 0) {
    pass(`each host has its own autoVerify filter (${androidHosts.join(', ')})`)
  }

  heading('2. Android — assetlinks.json')
  const servedFingerprints = new Set()
  for (const host of androidHosts) {
    const fingerprints = await checkAssetLinks(host)
    for (const fp of fingerprints || []) servedFingerprints.add(fp)
  }

  heading('3. Android — signing certificates')
  if (servedFingerprints.size === 0) {
    warn('no fingerprints could be read from the served assetlinks.json')
  } else {
    for (const fp of servedFingerprints) console.log(`        declared: ${fp}`)
  }
  const local = localKeystoreFingerprints()
  for (const entry of local) {
    if (!entry.fingerprint) continue
    if (servedFingerprints.has(entry.fingerprint)) {
      pass(`${entry.label} matches a declared fingerprint`)
    } else {
      warn(
        `${entry.label} (${entry.file}) is NOT in assetlinks.json`,
        `Builds signed with it will never verify. Fingerprint: ${entry.fingerprint}`
      )
    }
  }
  console.log(
    '        Reminder: a Play Store install is signed by Play App Signing, not by your\n' +
      '        upload key. Copy the SHA-256 from Play Console → Test and release → App\n' +
      '        signing → "App signing key certificate" into assetlinks.json.'
  )

  heading('4. Android — Google verifier')
  for (const host of androidHosts) await checkGoogleVerifier(host)

  heading('5. iOS — apple-app-site-association')
  const iosHosts = readIosDomains()
  for (const host of iosHosts) await checkAasa(host)

  heading("6. iOS — Apple's CDN")
  for (const host of iosHosts) await checkAppleCdn(host)

  heading('7. Connected Android device')
  checkDevice()

  heading('Summary')
  if (problems.length === 0) {
    console.log(`  ${warnings.length} warning(s), no blocking problems.`)
  } else {
    console.log(`  ${problems.length} blocking problem(s), ${warnings.length} warning(s).`)
  }
  process.exit(problems.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
