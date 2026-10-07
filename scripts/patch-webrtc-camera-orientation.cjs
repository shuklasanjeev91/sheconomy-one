/**
 * Camera video follows the screen orientation (portrait / landscape) on every device.
 *
 * iOS: RTCCameraVideoCapturer rotates frames by the *physical* device orientation,
 * ignores face-up / face-down and defaults to portrait. An iPad lying flat or on a
 * stand therefore sent sideways video. A delegate between the capturer and the video
 * source (or effect processor) re-tags each frame with the rotation for the current
 * *interface* orientation, so the video always matches what the user sees.
 *
 * Android: Camera2 already follows the display rotation, but RTCView's
 * onDimensionsChange reported the raw buffer size. Report the rotated size plus
 * `rotation` so JS can tell portrait from landscape video.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', 'node_modules', 'react-native-webrtc')
const TAG = '[patch-webrtc-camera-orientation]'

function patchFile(relativePath, marker, edits) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) return
  let contents = fs.readFileSync(target, 'utf8')
  if (contents.includes(marker)) return
  for (const [needle, replacement] of edits) {
    if (!contents.includes(needle)) {
      console.warn(`${TAG} Unexpected ${path.basename(target)} shape — skip`)
      return
    }
    contents = contents.replace(needle, replacement)
  }
  fs.writeFileSync(target, contents)
  console.log(`${TAG} Patched`, target)
}

const IOS_ROTATOR = `#if TARGET_OS_IOS
#import <UIKit/UIKit.h>
#import <WebRTC/RTCVideoCapturer.h>
#import <WebRTC/RTCVideoFrame.h>

static const void *kSHEFrameRotatorKey = &kSHEFrameRotatorKey;

static UIInterfaceOrientation SHECurrentInterfaceOrientation(void) {
    UIWindowScene *fallback = nil;
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (![scene isKindOfClass:[UIWindowScene class]]) continue;
        if (scene.activationState == UISceneActivationStateForegroundActive) {
            return ((UIWindowScene *)scene).interfaceOrientation;
        }
        if (fallback == nil) fallback = (UIWindowScene *)scene;
    }
    return fallback ? fallback.interfaceOrientation : UIInterfaceOrientationUnknown;
}

static BOOL SHECapturerUsesFrontCamera(RTCVideoCapturer *capturer) {
    if (![capturer isKindOfClass:[RTCCameraVideoCapturer class]]) return NO;
    for (AVCaptureInput *input in ((RTCCameraVideoCapturer *)capturer).captureSession.inputs) {
        if ([input isKindOfClass:[AVCaptureDeviceInput class]]) {
            return ((AVCaptureDeviceInput *)input).device.position == AVCaptureDevicePositionFront;
        }
    }
    return NO;
}

/** Re-tags camera frames with the rotation for the interface orientation (SHE camera orientation). */
@interface SHEInterfaceOrientationFrameRotator : NSObject <RTCVideoCapturerDelegate>
@property(atomic, strong) id<RTCVideoCapturerDelegate> target;
@property(atomic, assign) UIInterfaceOrientation interfaceOrientation;
@end

@implementation SHEInterfaceOrientationFrameRotator {
    NSUInteger _frameCount;
}

- (instancetype)initWithTarget:(id<RTCVideoCapturerDelegate>)target {
    self = [super init];
    if (self) {
        _target = target;
        _interfaceOrientation = UIInterfaceOrientationUnknown;
        [self refreshInterfaceOrientation];
    }
    return self;
}

- (void)refreshInterfaceOrientation {
    __weak SHEInterfaceOrientationFrameRotator *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        weakSelf.interfaceOrientation = SHECurrentInterfaceOrientation();
    });
}

- (void)capturer:(RTCVideoCapturer *)capturer didCaptureVideoFrame:(RTCVideoFrame *)frame {
    // UIKit can only be read on the main thread; refresh a few times a second.
    if (_frameCount++ % 8 == 0) [self refreshInterfaceOrientation];

    RTCVideoRotation rotation = frame.rotation;
    switch (self.interfaceOrientation) {
        case UIInterfaceOrientationPortrait:
            rotation = RTCVideoRotation_90;
            break;
        case UIInterfaceOrientationPortraitUpsideDown:
            rotation = RTCVideoRotation_270;
            break;
        case UIInterfaceOrientationLandscapeLeft:
            rotation = SHECapturerUsesFrontCamera(capturer) ? RTCVideoRotation_0 : RTCVideoRotation_180;
            break;
        case UIInterfaceOrientationLandscapeRight:
            rotation = SHECapturerUsesFrontCamera(capturer) ? RTCVideoRotation_180 : RTCVideoRotation_0;
            break;
        default:
            break;
    }
    if (rotation != frame.rotation) {
        frame = [[RTCVideoFrame alloc] initWithBuffer:frame.buffer rotation:rotation timeStampNs:frame.timeStampNs];
    }
    [self.target capturer:capturer didCaptureVideoFrame:frame];
}

@end
#endif

@implementation WebRTCModule (RTCMediaStream)`

patchFile('ios/RCTWebRTC/WebRTCModule+RTCMediaStream.m', 'SHEInterfaceOrientationFrameRotator', [
  ['@implementation WebRTCModule (RTCMediaStream)', IOS_ROTATOR],
  [
    `        RTCCameraVideoCapturer *videoCapturer = [[RTCCameraVideoCapturer alloc] initWithDelegate:videoSource];`,
    `#if TARGET_OS_IOS
        SHEInterfaceOrientationFrameRotator *frameRotator =
            [[SHEInterfaceOrientationFrameRotator alloc] initWithTarget:videoSource];
        RTCCameraVideoCapturer *videoCapturer = [[RTCCameraVideoCapturer alloc] initWithDelegate:frameRotator];
        // The capturer's delegate is weak; the capturer keeps the rotator alive.
        objc_setAssociatedObject(videoCapturer, kSHEFrameRotatorKey, frameRotator, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
#else
        RTCCameraVideoCapturer *videoCapturer = [[RTCCameraVideoCapturer alloc] initWithDelegate:videoSource];
#endif`,
  ],
  [
    `    capturer.delegate = self.videoEffectProcessor;`,
    `#if TARGET_OS_IOS
    SHEInterfaceOrientationFrameRotator *frameRotator = objc_getAssociatedObject(capturer, kSHEFrameRotatorKey);
    if (frameRotator != nil) {
        frameRotator.target = self.videoEffectProcessor;
        return;
    }
#endif
    capturer.delegate = self.videoEffectProcessor;`,
  ],
])

patchFile('android/src/main/java/com/oney/WebRTCModule/WebRTCView.java', 'params.putInt("rotation", rotation)', [
  [
    `                        params.putInt("width", videoWidth);
                        params.putInt("height", videoHeight);`,
    `                        boolean sideways = rotation % 180 != 0;
                        params.putInt("width", sideways ? videoHeight : videoWidth);
                        params.putInt("height", sideways ? videoWidth : videoHeight);
                        params.putInt("rotation", rotation);`,
  ],
])
