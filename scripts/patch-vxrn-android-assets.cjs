#!/usr/bin/env node
/**
 * Patch vxrn's native asset plugin so Android release bundles pack JS assets.
 *
 * Upstream copies every `require('./x.png')` asset to `<assetsDest>/assets/<dir>/x.png`
 * (the iOS layout). On Android, `--assets-dest` is a res/ folder and React Native
 * loads bundled images as `drawable-mdpi/<dir_with_underscores>_x` resources, so the
 * iOS-style folder is silently dropped by AAPT: preset meeting backgrounds, logos and
 * navigation icons are missing from the APK (blank thumbnails, "Could not prepare
 * this background" when applying a virtual background).
 *
 * Fix: on Android, use React Native's own resource folder + identifier rules
 * (@react-native/assets-registry/path-support). AAPT also rejects a JPEG named
 * `.png` (web and iOS don't care), and resources are looked up by name without
 * the extension, so the copy takes the extension of the real image format.
 */
const fs = require('node:fs')
const path = require('node:path')

const marker = 'vxrn:android-assets-patched-v2'
const previousMarker = 'vxrn:android-assets-patched-v1'

const androidDest = (indent, declare) => `if (opts.assetsDest) {
${indent}  // ${marker}
${indent}  ${declare} relativeAssetDir = dirname(relativePath).replace(/\\\\/g, "/");
${indent}  ${declare} assetDestDir = join(opts.assetsDest, "assets", relativeAssetDir);
${indent}  ${declare} assetDestName = \`\${name}.\${ext}\`;
${indent}  if (opts.platform === "android") {
${indent}    ${declare} drawable = ["gif", "jpeg", "jpg", "ktx", "png", "webp", "xml"].includes(ext.toLowerCase());
${indent}    ${declare} realExt = ext;
${indent}    if (drawable) {
${indent}      ${declare} magic = readFileSync(id).subarray(0, 12);
${indent}      if (magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff) realExt = "jpg";
${indent}      else if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47) realExt = "png";
${indent}      else if (magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46) realExt = "gif";
${indent}      else if (magic.subarray(0, 4).toString() === "RIFF" && magic.subarray(8, 12).toString() === "WEBP") realExt = "webp";
${indent}    }
${indent}    assetDestDir = join(opts.assetsDest, drawable ? "drawable-mdpi" : "raw");
${indent}    assetDestName = \`\${("assets/" + relativeAssetDir + "/" + name).toLowerCase().replace(/\\//g, "_").replace(/([^a-z0-9_])/g, "").replace(/^(?:assets|assetsunstable_path)_/, "")}.\${realExt}\`;
${indent}  }
${indent}  mkdirSync(assetDestDir, {
${indent}    recursive: true
${indent}  });
${indent}  copyFileSync(id, join(assetDestDir, assetDestName));
${indent}}`

const upstream = (indent, declare) => `if (opts.assetsDest) {
${indent}  ${declare} relativeAssetDir = dirname(relativePath).replace(/\\\\/g, "/");
${indent}  ${declare} assetDestDir = join(opts.assetsDest, "assets", relativeAssetDir);
${indent}  mkdirSync(assetDestDir, {
${indent}    recursive: true
${indent}  });
${indent}  copyFileSync(id, join(assetDestDir, \`\${name}.\${ext}\`));
${indent}}`

const targets = [
  { file: 'createNativeDevEngine.mjs', declare: 'const', patchedDeclare: 'let' },
  { file: 'createNativeDevEngine.native.js', declare: 'var', patchedDeclare: 'var' },
]

const indent = '        '
for (const { file, declare, patchedDeclare } of targets) {
  const target = path.join(__dirname, '..', 'node_modules', 'vxrn', 'dist', 'utils', file)
  const label = path.relative(process.cwd(), target)
  if (!fs.existsSync(target)) {
    console.warn('[patch-vxrn-android-assets] skip — missing', label)
    continue
  }
  const src = fs.readFileSync(target, 'utf8')
  if (src.includes(marker)) {
    console.log('[patch-vxrn-android-assets] already patched', label)
    continue
  }
  const previous = new RegExp(
    `if \\(opts\\.assetsDest\\) \\{\\n\\s*// ${previousMarker}[\\s\\S]*?copyFileSync\\(id, join\\(assetDestDir, assetDestName\\)\\);\\n\\s*\\}`,
  )
  const from = src.includes(previousMarker) ? src.match(previous)?.[0] : upstream(indent, declare)
  if (!from || !src.includes(from)) {
    console.warn('[patch-vxrn-android-assets] unexpected source', label)
    continue
  }
  fs.writeFileSync(target, src.replace(from, androidDest(indent, patchedDeclare)))
  console.log('[patch-vxrn-android-assets] patched', label)
}
