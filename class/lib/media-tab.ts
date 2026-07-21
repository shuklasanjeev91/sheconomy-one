import { isClassAudioPath, isClassHomePath, isClassVideoPath } from '~/lib/routes'

export type MediaTab = 'video' | 'audio'

/**
 * Catalog media type from path.
 * `/class` and `/class/video` → video; `/class/audio` → audio (YouTube-style Class home).
 */
export function mediaTabFromPath(pathname: string): MediaTab {
  return isClassAudioPath(pathname) ? 'audio' : 'video'
}

/** True when the path shows the published Video/Audio catalog. */
export function isClassCatalogBrowsePath(pathname: string): boolean {
  return isClassHomePath(pathname) || isClassVideoPath(pathname) || isClassAudioPath(pathname)
}

/** @deprecated Class home is the catalog; learn-hub mode was removed. */
export function shouldShowClassLearnHub(_pathname: string): boolean {
  return false
}
