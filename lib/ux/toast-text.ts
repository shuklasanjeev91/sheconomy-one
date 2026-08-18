/**
 * Text normalization for `useAppToast()`.
 *
 * Kept apart from the component so it stays a plain, testable function: call
 * sites regularly forward a server string (`toast.show(result.error)`), so a
 * toast can be asked to render an undefined or blank title.
 */
export type ToastText = { title: string; message?: string }

/**
 * Trims both strings and promotes the message when the title is missing.
 * Returns `null` when nothing readable is left, so no card is shown at all.
 */
export function resolveToastText(
  title?: string | null,
  message?: string | null,
): ToastText | null {
  const heading = typeof title === 'string' ? title.trim() : ''
  const body = typeof message === 'string' ? message.trim() : ''
  if (heading) return body ? { title: heading, message: body } : { title: heading }
  if (body) return { title: body }
  return null
}
