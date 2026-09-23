/**
 * Fix Android camera flip (front ↔ rear) never switching.
 *
 * CameraCaptureController.applyConstraints always used the *constructor*
 * facingMode/deviceId ("It is a constraint violation to change these…").
 * JS flip via applyConstraints({ facingMode }) therefore no-op'd while our
 * UI still toasted "Rear camera" — video stayed on the selfie camera.
 *
 * Honor facingMode / deviceId from the new constraints map, then persist them.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@livekit',
  'react-native-webrtc',
  'android',
  'src',
  'main',
  'java',
  'com',
  'oney',
  'WebRTCModule',
  'CameraCaptureController.java',
)

if (!fs.existsSync(target)) process.exit(0)

const MARKER = 'SHECONOMY_ALLOW_FACING_SWITCH'
let contents = fs.readFileSync(target, 'utf8')
if (contents.includes(MARKER)) process.exit(0)

// Make constructor fields mutable so we can persist switches.
contents = contents.replace(
  '    private final String constraintDeviceId;\n    private final String constraintFacingMode;',
  '    private String constraintDeviceId;\n    private String constraintFacingMode;',
)

const oldBlock = `        // Find target camera to switch to.
        String[] deviceNames = cameraEnumerator.getDeviceNames();

        // Use the initial deviceId/facingMode. It is a constraint violation to change these through applyConstraints.
        final String deviceId = constraintDeviceId;
        final String facingMode = constraintFacingMode;`

const newBlock = `        // Find target camera to switch to.
        String[] deviceNames = cameraEnumerator.getDeviceNames();

        // ${MARKER}: honor facingMode/deviceId from the new constraints so
        // MediaStreamTrack.applyConstraints / _switchCamera can flip cameras.
        String deviceId = ReactBridgeUtil.getMapStrValue(constraints, "deviceId");
        String facingMode = ReactBridgeUtil.getMapStrValue(constraints, "facingMode");
        if (deviceId == null || deviceId.isEmpty()) {
            deviceId = constraintDeviceId;
        }
        if (facingMode == null || facingMode.isEmpty()) {
            facingMode = constraintFacingMode;
        }
        final String resolvedDeviceId = deviceId;
        final String resolvedFacingMode = facingMode;`

if (!contents.includes(oldBlock)) {
  console.warn('[patch-webrtc-camera-facing-switch] applyConstraints block not found — skip')
  process.exit(0)
}

contents = contents.replace(oldBlock, newBlock)

// Update references from deviceId/facingMode locals that were previously final
// copies of constructor fields — keep using resolved* for the search below.
contents = contents.replace(
  `        if (deviceId != null) {
            try {
                cameraIndex = Integer.parseInt(deviceId);
                cameraName = deviceNames[cameraIndex];
            } catch (Exception e) {
                Log.d(TAG, "failed to find device with id: " + deviceId);
            }
        }

        // Otherwise, use facingMode (defaulting to front/user facing).
        if (cameraName == null) {
            cameraIndex = -1;
            final boolean isFrontFacing = facingMode == null || facingMode.equals("user");
            for (String name : deviceNames) {
                cameraIndex++;
                if (cameraEnumerator.isFrontFacing(name) == isFrontFacing) {
                    cameraName = name;
                    break;
                }
            }
        }

        if (cameraName == null) {
            if (onFinishedCallback != null) {
                onFinishedCallback.accept(new Exception("OverconstrainedError: could not find camera with deviceId: "
                        + deviceId + " or facingMode: " + facingMode));
            }
            return;
        }`,
  `        if (resolvedDeviceId != null) {
            try {
                cameraIndex = Integer.parseInt(resolvedDeviceId);
                cameraName = deviceNames[cameraIndex];
            } catch (Exception e) {
                Log.d(TAG, "failed to find device with id: " + resolvedDeviceId);
            }
        }

        // Otherwise, use facingMode (defaulting to front/user facing).
        if (cameraName == null) {
            cameraIndex = -1;
            final boolean wantFrontFacing = resolvedFacingMode == null || resolvedFacingMode.equals("user");
            for (String name : deviceNames) {
                cameraIndex++;
                if (cameraEnumerator.isFrontFacing(name) == wantFrontFacing) {
                    cameraName = name;
                    break;
                }
            }
        }

        if (cameraName == null) {
            if (onFinishedCallback != null) {
                onFinishedCallback.accept(new Exception("OverconstrainedError: could not find camera with deviceId: "
                        + resolvedDeviceId + " or facingMode: " + resolvedFacingMode));
            }
            return;
        }`,
)

// Persist facing/device after a successful apply so subsequent flips keep working.
const saveOld = `        Runnable saveConstraints = () -> {
            this.constraints = constraints;
            this.targetWidth = constraints.getInt("width");
            this.targetHeight = constraints.getInt("height");
            this.targetFps = constraints.getInt("frameRate");
        };`

const saveNew = `        Runnable saveConstraints = () -> {
            this.constraints = constraints;
            this.targetWidth = constraints.getInt("width");
            this.targetHeight = constraints.getInt("height");
            this.targetFps = constraints.getInt("frameRate");
            String nextDeviceId = ReactBridgeUtil.getMapStrValue(constraints, "deviceId");
            String nextFacing = ReactBridgeUtil.getMapStrValue(constraints, "facingMode");
            if (nextDeviceId != null && !nextDeviceId.isEmpty()) {
                this.constraintDeviceId = nextDeviceId;
            }
            if (nextFacing != null && !nextFacing.isEmpty()) {
                this.constraintFacingMode = nextFacing;
            }
        };`

if (!contents.includes(saveOld)) {
  console.warn('[patch-webrtc-camera-facing-switch] saveConstraints block not found — skip persist')
} else {
  contents = contents.replace(saveOld, saveNew)
}

fs.writeFileSync(target, contents)
console.log('[patch-webrtc-camera-facing-switch] Patched', target)
