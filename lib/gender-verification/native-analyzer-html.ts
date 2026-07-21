import { GENDER_VERIFICATION } from './constants'

/** Hidden WebView HTML: @vladmandic/human blink + antispoof + liveness + gender. */
export function getNativeAnalyzerHtml() {
  const modelBase = GENDER_VERIFICATION.humanModelBaseUrl

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
  var human = null;
  var ready = false;
  var queue = [];

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
        detector: { maxDetected: 1, minConfidence: 0.5, rotation: true, return: true },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: true },
    });
    await human.load();
    await human.warmup();
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

      var width = job.width || img.naturalWidth || img.width;
      var height = job.height || img.naturalHeight || img.height;
      var result = await human.detect(img);
      var face = result.face && result.face[0] ? result.face[0] : null;
      var gestures = (result.gesture || []).map(function (g) { return String(g.gesture); });
      var blinkLeft = gestures.indexOf('blink left eye') !== -1;
      var blinkRight = gestures.indexOf('blink right eye') !== -1;

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
          gestures: gestures,
        });
        return;
      }

      var box = face.box;
      var payloadFace = {
        box: {
          xMin: box[0],
          xMax: box[0] + box[2],
          yMin: box[1],
          yMax: box[1] + box[3],
        },
        leftEar: blinkLeft || blinkRight ? 0.12 : 0.3,
        rightEar: blinkLeft || blinkRight ? 0.12 : 0.3,
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
        eyesClosed: blinkLeft || blinkRight,
        liveScore: Number(face.live || 0),
        realScore: Number(face.real || 0),
        gestures: gestures,
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
