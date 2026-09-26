#import "MeetingVideoEffectsProcessor.h"

#import <CoreImage/CoreImage.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <WebRTC/RTCCVPixelBuffer.h>
#import <WebRTC/RTCVideoFrame.h>
#import <livekit-react-native-webrtc/ProcessorProvider.h>
#import <livekit-react-native-webrtc/VideoFrameProcessor.h>

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

- (CIImage *)imageFromPath:(NSString *)path {
  if (path.length == 0) return nil;
  NSString *filePath = path;
  if ([path hasPrefix:@"file://"]) {
    filePath = [NSURL URLWithString:path].path ?: [path substringFromIndex:7];
  }
  if (![path hasPrefix:@"http://"] && ![path hasPrefix:@"https://"]) {
    UIImage *uiImage = [UIImage imageWithContentsOfFile:filePath];
    if (uiImage.CGImage) return [CIImage imageWithCGImage:uiImage.CGImage];
    return [CIImage imageWithContentsOfURL:[NSURL fileURLWithPath:filePath]];
  }
  NSURL *url = [NSURL URLWithString:path];
  return url ? [CIImage imageWithContentsOfURL:url] : nil;
}

- (CIImage *)backgroundImageForPath:(NSString *)path extent:(CGRect)extent {
  if (![self.cachedBackgroundPath isEqualToString:path]) {
    self.cachedBackground = [self imageFromPath:path];
    self.cachedBackgroundPath = path;
  }
  CIImage *image = self.cachedBackground;
  if (!image || CGRectIsEmpty(image.extent)) return nil;
  CGFloat scale = MAX(CGRectGetWidth(extent) / CGRectGetWidth(image.extent),
                      CGRectGetHeight(extent) / CGRectGetHeight(image.extent));
  CIImage *scaled = [image imageByApplyingTransform:CGAffineTransformMakeScale(scale, scale)];
  CGFloat x = CGRectGetMidX(scaled.extent) - CGRectGetMidX(extent);
  CGFloat y = CGRectGetMidY(scaled.extent) - CGRectGetMidY(extent);
  return [[scaled imageByApplyingTransform:CGAffineTransformMakeTranslation(-x, -y)]
      imageByCroppingToRect:extent];
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
    background = [self backgroundImageForPath:imagePath extent:extent];
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
