import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'
import { FACE_QUALITY } from '~/lib/gender-verification/face-quality'
import { GLASSES_MESH_POINTS, QUALITY_PATCH_SIZE } from '~/lib/gender-verification/face-quality-pixels'

/** Hidden WebView HTML: @vladmandic/human mesh EAR + antispoof + liveness + gender. */
export function getNativeAnalyzerHtml() {
  const modelBase = GENDER_VERIFICATION.humanModelBaseUrl
  const maxSide = GENDER_VERIFICATION.nativeDetectMaxSide
  const earBlink = GENDER_VERIFICATION.earBlinkThreshold
  const quality = {
    extraFaceMinRatio: FACE_QUALITY.extraFaceMinRatio,
    mesh: GLASSES_MESH_POINTS,
    patch: QUALITY_PATCH_SIZE,
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js"></script>
</head>
<body>
<script>
(function () {
  var modelBase = ${JSON.stringify(modelBase)};
  var DETECT_MAX_SIDE = ${maxSide};
  var EAR_BLINK = ${earBlink};
  var LEFT_EYE = [33, 160, 158, 133, 153, 144];
  var RIGHT_EYE = [362, 385, 387, 263, 373, 380];
  var human = null;
  var ready = false;
  var queue = [];
  var canvas = null;
  var genderCanvas = null;
  var patchCanvas = null;
  var QUALITY = ${JSON.stringify(quality)};

  function post(payload) {
    var json = JSON.stringify(payload);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(json);
    }
  }

  function HumanCtor() {
    var H = window.Human;
    if (!H) return null;
    if (typeof H === 'function') return H;
    if (H.Human && typeof H.Human === 'function') return H.Human;
    if (H.default && typeof H.default === 'function') return H.default;
    return null;
  }

  function asPoint(p) {
    if (!p) return null;
    if (Array.isArray(p) && p.length >= 2) return { x: p[0], y: p[1] };
    if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    return null;
  }

  function earFromIndices(mesh, indices) {
    if (!mesh || mesh.length < 400) return null;
    var pts = [];
    for (var i = 0; i < indices.length; i++) {
      var pt = asPoint(mesh[indices[i]]);
      if (!pt) return null;
      pts.push(pt);
    }
    var v =
      Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y) +
      Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
    var h = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y) * 2;
    if (h <= 0) return 0.3;
    return v / h;
  }

  function earsFromFace(face) {
    var left = earFromIndices(face.mesh, LEFT_EYE);
    var right = earFromIndices(face.mesh, RIGHT_EYE);
    if (left != null && right != null) return { leftEar: left, rightEar: right };
    return { leftEar: 0.3, rightEar: 0.3 };
  }

  function applyMode(mode) {
    if (!human || !human.config || !human.config.face) return;
    var wantDescription = mode === 'description';
    var wantLiveness = mode === 'liveness';
    human.config.face.description.enabled = wantDescription;
    human.config.face.antispoof.enabled = wantLiveness;
    human.config.face.liveness.enabled = wantLiveness;
    human.config.face.mesh.enabled = true;
    human.config.face.iris.enabled = false;
    human.config.face.emotion.enabled = false;
  }

  function downscale(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var maxSide = Math.max(w, h);
    if (maxSide <= DETECT_MAX_SIDE || w <= 0 || h <= 0) {
      return { input: img, width: w, height: h };
    }
    var scale = DETECT_MAX_SIDE / maxSide;
    var dw = Math.max(1, Math.round(w * scale));
    var dh = Math.max(1, Math.round(h * scale));
    if (!canvas) canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    var ctx = canvas.getContext('2d');
    if (!ctx) return { input: img, width: w, height: h };
    ctx.drawImage(img, 0, 0, dw, dh);
    return { input: canvas, width: dw, height: dh };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // Port of lib/gender-verification/face-quality-pixels.ts — keep in sync.
  function lumaPatch(source, x, y, w, h, size) {
    if (!patchCanvas) patchCanvas = document.createElement('canvas');
    patchCanvas.width = size;
    patchCanvas.height = size;
    var ctx = patchCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, x, y, Math.max(1, w), Math.max(1, h), 0, 0, size, size);
    var data = ctx.getImageData(0, 0, size, size).data;
    var luma = new Float32Array(size * size);
    for (var i = 0; i < size * size; i++) {
      luma[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    return luma;
  }

  function meanOf(values) {
    if (!values || !values.length) return 0;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  function horizontalEdgeCoverage(luma, size) {
    var threshold = Math.max(10, meanOf(luma) * 0.12);
    var best = 0;
    for (var row = 0; row < size - 2; row++) {
      var hits = 0;
      for (var col = 0; col < size; col++) {
        if (Math.abs(luma[row * size + col] - luma[(row + 2) * size + col]) > threshold) hits++;
      }
      best = Math.max(best, hits / size);
    }
    return best;
  }

  function toDegrees(radians) {
    return typeof radians === 'number' && isFinite(radians)
      ? Math.round((radians * 180) / Math.PI)
      : null;
  }

  function largestFace(faces) {
    var best = null;
    for (var i = 0; i < (faces || []).length; i++) {
      if (!best || faces[i].box[2] > best.box[2]) best = faces[i];
    }
    return best;
  }

  function measureQuality(input, width, height, faces, primary) {
    var box = primary.box;
    var faceLuma = lumaPatch(input, box[0], box[1], box[2], box[3], QUALITY.patch.luma);
    var frameLuma = lumaPatch(input, 0, 0, width, height, QUALITY.patch.luma);

    var glassesScore = null;
    var mesh = primary.mesh;
    if (mesh && mesh.length > QUALITY.mesh.innerRight) {
      var li = asPoint(mesh[QUALITY.mesh.innerLeft]);
      var ri = asPoint(mesh[QUALITY.mesh.innerRight]);
      var top = asPoint(mesh[QUALITY.mesh.bridgeTop]);
      if (li && ri && top) {
        var span = Math.abs(ri.x - li.x);
        var bridge = lumaPatch(
          input,
          Math.min(li.x, ri.x) + span * 0.25,
          top.y - span * 0.15,
          span * 0.5,
          span * 0.6,
          QUALITY.patch.bridge
        );
        if (bridge) glassesScore = horizontalEdgeCoverage(bridge, QUALITY.patch.bridge);
      }
    }

    var faceCount = 0;
    for (var i = 0; i < faces.length; i++) {
      if (faces[i].box[2] >= box[2] * QUALITY.extraFaceMinRatio) faceCount++;
    }
    var angle = primary.rotation && primary.rotation.angle ? primary.rotation.angle : null;
    return {
      faceCount: faceCount,
      faceLuma: faceLuma ? Math.round(meanOf(faceLuma)) : null,
      frameLuma: frameLuma ? Math.round(meanOf(frameLuma)) : null,
      yawDeg: angle ? toDegrees(angle.yaw) : null,
      pitchDeg: angle ? toDegrees(angle.pitch) : null,
      glassesScore: glassesScore,
    };
  }

  async function detectGenderFromFace(img, face, preparedWidth, preparedHeight) {
    if (!face || !face.box || preparedWidth <= 0 || preparedHeight <= 0) return null;
    var sourceWidth = img.naturalWidth || img.width;
    var sourceHeight = img.naturalHeight || img.height;
    if (sourceWidth <= 0 || sourceHeight <= 0) return null;

    var sx = sourceWidth / preparedWidth;
    var sy = sourceHeight / preparedHeight;
    var x = face.box[0] * sx;
    var y = face.box[1] * sy;
    var w = face.box[2] * sx;
    var h = face.box[3] * sy;
    var facePixels = Math.round(w);
    var padX = w * 0.35;
    var padY = h * 0.35;
    var cropX = clamp(x - padX, 0, sourceWidth);
    var cropY = clamp(y - padY, 0, sourceHeight);
    var cropRight = clamp(x + w + padX, 0, sourceWidth);
    var cropBottom = clamp(y + h + padY, 0, sourceHeight);
    var cropWidth = cropRight - cropX;
    var cropHeight = cropBottom - cropY;
    if (cropWidth <= 0 || cropHeight <= 0) return null;

    if (!genderCanvas) genderCanvas = document.createElement('canvas');
    genderCanvas.width = 256;
    genderCanvas.height = 256;
    var ctx = genderCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, 256, 256);

    applyMode('description');
    var result = await human.detect(genderCanvas);
    var genderFace = largestFace(result.face);
    if (!genderFace || !genderFace.gender || typeof genderFace.genderScore !== 'number') {
      return null;
    }
    var estimate = {
      isFemale: genderFace.gender === 'female',
      confidence: Number(genderFace.genderScore.toFixed(3)),
      facePixels: facePixels,
    };
    if (typeof genderFace.age === 'number') estimate.age = Math.round(genderFace.age);
    return estimate;
  }

  async function ensureModels() {
    if (ready && human) return;
    var Ctor = HumanCtor();
    if (!Ctor) throw new Error('Human library failed to load');
    human = new Ctor({
      backend: 'webgl',
      modelBasePath: modelBase,
      cacheSensitivity: 0,
      warmup: 'none',
      face: {
        enabled: true,
        // More than one so a second person in view can be flagged.
        detector: { maxDetected: 3, minConfidence: 0.45, rotation: false, return: true },
        mesh: { enabled: true },
        iris: { enabled: false },
        // Load description once; applyMode toggles it off during liveness frames.
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    });
    await human.load();
    applyMode('liveness');
    ready = true;
    post({ type: 'ready' });
    while (queue.length) {
      var job = queue.shift();
      void runAnalyze(job);
    }
  }

  async function runAnalyze(job) {
    try {
      if (!ready) {
        queue.push(job);
        await ensureModels();
        return;
      }

      var img = new Image();
      img.src = 'data:image/jpeg;base64,' + job.base64;
      await new Promise(function (resolve, reject) {
        img.onload = resolve;
        img.onerror = reject;
      });

      var wantGender = job.mode === 'gender' || job.mode === 'both';
      applyMode(job.mode === 'gender' ? 'location' : 'liveness');
      var prepared = downscale(img);
      var result = await human.detect(prepared.input);
      var faces = result.face || [];
      var face = largestFace(faces);
      var width = prepared.width;
      var height = prepared.height;

      if (!face) {
        post({
          type: 'result',
          id: job.id,
          face: null,
          gender: null,
          width: width,
          height: height,
          eyesClosed: false,
          liveScore: 0,
          realScore: 0,
          gestures: [],
          quality: null,
        });
        return;
      }
      var quality = measureQuality(prepared.input, width, height, faces, face);

      var ears = earsFromFace(face);
      var avgEar = (ears.leftEar + ears.rightEar) / 2;
      var eyesClosed = avgEar < EAR_BLINK;
      var box = face.box;
      var payloadFace = {
        box: {
          xMin: box[0],
          xMax: box[0] + box[2],
          yMin: box[1],
          yMax: box[1] + box[3],
        },
        leftEar: ears.leftEar,
        rightEar: ears.rightEar,
      };

      var gender = wantGender
        ? await detectGenderFromFace(img, face, prepared.width, prepared.height)
        : null;

      post({
        type: 'result',
        id: job.id,
        face: payloadFace,
        gender: gender,
        width: width,
        height: height,
        eyesClosed: eyesClosed,
        liveScore: Number(face.live || 0),
        realScore: Number(face.real || 0),
        gestures: [],
        quality: quality,
      });
    } catch (error) {
      post({
        type: 'error',
        id: job.id,
        message: error && error.message ? error.message : 'Analysis failed',
      });
    }
  }

  function onMessage(event) {
    try {
      var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data || data.type !== 'analyze') return;
      void runAnalyze(data);
    } catch (error) {
      post({ type: 'error', message: 'Invalid analyzer message' });
    }
  }

  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);

  void ensureModels().catch(function (error) {
    post({ type: 'error', message: error && error.message ? error.message : 'Model load failed' });
  });
})();
</script>
</body>
</html>`
}
