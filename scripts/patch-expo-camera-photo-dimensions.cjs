/**
 * Prevent SIGABRT when expo-camera takePicture runs before AVCapturePhotoOutput
 * has valid maxPhotoDimensions (common right after the iOS permission sheet).
 *
 * Root cause: CameraPhotoCapture always assigns photoOutput.maxPhotoDimensions,
 * which can still be (0,0) immediately after onCameraReady → ObjC exception → abort.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-camera',
  'ios',
  'Current',
  'CameraPhotoCapture.swift',
)

if (!fs.existsSync(target)) {
  console.warn('[patch-expo-camera-photo-dimensions] skip: file missing')
  process.exit(0)
}

let source = fs.readFileSync(target, 'utf8')

if (source.includes('sheconomy-guard-maxPhotoDimensions')) {
  console.log('[patch-expo-camera-photo-dimensions] already applied')
  process.exit(0)
}

const oldBlock = `      if #available(iOS 16.0, *) {
        photoSettings.maxPhotoDimensions = photoOutput.maxPhotoDimensions
      }

      if !photoSettings.availablePreviewPhotoPixelFormatTypes.isEmpty,
      let previewFormat = photoSettings.__availablePreviewPhotoPixelFormatTypes.first {
        photoSettings.previewPhotoFormat = [kCVPixelBufferPixelFormatTypeKey as String: previewFormat]
      }

      if photoOutput.isHighResolutionCaptureEnabled {
        photoSettings.isHighResolutionPhotoEnabled = true
      }

      photoSettings.photoQualityPrioritization = .balanced

      photoOutput.capturePhoto(with: photoSettings, delegate: self)`

const newBlock = `      // sheconomy-guard-maxPhotoDimensions: (0,0) crashes capturePhoto on fresh grant.
      if #available(iOS 16.0, *) {
        let dims = photoOutput.maxPhotoDimensions
        if dims.width > 0 && dims.height > 0 {
          photoSettings.maxPhotoDimensions = dims
        }
      }

      if !photoSettings.availablePreviewPhotoPixelFormatTypes.isEmpty,
      let previewFormat = photoSettings.__availablePreviewPhotoPixelFormatTypes.first {
        photoSettings.previewPhotoFormat = [kCVPixelBufferPixelFormatTypeKey as String: previewFormat]
      }

      if photoOutput.isHighResolutionCaptureEnabled {
        photoSettings.isHighResolutionPhotoEnabled = true
      }

      photoSettings.photoQualityPrioritization = .balanced

      // Session / photo output still warming up after permission → throw instead of abort.
      guard photoOutput.connection(with: .video) != nil else {
        continuation.resume(throwing: CameraNotReadyException())
        self.photoCapturedContinuation = nil
        self.photoCaptureOptions = nil
        return
      }

      photoOutput.capturePhoto(with: photoSettings, delegate: self)`

if (!source.includes(oldBlock)) {
  console.warn('[patch-expo-camera-photo-dimensions] skip: unexpected source shape')
  process.exit(0)
}

source = source.replace(oldBlock, newBlock)
fs.writeFileSync(target, source)
console.log('[patch-expo-camera-photo-dimensions] applied')
