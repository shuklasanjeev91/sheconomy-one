export const Audio = {
  RecordingOptionsPresets: { HIGH_QUALITY: {} },
  async requestPermissionsAsync() {
    return { granted: false }
  },
  async setAudioModeAsync() {},
  Recording: class {
    async prepareToRecordAsync() {}
    async startAsync() {}
    async stopAndUnloadAsync() {}
    getURI() {
      return null
    }
  },
}
