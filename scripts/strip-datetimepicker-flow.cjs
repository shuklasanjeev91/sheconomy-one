/**
 * Strip Flow types from @react-native-community/datetimepicker so Vite/oxc
 * can parse it during native EAS createBundle (oxc does not support Flow).
 * Also patch zod Class rest-param constructor (illegal use-strict after CJS transform).
 */
const fs = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')

const srcDir = path.join(
  __dirname,
  '../node_modules/@react-native-community/datetimepicker/src',
)

if (fs.existsSync(srcDir)) {
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) {
        // Do not touch codegen specs — Android Kotlin needs the original files.
        if (name === 'specs') continue
        walk(p)
        continue
      }
      if (!/\.(js|jsx)$/.test(name)) continue
      const code = fs.readFileSync(p, 'utf8')
      if (!code.includes('@flow') && !code.includes('import type') && !/\btype\s+\w+/.test(code)) {
        continue
      }
      try {
        const result = babel.transformSync(code, {
          filename: p,
          babelrc: false,
          configFile: false,
          plugins: [
            require.resolve('@babel/plugin-syntax-flow'),
            require.resolve('@babel/plugin-transform-flow-strip-types'),
            require.resolve('@babel/plugin-syntax-jsx'),
          ],
        })
        if (result?.code) fs.writeFileSync(p, result.code)
      } catch (error) {
        console.warn('[strip-datetimepicker-flow]', p, error.message)
      }
    }
  }
  walk(srcDir)
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
