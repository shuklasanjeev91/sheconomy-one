#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface MeetingVideoEffectsProcessor : NSObject
+ (void)registerProcessor;
+ (void)configureMode:(NSString *)mode
             imagePath:(nullable NSString *)imagePath
            blurRadius:(double)blurRadius
                filter:(nullable NSString *)filter;
+ (BOOL)isSupported;
@end

NS_ASSUME_NONNULL_END
