import AsyncStorage from '@react-native-async-storage/async-storage'

const notesKey = (meetingId: string, userId: string) =>
  `sheconomy:meeting-notes:${meetingId}:${userId}`

export async function loadMeetingHostNotes(meetingId: string, userId: string): Promise<string> {
  if (!meetingId || !userId) return ''
  try {
    return (await AsyncStorage.getItem(notesKey(meetingId, userId))) ?? ''
  } catch {
    return ''
  }
}

export async function saveMeetingHostNotes(
  meetingId: string,
  userId: string,
  body: string,
): Promise<void> {
  if (!meetingId || !userId) return
  await AsyncStorage.setItem(notesKey(meetingId, userId), body)
}
