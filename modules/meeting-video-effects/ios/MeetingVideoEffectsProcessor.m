#import "MeetingVideoEffectsProcessor.h"

#import <CoreImage/CoreImage.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <WebRTC/RTCCVPixelBuffer.h>
#import <WebRTC/RTCVideoFrame.h>
#import <react-native-webrtc/ProcessorProvider.h>
#import <react-native-webrtc/VideoFrameProcessor.h>

static NSString *const kProcessorName = @"sheconomyVirtualBackground";
static NSString *gMode = @"off";
static NSString *gImagePath = nil;
static double gBlurRadius = 12.0;
static dispatch_queue_t gConfigQueue;

@interface SHEVirtualBackgroundFrameProcessor : NSObject <VideoFrameProcessorDelegate>
@property(nonatomic, strong) CIContext *context;
@property(nonatomic, strong) VNGeneratePersonSegmentationRequest *segmentationRequest;
@property(nonatomic, strong, nullable) CIImage *cachedBackground;
@property(nonatomic, copy, nullable) NSString *cachedBackgroundPath;
@end

@implementation SHEVirtualBackgroundFrameProcessor

- (instancetype)init {
  self = [super init];
  if (self) {
    _context = [CIContext contextWithOptions:@{
      kCIContextUseSoftwareRenderer : @NO,
      kCIContextCacheIntermediates : @YES,
    }];
    _segmentationRequest = [VNGeneratePersonSegmentationRequest new];
    _segmentationRequest.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelBalanced;
    _segmentationRequest.outputPixelFormat = kCVPixelFormatType_OneComponent8;
  }
  return self;
}

static CGImagePropertyOrientation SHEPropertyOrientation(UIImageOrientation orientation) {
  switch (orientation) {
    case UIImageOrientationDown: return kCGImagePropertyOrientationDown;
    case UIImageOrientationLeft: return kCGImagePropertyOrientationLeft;
    case UIImageOrientationRight: return kCGImagePropertyOrientationRight;
    case UIImageOrientationUpMirrored: return kCGImagePropertyOrientationUpMirrored;
    case UIImageOrientationDownMirrored: return kCGImagePropertyOrientationDownMirrored;
    case UIImageOrientationLeftMirrored: return kCGImagePropertyOrientationLeftMirrored;
    case UIImageOrientationRightMirrored: return kCGImagePropertyOrientationRightMirrored;
    default: return kCGImagePropertyOrientationUp;
  }
}

- (CIImage *)imageFromPath:(NSString *)path {
  if (path.length == 0) return nil;
  NSString *filePath = path;
  if ([path hasPrefix:@"file://"]) {
    filePath = [NSURL URLWithString:path].path ?: [path substringFromIndex:7];
  }
  // Camera photos store "which way is up" as EXIF; the raw pixels can be sideways.
  NSDictionary *applyOrientation = @{kCIImageApplyOrientationProperty : @YES};
  if (![path hasPrefix:@"http://"] && ![path hasPrefix:@"https://"]) {
    UIImage *uiImage = [UIImage imageWithContentsOfFile:filePath];
    if (uiImage.CGImage) {
      return [[CIImage imageWithCGImage:uiImage.CGImage]
          imageByApplyingCGOrientation:SHEPropertyOrientation(uiImage.imageOrientation)];
    }
    return [CIImage imageWithContentsOfURL:[NSURL fileURLWithPath:filePath] options:applyOrientation];
  }
  NSURL *url = [NSURL URLWithString:path];
  return url ? [CIImage imageWithContentsOfURL:url options:applyOrientation] : nil;
}

/**
 * The camera buffer is in sensor orientation and WebRTC turns it clockwise by
 * `rotation` only when showing or sending it. Fit the picture upright for that
 * final view, then turn it back into buffer space so the rotation leaves it
 * upright (otherwise it shows upside down or sideways).
 */
- (CIImage *)backgroundImageForPath:(NSString *)path
                             extent:(CGRect)extent
                           rotation:(RTCVideoRotation)rotation {
  if (![self.cachedBackgroundPath isEqualToString:path]) {
    self.cachedBackground = [self imageFromPath:path];
    self.cachedBackgroundPath = path;
  }
  CIImage *image = self.cachedBackground;
  if (!image || CGRectIsEmpty(image.extent)) return nil;
  image = [image imageByApplyingTransform:CGAffineTransformMakeTranslation(-CGRectGetMinX(image.extent),
                                                                           -CGRectGetMinY(image.extent))];

  BOOL sideways = rotation == RTCVideoRotation_90 || rotation == RTCVideoRotation_270;
  CGRect view = sideways ? CGRectMake(0, 0, CGRectGetHeight(extent), CGRectGetWidth(extent))
                         : CGRectMake(0, 0, CGRectGetWidth(extent), CGRectGetHeight(extent));
  CGFloat scale = MAX(CGRectGetWidth(view) / CGRectGetWidth(image.extent),
                      CGRectGetHeight(view) / CGRectGetHeight(image.extent));
  CIImage *scaled = [image imageByApplyingTransform:CGAffineTransformMakeScale(scale, scale)];
  CGFloat x = CGRectGetMidX(scaled.extent) - CGRectGetMidX(view);
  CGFloat y = CGRectGetMidY(scaled.extent) - CGRectGetMidY(view);
  CIImage *fitted = [[scaled imageByApplyingTransform:CGAffineTransformMakeTranslation(-x, -y)]
      imageByCroppingToRect:view];

  // Core Image is y-up, so a positive angle turns counter-clockwise: the inverse
  // of WebRTC's clockwise display rotation.
  CIImage *turned = [fitted imageByApplyingTransform:CGAffineTransformMakeRotation((CGFloat)rotation * M_PI / 180.0)];
  turned = [turned imageByApplyingTransform:CGAffineTransformMakeTranslation(
                                                CGRectGetMinX(extent) - CGRectGetMinX(turned.extent),
                                                CGRectGetMinY(extent) - CGRectGetMinY(turned.extent))];
  return [turned imageByCroppingToRect:extent];
}

- (RTCVideoFrame *)capturer:(RTCVideoCapturer *)capturer
       didCaptureVideoFrame:(RTCVideoFrame *)frame {
  if (@available(iOS 11.0, *)) {
    NSProcessInfoThermalState thermalState = NSProcessInfo.processInfo.thermalState;
    if (thermalState == NSProcessInfoThermalStateSerious ||
        thermalState == NSProcessInfoThermalStateCritical) {
      return frame;
    }
  }
  __block NSString *mode;
  __block NSString *imagePath;
  __block double blurRadius;
  dispatch_sync(gConfigQueue, ^{
    mode = gMode;
    imagePath = gImagePath;
    blurRadius = gBlurRadius;
  });
  if ([mode isEqualToString:@"off"]) return frame;
  if (![frame.buffer isKindOfClass:[RTCCVPixelBuffer class]]) return frame;

  CVPixelBufferRef source = ((RTCCVPixelBuffer *)frame.buffer).pixelBuffer;
  NSError *visionError = nil;
  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCVPixelBuffer:source
                                                                           orientation:kCGImagePropertyOrientationUp
                                                                               options:@{}];
  if (![handler performRequests:@[ self.segmentationRequest ] error:&visionError] || visionError) {
    return frame;
  }
  VNPixelBufferObservation *observation =
      (VNPixelBufferObservation *)self.segmentationRequest.results.firstObject;
  if (!observation) return frame;

  CIImage *foreground = [CIImage imageWithCVPixelBuffer:source];
  CGRect extent = foreground.extent;
  CIImage *mask = [CIImage imageWithCVPixelBuffer:observation.pixelBuffer];
  CGFloat maskScaleX = CGRectGetWidth(extent) / CGRectGetWidth(mask.extent);
  CGFloat maskScaleY = CGRectGetHeight(extent) / CGRectGetHeight(mask.extent);
  mask = [[mask imageByApplyingTransform:CGAffineTransformMakeScale(maskScaleX, maskScaleY)]
      imageByCroppingToRect:extent];

  CIImage *background = nil;
  if ([mode isEqualToString:@"image"] && imagePath.length > 0) {
    background = [self backgroundImageForPath:imagePath extent:extent rotation:frame.rotation];
    // Do not silently blur when an image was requested but failed to load —
    // that looked like the custom upload never applied.
    if (!background) background = foreground;
  } else {
    CIFilter *blur = [CIFilter filterWithName:@"CIGaussianBlur"];
    [blur setValue:foreground forKey:kCIInputImageKey];
    [blur setValue:@(MAX(5.0, MIN(24.0, blurRadius))) forKey:kCIInputRadiusKey];
    background = [[blur outputImage] imageByCroppingToRect:extent];
  }

  CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
  [blend setValue:foreground forKey:kCIInputImageKey];
  [blend setValue:background forKey:kCIInputBackgroundImageKey];
  [blend setValue:mask forKey:kCIInputMaskImageKey];
  CIImage *outputImage = [blend.outputImage imageByCroppingToRect:extent];
  if (!outputImage) return frame;

  NSDictionary *attrs = @{
    (NSString *)kCVPixelBufferIOSurfacePropertiesKey : @{},
    (NSString *)kCVPixelBufferMetalCompatibilityKey : @YES,
  };
  CVPixelBufferRef output = nil;
  CVReturn result = CVPixelBufferCreate(kCFAllocatorDefault,
                                       CVPixelBufferGetWidth(source),
                                       CVPixelBufferGetHeight(source),
                                       kCVPixelFormatType_32BGRA,
                                       (__bridge CFDictionaryRef)attrs,
                                       &output);
  if (result != kCVReturnSuccess || output == nil) return frame;

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  [self.context render:outputImage toCVPixelBuffer:output bounds:extent colorSpace:colorSpace];
  CGColorSpaceRelease(colorSpace);
  RTCCVPixelBuffer *buffer = [[RTCCVPixelBuffer alloc] initWithPixelBuffer:output];
  RTCVideoFrame *processed = [[RTCVideoFrame alloc] initWithBuffer:buffer
                                                          rotation:frame.rotation
                                                       timeStampNs:frame.timeStampNs];
  CVPixelBufferRelease(output);
  return processed;
}

@end

@implementation MeetingVideoEffectsProcessor

+ (void)initialize {
  if (self == [MeetingVideoEffectsProcessor class]) {
    gConfigQueue = dispatch_queue_create("in.sheconomy.meeting-video-effects.config",
                                         DISPATCH_QUEUE_SERIAL);
  }
}

+ (void)registerProcessor {
  [ProcessorProvider addProcessor:[SHEVirtualBackgroundFrameProcessor new] forName:kProcessorName];
}

+ (void)configureMode:(NSString *)mode imagePath:(NSString *)imagePath blurRadius:(double)blurRadius {
  dispatch_async(gConfigQueue, ^{
    gMode = [mode copy] ?: @"off";
    gImagePath = [imagePath copy];
    gBlurRadius = blurRadius;
  });
}

+ (BOOL)isSupported {
  if (@available(iOS 15.0, *)) {
    if (NSProcessInfo.processInfo.physicalMemory < (2ULL * 1024ULL * 1024ULL * 1024ULL)) return NO;
    return NSProcessInfo.processInfo.thermalState < NSProcessInfoThermalStateSerious;
  }
  return NO;
}

@end
