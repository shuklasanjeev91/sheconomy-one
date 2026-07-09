import { Platform } from 'react-native'

/** Must run before @supabase/supabase-js is imported (URL is missing on Hermes). */
if (Platform.OS !== 'web') {
  require('../polyfills.native')
}
