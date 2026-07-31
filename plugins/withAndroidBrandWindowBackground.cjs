/**
 * Prevents Android cold-start flash after the splash theme is swapped.
 *
 * MainActivity calls setTheme(AppTheme) before React mounts. Use a neutral
 * white windowBackground — brand magenta stuck on screen looked like a broken blank.
 */
const { withAndroidStyles, createRunOncePlugin } = require('@expo/config-plugins')

function withAndroidBrandWindowBackground(config) {
  return withAndroidStyles(config, (mod) => {
    const styles = mod.modResults
    const appTheme = styles?.resources?.style?.find(
      (entry) => entry?.$?.name === 'AppTheme',
    )
    if (!appTheme) return mod

    if (!appTheme.item) appTheme.item = []
    const items = Array.isArray(appTheme.item) ? appTheme.item : [appTheme.item]
    appTheme.item = items

    const existing = items.find(
      (item) => item?.$?.name === 'android:windowBackground',
    )
    if (existing) {
      existing._ = '@android:color/white'
    } else {
      items.push({
        $: { name: 'android:windowBackground' },
        _: '@android:color/white',
      })
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidBrandWindowBackground,
  'withAndroidBrandWindowBackground',
  '1.0.0',
)
