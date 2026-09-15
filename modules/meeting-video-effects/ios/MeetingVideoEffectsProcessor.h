#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface MeetingVideoEffectsProcessor : NSObject
+ (void)registerProcessor;
+ (void)configureMode:(NSString *)mode imagePath:(nullable NSString *)imagePath blurRadius:(double)blurRadius;
+ (BOOL)isSupported;
@end

NS_ASSUME_NONNULL_END
