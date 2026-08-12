import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'

/** Hidden WebView HTML: @vladmandic/human mesh EAR + antispoof + liveness + gender. */
export function getNativeAnalyzerHtml() {
  const modelBase = GENDER_VERIFICATION.humanModelBaseUrl
  const maxSide = GENDER_VERIFICATION.nativeDetectMaxSide
  const earBlink = GENDER_VERIFICATION.earBlinkThreshold

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
    // 'both' keeps the anti-spoof samples flowing while we also collect gender,
    // so periodic gender frames do not create gaps in the liveness averages.
    var wantGender = mode === 'gender' || mode === 'both';
    var wantLiveness = mode !== 'gender';
    human.config.face.description.enabled = wantGender;
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
        detector: { maxDetected: 1, minConfidence: 0.45, rotation: false, return: true },
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

      applyMode(job.mode || 'liveness');
      var prepared = downscale(img);
      var result = await human.detect(prepared.input);
      var face = result.face && result.face[0] ? result.face[0] : null;
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
        });
        return;
      }

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

      var gender = null;
      if (face.gender && typeof face.genderScore === 'number') {
        gender = {
          isFemale: face.gender === 'female',
          confidence: Number(face.genderScore.toFixed(3)),
        };
      }

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
