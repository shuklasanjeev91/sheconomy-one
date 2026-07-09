import { Platform } from 'react-native'

export type RuntimePlatform = 'web' | 'ios' | 'android'

export function getRuntimePlatform(): RuntimePlatform {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return 'web'
}

export function isWebRuntime() {
  return Platform.OS === 'web'
}

export function isNativeRuntime() {
  return Platform.OS === 'ios' || Platform.OS === 'android'
}

export function hasWebMediaDevices() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export function hasDisplayMedia() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
}

export function hasMediaRecorder() {
  return typeof MediaRecorder !== 'undefined'
}

export function hasSpeechRecognition() {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}

/** LiveKit video — web via getUserMedia; iOS/Android via react-native-webrtc. */
export function supportsLiveKitVideo() {
  if (isWebRuntime()) return hasWebMediaDevices()
  return isNativeRuntime()
}

export function supportsNativeAudioRecording() {
  return isNativeRuntime()
}
