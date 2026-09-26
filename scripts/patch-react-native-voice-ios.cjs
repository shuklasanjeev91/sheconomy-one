/**
 * Let SFSpeechRecognizer run during a LiveKit call.
 * Stock @react-native-voice/voice replaces the audio category without
 * mixWithOthers and activates the session with NotifyOthersOnDeactivation,
 * which stops the meeting mic and makes captions fail to start on iPad.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-voice',
  'voice',
  'ios',
  'Voice',
  'Voice.m',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

let contents = fs.readFileSync(target, 'utf8')
if (contents.includes('SHEconomy live-caption mic share')) {
  process.exit(0)
}

const setupStart = contents.indexOf('/** Returns "YES" if no errors had occurred */')
const setupEnd = contents.indexOf('- (BOOL)isHeadsetPluggedIn {')
if (setupStart < 0 || setupEnd < 0) {
  console.error('[patch-react-native-voice-ios] setupAudioSession not found')
  process.exit(1)
}

const setup = `/** Returns "YES" if no errors had occurred */
-(BOOL) setupAudioSession {
    // SHEconomy live-caption mic share: keep LiveKit's playAndRecord session
    // alive. NotifyOthersOnDeactivation deactivates WebRTC and speech never starts.
    AVAudioSessionCategoryOptions options =
        AVAudioSessionCategoryOptionMixWithOthers |
        AVAudioSessionCategoryOptionDefaultToSpeaker |
        AVAudioSessionCategoryOptionAllowBluetooth |
        AVAudioSessionCategoryOptionAllowBluetoothA2DP;
    NSError* audioSessionError = nil;
    [self.audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
                              mode:AVAudioSessionModeDefault
                           options:options
                             error:&audioSessionError];
    [self.audioSession setPreferredSampleRate:48000 error:nil];
    audioSessionError = nil;
    [self.audioSession setActive:YES error:&audioSessionError];

    if (audioSessionError != nil) {
        [self sendResult:@{@"code": @"audio", @"message": [audioSessionError localizedDescription]} :nil :nil :nil];
        return NO;
    }

    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(teardown) name:RCTBridgeWillReloadNotification object:nil];

    return YES;
}

`

contents = contents.slice(0, setupStart) + setup + contents.slice(setupEnd)

contents = contents.replace(
  `-(void) resetAudioSession {
    if (self.audioSession == nil) {
        self.audioSession = [AVAudioSession sharedInstance];
    }
    // Set audio session to inactive and notify other sessions
    // [self.audioSession setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error: nil];
    NSString* audioCategory = [self.audioSession category];
    // Category hasn't changed -- do nothing
    if ([self.priorAudioCategory isEqualToString:audioCategory]) return;
    // Reset back to the previous category
    if ([self isHeadsetPluggedIn] || [self isHeadSetBluetooth]) {
        [self.audioSession setCategory:self.priorAudioCategory withOptions:AVAudioSessionCategoryOptionAllowBluetooth error: nil];
    } else {
        [self.audioSession setCategory:self.priorAudioCategory withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker error: nil];
    }
    // Remove pointer reference
    self.audioSession = nil;
}`,
  `-(void) resetAudioSession {
    if (self.audioSession == nil) {
        self.audioSession = [AVAudioSession sharedInstance];
    }
    // Hand the session back to the call without dropping mixWithOthers.
    AVAudioSessionCategoryOptions options =
        AVAudioSessionCategoryOptionMixWithOthers |
        AVAudioSessionCategoryOptionDefaultToSpeaker |
        AVAudioSessionCategoryOptionAllowBluetooth |
        AVAudioSessionCategoryOptionAllowBluetoothA2DP;
    [self.audioSession setCategory:AVAudioSessionCategoryPlayAndRecord
                              mode:AVAudioSessionModeVideoChat
                           options:options
                             error:nil];
    [self.audioSession setActive:YES error:nil];
    self.audioSession = nil;
}`,
)

contents = contents.replace(
  `    AVAudioFormat* recordingFormat = [inputNode outputFormatForBus:0];`,
  `    AVAudioFormat* recordingFormat = [inputNode outputFormatForBus:0];
    if (recordingFormat == nil || recordingFormat.sampleRate == 0 || recordingFormat.channelCount == 0) {
        recordingFormat = [[AVAudioFormat alloc] initStandardFormatWithSampleRate:48000 channels:1];
    }`,
)

fs.writeFileSync(target, contents)
console.log('[patch-react-native-voice-ios] Patched', target)
