/** Web/SSR: real ExcelJS for vendor bulk import. */
export async function loadExcelJS(): Promise<typeof import('exceljs')> {
  return import('exceljs')
}
