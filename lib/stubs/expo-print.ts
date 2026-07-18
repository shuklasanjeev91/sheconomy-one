/** Web stub for expo-print — invoice uses browser print on web. */
export async function printAsync(_options: { html?: string; uri?: string }) {
  return { uri: '' }
}

export async function printToFileAsync(options: { html?: string }) {
  return { uri: options.html ? 'data:text/html,' : '', numberOfPages: 1 }
}

export default {
  printAsync,
  printToFileAsync,
}
