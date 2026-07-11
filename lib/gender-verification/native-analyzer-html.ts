import { GENDER_VERIFICATION } from './constants'

/** Inline HTML for a hidden WebView that runs face-api liveness + gender checks on camera frames. */
export function getNativeAnalyzerHtml() {
  const modelBase = GENDER_VERIFICATION.faceApiModelBaseUrl

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js"></script>
</head>
<body>
<script>
(function () {
  var modelBase = ${JSON.stringify(modelBase)};
  var ready = false;
  var queue = [];

  function post(payload) {
    var json = JSON.stringify(payload);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(json);
    }
  }

  function leftEar(landmarks) {
    var p = landmarks.positions;
    return eyeRatio(p[36], p[37], p[38], p[39], p[40], p[41]);
  }

  function rightEar(landmarks) {
    var p = landmarks.positions;
    return eyeRatio(p[42], p[43], p[44], p[45], p[46], p[47]);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function eyeRatio(p1, p2, p3, p4, p5, p6) {
    var vertical = dist(p2, p6) + dist(p3, p5);
    var horizontal = dist(p1, p4) * 2;
    if (horizontal <= 0) return 1;
    return vertical / horizontal;
  }

  async function ensureModels() {
    if (ready) return;
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelBase),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelBase),
      faceapi.nets.ageGenderNet.loadFromUri(modelBase),
    ]);
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

      var detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withAgeAndGender();

      if (!detection) {
        post({ type: 'result', id: job.id, face: null, gender: null, width: width, height: height });
        return;
      }

      var box = detection.detection.box;
      var face = {
        box: {
          xMin: box.x,
          xMax: box.x + box.width,
          yMin: box.y,
          yMax: box.y + box.height,
        },
        leftEar: leftEar(detection.landmarks),
        rightEar: rightEar(detection.landmarks),
      };

      var gender = null;
      if (job.mode === 'gender') {
        gender = {
          isFemale: detection.gender === 'female',
          confidence: Number(detection.genderProbability.toFixed(3)),
        };
      }

      post({ type: 'result', id: job.id, face: face, gender: gender, width: width, height: height });
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
