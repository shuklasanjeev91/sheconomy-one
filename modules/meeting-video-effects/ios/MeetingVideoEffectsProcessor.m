#import "MeetingVideoEffectsProcessor.h"

#import <CoreImage/CoreImage.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <WebRTC/RTCCVPixelBuffer.h>
#import <WebRTC/RTCVideoFrame.h>
#import <react-native-webrtc/ProcessorProvider.h>
#import <react-native-webrtc/VideoFrameProcessor.h>
#import <stdatomic.h>

static NSString *const kProcessorName = @"sheconomyVirtualBackground";
static NSString *gMode = @"off";
static NSString *gImagePath = nil;
static double gBlurRadius = 12.0;
static NSString *gFilter = @"none";
static dispatch_queue_t gConfigQueue;

/**
 * Start a new segmentation at most every Nth frame (only when the previous pass is
 * done); frames in between reuse the last mask. A stale mask lets the real room
 * show where the person just moved away from, so keep it as fresh as possible.
 */
static const NSUInteger kSegmentEveryNFrames = 1;
/** A warm phone keeps the effect but segments less often instead of dropping it. */
static const NSUInteger kSegmentEveryNFramesWhenHot = 2;
/** Weight of the newest segmentation when blending with the previous one. */
static const CGFloat kNewMaskWeight = 0.8;

@interface SHEVirtualBackgroundFrameProcessor : NSObject <VideoFrameProcessorDelegate>
@property(nonatomic, strong) CIContext *context;
@property(nonatomic, strong) VNGeneratePersonSegmentationRequest *segmentationRequest;
@property(nonatomic, strong, nullable) CIImage *cachedBackground;
@property(nonatomic, copy, nullable) NSString *cachedBackgroundPath;
/** Segmentation queue only: last smoothed mask at segmentation resolution. */
@property(nonatomic, strong, nullable) CIImage *previousMask;
/** Full-frame person mask, written on the segmentation queue and read by every frame. */
@property(atomic, strong, nullable) CIImage *latestMask;
@end

@implementation SHEVirtualBackgroundFrameProcessor {
  dispatch_queue_t _segmentationQueue;
  atomic_bool _segmenting;
  CVPixelBufferPoolRef _outputPool;
  size_t _outputWidth;
  size_t _outputHeight;
  CVPixelBufferPoolRef _smallMaskPool;
  size_t _smallMaskWidth;
  size_t _smallMaskHeight;
  CVPixelBufferPoolRef _fullMaskPool;
  size_t _fullMaskWidth;
  size_t _fullMaskHeight;
  CGColorSpaceRef _colorSpace;
  NSUInteger _frameIndex;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    // Every frame is a new image, so cached intermediates only grow memory.
    _context = [CIContext contextWithOptions:@{
      kCIContextUseSoftwareRenderer : @NO,
      kCIContextCacheIntermediates : @NO,
    }];
    _segmentationRequest = [VNGeneratePersonSegmentationRequest new];
    // `Accurate` is meant for still photos. `Balanced` is fine for video because it
    // runs off the camera thread. `Fast` is too blobby: the room shows around the person.
    _segmentationRequest.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelBalanced;
    _segmentationRequest.outputPixelFormat = kCVPixelFormatType_OneComponent8;
    _segmentationQueue = dispatch_queue_create(
        "in.sheconomy.meeting-video-effects.segmentation",
        dispatch_queue_attr_make_with_qos_class(DISPATCH_QUEUE_SERIAL, QOS_CLASS_USER_INITIATED, 0));
    atomic_init(&_segmenting, false);
    _colorSpace = CGColorSpaceCreateDeviceRGB();
  }
  return self;
}

- (void)dealloc {
  if (_outputPool) CVPixelBufferPoolRelease(_outputPool);
  if (_smallMaskPool) CVPixelBufferPoolRelease(_smallMaskPool);
  if (_fullMaskPool) CVPixelBufferPoolRelease(_fullMaskPool);
  if (_colorSpace) CGColorSpaceRelease(_colorSpace);
}

/** Caller releases the returned buffer. Recreates the pool when the size changes. */
static CVPixelBufferRef SHENewPooledBuffer(CVPixelBufferPoolRef *pool,
                                           size_t *poolWidth,
                                           size_t *poolHeight,
                                           OSType format,
                                           size_t width,
                                           size_t height) {
  if (!*pool || *poolWidth != width || *poolHeight != height) {
    if (*pool) CVPixelBufferPoolRelease(*pool);
    *pool = NULL;
    NSDictionary *attrs = @{
      (NSString *)kCVPixelBufferPixelFormatTypeKey : @(format),
      (NSString *)kCVPixelBufferWidthKey : @(width),
      (NSString *)kCVPixelBufferHeightKey : @(height),
      (NSString *)kCVPixelBufferIOSurfacePropertiesKey : @{},
      (NSString *)kCVPixelBufferMetalCompatibilityKey : @YES,
    };
    CVPixelBufferPoolCreate(kCFAllocatorDefault, NULL, (__bridge CFDictionaryRef)attrs, pool);
    *poolWidth = width;
    *poolHeight = height;
  }
  if (!*pool) return NULL;
  CVPixelBufferRef buffer = NULL;
  CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, *pool, &buffer);
  return buffer;
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
    if (!self.cachedBackground) NSLog(@"[MeetingVideoEffects] Could not load background image at %@", path);
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

/**
 * Blend the new segmentation with the previous one to steady the edge, then render
 * the result into its own small buffer. Feeding the lazy CIImage back in instead
 * would chain every earlier frame into each new mask and grow without bound.
 */
- (CIImage *)smoothedMaskFromObservation:(VNPixelBufferObservation *)observation {
  CVPixelBufferRef raw = observation.pixelBuffer;
  CIImage *mask = [CIImage imageWithCVPixelBuffer:raw];
  CVPixelBufferRef settled = SHENewPooledBuffer(&_smallMaskPool, &_smallMaskWidth, &_smallMaskHeight,
                                                kCVPixelFormatType_OneComponent8,
                                                CVPixelBufferGetWidth(raw), CVPixelBufferGetHeight(raw));
  if (!settled) {
    self.previousMask = nil;
    return mask;
  }
  CIImage *target = mask;
  if (self.previousMask && CGRectEqualToRect(self.previousMask.extent, mask.extent)) {
    CIFilter *temporal = [CIFilter filterWithName:@"CIDissolveTransition"];
    [temporal setValue:self.previousMask forKey:kCIInputImageKey];
    [temporal setValue:mask forKey:kCIInputTargetImageKey];
    [temporal setValue:@(kNewMaskWeight) forKey:kCIInputTimeKey];
    target = [temporal.outputImage imageByCroppingToRect:mask.extent] ?: mask;
  }
  [self.context render:target toCVPixelBuffer:settled bounds:mask.extent colorSpace:nil];
  CIImage *materialized = [CIImage imageWithCVPixelBuffer:settled];
  CVPixelBufferRelease(settled);
  self.previousMask = materialized;
  return materialized;
}

/**
 * Turn the coarse segmentation into a full-frame matte, Zoom style:
 * 1. upsample guided by the camera image so the soft edge lines up with the person;
 * 2. cut the low-confidence halo (that band is where the real room leaked through)
 *    and make the body solid (a soft middle made faces look see-through);
 * 3. pull the edge in a little more, then feather it so it is not a sticker.
 */
- (CIImage *)refinedMask:(CIImage *)small guide:(CIImage *)guide {
  CGRect extent = guide.extent;

  CIImage *upsampled = nil;
  CIFilter *upsample = [CIFilter filterWithName:@"CIEdgePreserveUpsampleFilter"];
  if (upsample) {
    [upsample setValue:guide forKey:kCIInputImageKey];
    [upsample setValue:small forKey:@"inputSmallImage"];
    [upsample setValue:@0.08 forKey:@"inputLumaSigma"];
    upsampled = upsample.outputImage;
  }
  if (!upsampled) {
    CGFloat sx = CGRectGetWidth(extent) / CGRectGetWidth(small.extent);
    CGFloat sy = CGRectGetHeight(extent) / CGRectGetHeight(small.extent);
    upsampled = [small imageByApplyingTransform:CGAffineTransformMakeScale(sx, sy)];
  }
  upsampled = [upsampled imageByCroppingToRect:extent];

  // Remap [floorLevel, floorLevel + 1/gain] to [0, 1]: 0.45 and below is background.
  const CGFloat gain = 2.5;
  const CGFloat floorLevel = 0.45;
  CIFilter *levels = [CIFilter filterWithName:@"CIColorMatrix"];
  [levels setValue:upsampled forKey:kCIInputImageKey];
  [levels setValue:[CIVector vectorWithX:gain Y:0 Z:0 W:0] forKey:@"inputRVector"];
  [levels setValue:[CIVector vectorWithX:0 Y:gain Z:0 W:0] forKey:@"inputGVector"];
  [levels setValue:[CIVector vectorWithX:0 Y:0 Z:gain W:0] forKey:@"inputBVector"];
  [levels setValue:[CIVector vectorWithX:-gain * floorLevel Y:-gain * floorLevel Z:-gain * floorLevel W:0]
            forKey:@"inputBiasVector"];
  CIImage *solid = [levels.outputImage imageByApplyingFilter:@"CIColorClamp"] ?: upsampled;

  CIFilter *shrink = [CIFilter filterWithName:@"CIMorphologyMinimum"];
  [shrink setValue:[solid imageByClampingToExtent] forKey:kCIInputImageKey];
  [shrink setValue:@2.0 forKey:kCIInputRadiusKey];
  CIImage *tight = shrink.outputImage ?: solid;

  CIImage *feathered = [[tight imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:1.5];
  return [feathered imageByCroppingToRect:extent];
}

/** Runs on the segmentation queue. Returns a mask backed by its own full-size buffer. */
- (CIImage *)personMaskForBuffer:(CVPixelBufferRef)source {
  VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCVPixelBuffer:source
                                                                           orientation:kCGImagePropertyOrientationUp
                                                                               options:@{}];
  NSError *error = nil;
  if (![handler performRequests:@[ self.segmentationRequest ] error:&error] || error) return nil;
  VNPixelBufferObservation *observation =
      (VNPixelBufferObservation *)self.segmentationRequest.results.firstObject;
  if (!observation) return nil;

  CIImage *guide = [CIImage imageWithCVPixelBuffer:source];
  CIImage *mask = [self refinedMask:[self smoothedMaskFromObservation:observation] guide:guide];
  CVPixelBufferRef full = SHENewPooledBuffer(&_fullMaskPool, &_fullMaskWidth, &_fullMaskHeight,
                                             kCVPixelFormatType_OneComponent8,
                                             CVPixelBufferGetWidth(source), CVPixelBufferGetHeight(source));
  if (!full) return nil;
  [self.context render:mask toCVPixelBuffer:full bounds:guide.extent colorSpace:nil];
  CIImage *materialized = [CIImage imageWithCVPixelBuffer:full];
  CVPixelBufferRelease(full);
  return materialized;
}

/** Segmentation never runs on the camera thread, so a slow pass cannot freeze the video. */
- (void)scheduleSegmentation:(CVPixelBufferRef)source {
  bool idle = false;
  if (!atomic_compare_exchange_strong(&_segmenting, &idle, true)) return;
  CVPixelBufferRetain(source);
  dispatch_async(_segmentationQueue, ^{
    @autoreleasepool {
      CIImage *mask = [self personMaskForBuffer:source];
      if (mask) self.latestMask = mask;
    }
    CVPixelBufferRelease(source);
    atomic_store(&self->_segmenting, false);
  });
}

- (RTCVideoFrame *)capturer:(RTCVideoCapturer *)capturer
       didCaptureVideoFrame:(RTCVideoFrame *)frame {
  // A call alone pushes A12 phones to `Serious`; bailing out there made the
  // effect look broken. Only `Critical` (iOS is about to throttle hard) skips it.
  NSProcessInfoThermalState thermalState = NSProcessInfo.processInfo.thermalState;
  if (thermalState == NSProcessInfoThermalStateCritical) return frame;
  BOOL hot = thermalState == NSProcessInfoThermalStateSerious;

  __block NSString *mode;
  __block NSString *imagePath;
  __block double blurRadius;
  __block NSString *filter;
  dispatch_sync(gConfigQueue, ^{
    mode = gMode;
    imagePath = gImagePath;
    blurRadius = gBlurRadius;
    filter = gFilter;
  });
  BOOL filterOn = filter.length > 0 && ![filter isEqualToString:@"none"];
  if ([mode isEqualToString:@"off"] && !filterOn) {
    if (self.latestMask) {
      self.latestMask = nil;
      dispatch_async(_segmentationQueue, ^{
        self.previousMask = nil;
      });
    }
    return frame;
  }
  if ([mode isEqualToString:@"off"] && filterOn) {
    if (![frame.buffer isKindOfClass:[RTCCVPixelBuffer class]]) return frame;
    CVPixelBufferRef source = ((RTCCVPixelBuffer *)frame.buffer).pixelBuffer;
    CIImage *graded = [self applyLook:[CIImage imageWithCVPixelBuffer:source] filter:filter];
    RTCVideoFrame *filtered = [self frameFromImage:graded source:source original:frame];
    return filtered ?: frame;
  }
  if (![frame.buffer isKindOfClass:[RTCCVPixelBuffer class]]) return frame;
  CVPixelBufferRef source = ((RTCCVPixelBuffer *)frame.buffer).pixelBuffer;

  NSUInteger interval = hot ? kSegmentEveryNFramesWhenHot : kSegmentEveryNFrames;
  if ((_frameIndex++ % interval) == 0 || !self.latestMask) {
    [self scheduleSegmentation:source];
  }
  CIImage *mask = self.latestMask;
  if (!mask) return frame;

  RTCVideoFrame *result;
  @autoreleasepool {
    result = [self composeFrame:frame
                         source:source
                           mask:mask
                           mode:mode
                      imagePath:imagePath
                     blurRadius:blurRadius
                         filter:filter];
  }
  return result;
}

- (CIImage *)applyLook:(CIImage *)image filter:(NSString *)filter {
  if (filter.length == 0 || [filter isEqualToString:@"none"] || !image) return image;
  if ([filter isEqualToString:@"mono"]) {
    CIFilter *mono = [CIFilter filterWithName:@"CIPhotoEffectMono"];
    [mono setValue:image forKey:kCIInputImageKey];
    return mono.outputImage ?: image;
  }
  if ([filter isEqualToString:@"warm"] || [filter isEqualToString:@"cool"]) {
    CIFilter *matrix = [CIFilter filterWithName:@"CIColorMatrix"];
    [matrix setValue:image forKey:kCIInputImageKey];
    if ([filter isEqualToString:@"warm"]) {
      [matrix setValue:[CIVector vectorWithX:1.12 Y:0.06 Z:0.0 W:0] forKey:@"inputRVector"];
      [matrix setValue:[CIVector vectorWithX:0.02 Y:1.02 Z:0.0 W:0] forKey:@"inputGVector"];
      [matrix setValue:[CIVector vectorWithX:0.0 Y:0.0 Z:0.84 W:0] forKey:@"inputBVector"];
    } else {
      [matrix setValue:[CIVector vectorWithX:0.86 Y:0.0 Z:0.04 W:0] forKey:@"inputRVector"];
      [matrix setValue:[CIVector vectorWithX:0.0 Y:1.0 Z:0.02 W:0] forKey:@"inputGVector"];
      [matrix setValue:[CIVector vectorWithX:0.0 Y:0.04 Z:1.14 W:0] forKey:@"inputBVector"];
    }
    [matrix setValue:[CIVector vectorWithX:0 Y:0 Z:0 W:1] forKey:@"inputAVector"];
    [matrix setValue:[CIVector vectorWithX:0 Y:0 Z:0 W:0] forKey:@"inputBiasVector"];
    return matrix.outputImage ?: image;
  }
  CIFilter *controls = [CIFilter filterWithName:@"CIColorControls"];
  [controls setValue:image forKey:kCIInputImageKey];
  if ([filter isEqualToString:@"vivid"]) {
    [controls setValue:@(1.45) forKey:kCIInputSaturationKey];
    [controls setValue:@(1.08) forKey:kCIInputContrastKey];
    [controls setValue:@(0) forKey:kCIInputBrightnessKey];
  } else {
    [controls setValue:@(0.92) forKey:kCIInputSaturationKey];
    [controls setValue:@(0.94) forKey:kCIInputContrastKey];
    [controls setValue:@(0.06) forKey:kCIInputBrightnessKey];
  }
  return controls.outputImage ?: image;
}

- (RTCVideoFrame *)frameFromImage:(CIImage *)image
                           source:(CVPixelBufferRef)source
                         original:(RTCVideoFrame *)frame {
  if (!image) return nil;
  CGRect extent = image.extent;
  CVPixelBufferRef output = SHENewPooledBuffer(&_outputPool, &_outputWidth, &_outputHeight,
                                               kCVPixelFormatType_32BGRA,
                                               CVPixelBufferGetWidth(source), CVPixelBufferGetHeight(source));
  if (!output) return nil;
  [self.context render:image toCVPixelBuffer:output bounds:extent colorSpace:_colorSpace];
  RTCCVPixelBuffer *buffer = [[RTCCVPixelBuffer alloc] initWithPixelBuffer:output];
  RTCVideoFrame *processed = [[RTCVideoFrame alloc] initWithBuffer:buffer
                                                          rotation:frame.rotation
                                                       timeStampNs:frame.timeStampNs];
  CVPixelBufferRelease(output);
  return processed;
}

- (RTCVideoFrame *)composeFrame:(RTCVideoFrame *)frame
                         source:(CVPixelBufferRef)source
                           mask:(CIImage *)mask
                           mode:(NSString *)mode
                      imagePath:(NSString *)imagePath
                     blurRadius:(double)blurRadius
                         filter:(NSString *)filter {
  CIImage *foreground = [CIImage imageWithCVPixelBuffer:source];
  CGRect extent = foreground.extent;
  if (!CGRectEqualToRect(mask.extent, extent)) {
    CGFloat sx = CGRectGetWidth(extent) / CGRectGetWidth(mask.extent);
    CGFloat sy = CGRectGetHeight(extent) / CGRectGetHeight(mask.extent);
    mask = [[mask imageByApplyingTransform:CGAffineTransformMakeScale(sx, sy)] imageByCroppingToRect:extent];
  }

  CIImage *background = nil;
  if ([mode isEqualToString:@"image"] && imagePath.length > 0) {
    background = [self backgroundImageForPath:imagePath extent:extent rotation:frame.rotation];
    // Do not silently blur when an image was requested but failed to load —
    // that looked like the custom upload never applied.
    if (!background) background = foreground;
  } else {
    // Clamp first so the blur does not pull dark transparent pixels in from the frame edge.
    CGFloat sigma = (CGFloat)MAX(5.0, MIN(24.0, blurRadius));
    background = [[[foreground imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:sigma]
        imageByCroppingToRect:extent];
  }

  CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
  [blend setValue:foreground forKey:kCIInputImageKey];
  [blend setValue:background forKey:kCIInputBackgroundImageKey];
  [blend setValue:mask forKey:kCIInputMaskImageKey];
  CIImage *outputImage = [[blend.outputImage imageByCroppingToRect:extent] imageByCroppingToRect:extent];
  outputImage = [[self applyLook:outputImage filter:filter] imageByCroppingToRect:extent];
  if (!outputImage) return frame;
  return [self frameFromImage:outputImage source:source original:frame] ?: frame;
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

+ (void)configureMode:(NSString *)mode
             imagePath:(NSString *)imagePath
            blurRadius:(double)blurRadius
                filter:(NSString *)filter {
  dispatch_async(gConfigQueue, ^{
    gMode = [mode copy] ?: @"off";
    gImagePath = [imagePath copy];
    gBlurRadius = blurRadius;
    gFilter = [filter copy] ?: @"none";
  });
}

+ (BOOL)isSupported {
  if (@available(iOS 15.0, *)) {
    if (NSProcessInfo.processInfo.physicalMemory < (2ULL * 1024ULL * 1024ULL * 1024ULL)) return NO;
    return NSProcessInfo.processInfo.thermalState < NSProcessInfoThermalStateCritical;
  }
  return NO;
}

@end
