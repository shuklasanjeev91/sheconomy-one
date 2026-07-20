import fs from 'node:fs'
import path from 'node:path'

const srcPath = 'E:/sheconomy/lib/utils/payment-utils.js'
const outPath = path.resolve('lib/payment/payment.providers.config.ts')

const src = fs.readFileSync(srcPath, 'utf8')
const credStart = src.indexOf('export const PROVIDER_CREDENTIAL_FIELDS =')
const configStart = src.indexOf('export const PAYMENT_PROVIDERS_CONFIG =')
const helperStart = src.indexOf('export const getProviderConfig =')

const credBlock = src.slice(credStart, configStart).trim()
const configBlock = src.slice(configStart, helperStart).trim()

const header = `/**
 * Payment provider catalog — migrated from legacy \`payment-utils.js\`.
 * Credential field definitions + UI provider metadata.
 *
 * Constants (\`PAYMENT_PROVIDERS\`, regions, etc.) live in \`payment.constants.ts\`.
 */

import { PAYMENT_PROVIDERS, PAYMENT_REGIONS, CONNECTION_TYPES } from './payment.constants'

`

const footer = `
export { PROVIDER_CREDENTIAL_FIELDS, PAYMENT_PROVIDERS_CONFIG }
`

const body = `${credBlock}\n\n${configBlock}\n`

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, header + body + footer, 'utf8')
console.log('Wrote', outPath, 'bytes:', fs.statSync(outPath).size)
