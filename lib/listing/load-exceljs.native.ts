/**
 * Native: never pull `exceljs` into the Hermes bundle.
 * It ships async generators (unsupported on Hermes) and Node stream deps.
 * Bulk Excel import is web-only (see downloadBulkImportExcelTemplate).
 */
export async function loadExcelJS(): Promise<never> {
  throw new Error('Excel bulk import is only available on web')
}
