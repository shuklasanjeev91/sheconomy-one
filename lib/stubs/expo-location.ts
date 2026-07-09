export async function requestForegroundPermissionsAsync() {
  return { granted: false }
}

export async function getCurrentPositionAsync() {
  throw new Error('expo-location is not available on web')
}

export const Accuracy = { Balanced: 3 }
