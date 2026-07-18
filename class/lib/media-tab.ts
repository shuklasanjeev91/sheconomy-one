import { isClassAudioPath, isClassHomePath, isClassVideoPath } from '~/lib/routes'

export type MediaTab = 'video' | 'audio'

/** Catalog browse tab from path (`/class/video` vs `/class/audio`). Home hub is not a catalog tab. */
export function mediaTabFromPath(pathname: string): MediaTab {
  return isClassAudioPath(pathname) ? 'audio' : 'video'
}

/** True when the path should show the full media catalog (not the learn hub). */
export function isClassCatalogBrowsePath(pathname: string): boolean {
  return isClassVideoPath(pathname) || isClassAudioPath(pathname)
}

export function shouldShowClassLearnHub(pathname: string): boolean {
  return isClassHomePath(pathname)
}
