/**
 * Strip Flow types from @react-native-community/datetimepicker so Vite/oxc/rolldown
 * can parse it during native Xcode/EAS createBundle (they do not support Flow).
 *
 * - `src/specs` is stripped (VxRN/Rolldown Release bundle).
 * - `src/specs-codegen` keeps Flow for native codegen (codegenConfig.jsSrcsDir).
 * - Metro expo-updates should not transform Flow/codegen specs; see metro.config.cjs
 *   resolveRequest stubs for `datetimepicker/src/specs/*`.
 *
 * Also patch zod Class rest-param constructor (illegal use-strict after CJS transform).
 */
const fs = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')

const pkgRoot = path.join(
  __dirname,
  '../node_modules/@react-native-community/datetimepicker',
)
const srcDir = path.join(pkgRoot, 'src')
const specsDir = path.join(srcDir, 'specs')
const specsCodegenDir = path.join(srcDir, 'specs-codegen')
const pkgJsonPath = path.join(pkgRoot, 'package.json')

function stripFlowInFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8')
  if (!code.includes('@flow') && !code.includes('import type') && !/\btype\s+\w+/.test(code)) {
    return false
  }
  const result = babel.transformSync(code, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    plugins: [
      require.resolve('@babel/plugin-syntax-flow'),
      require.resolve('@babel/plugin-transform-flow-strip-types'),
      require.resolve('@babel/plugin-syntax-jsx'),
    ],
  })
  if (result?.code) {
    fs.writeFileSync(filePath, result.code)
    return true
  }
  return false
}

function walkAndStrip(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      // Native codegen originals — leave Flow intact.
      if (name === 'specs-codegen') continue
      walkAndStrip(p)
      continue
    }
    if (!/\.(js|jsx)$/.test(name)) continue
    try {
      stripFlowInFile(p)
    } catch (error) {
      console.warn('[strip-datetimepicker-flow]', p, error.message)
    }
  }
}

function copyDirSync(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name)
    const dest = path.join(to, name)
    const st = fs.statSync(src)
    if (st.isDirectory()) {
      copyDirSync(src, dest)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

function ensureCodegenFlowSpecs() {
  if (!fs.existsSync(specsDir)) return

  const sample = path.join(specsDir, 'DateTimePickerNativeComponent.js')
  const sampleCode = fs.existsSync(sample) ? fs.readFileSync(sample, 'utf8') : ''
  const specsStillHaveFlow = sampleCode.includes('@flow') || sampleCode.includes('import type')

  // Preserve Flow originals for native codegen once, before first strip.
  if (specsStillHaveFlow) {
    if (fs.existsSync(specsCodegenDir)) {
      fs.rmSync(specsCodegenDir, { recursive: true, force: true })
    }
    copyDirSync(specsDir, specsCodegenDir)
    console.log('[strip-datetimepicker-flow] preserved Flow specs → src/specs-codegen')
  } else if (!fs.existsSync(specsCodegenDir)) {
    console.warn(
      '[strip-datetimepicker-flow] specs already stripped and specs-codegen missing; reinstall package to restore Flow sources for codegen',
    )
  }

  if (fs.existsSync(pkgJsonPath) && fs.existsSync(specsCodegenDir)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
    if (pkg.codegenConfig?.jsSrcsDir !== 'src/specs-codegen') {
      pkg.codegenConfig = {
        ...pkg.codegenConfig,
        jsSrcsDir: 'src/specs-codegen',
      }
      fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`)
      console.log('[strip-datetimepicker-flow] codegenConfig.jsSrcsDir → src/specs-codegen')
    }
  }
}

if (fs.existsSync(srcDir)) {
  ensureCodegenFlowSpecs()
  walkAndStrip(srcDir)
  console.log('[strip-datetimepicker-flow] stripped Flow from datetimepicker src (including specs)')
}

const zodUtil = path.join(__dirname, '../node_modules/zod/v4/core/util.js')
if (fs.existsSync(zodUtil)) {
  const text = fs.readFileSync(zodUtil, 'utf8')
  const next = text.replace(
    /export class Class \{\s*constructor\(\.\.\._args\) \{ \}\s*\}/,
    'export class Class {\n    constructor() { }\n}',
  )
  if (next !== text) {
    fs.writeFileSync(zodUtil, next)
    console.log('[strip-datetimepicker-flow] patched zod Class constructor')
  }
}
