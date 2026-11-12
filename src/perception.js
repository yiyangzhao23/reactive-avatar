import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const state = {
  cam: { on: false, video: null, stream: null },
  screen: { on: false, video: null, stream: null },
  face: { detected: false, x: 0.5, y: 0.5, smile: 0, lastSeen: 0 },
};

export async function startCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  state.cam.video = videoEl;
  state.cam.stream = stream;
  videoEl.srcObject = stream;
  await videoEl.play();
  state.cam.on = true;
  stream.getVideoTracks()[0].addEventListener('ended', () => { state.cam.on = false; });
  return stream;
}

export function stopCamera() {
  state.cam.stream?.getTracks().forEach((t) => t.stop());
  if (state.cam.video) state.cam.video.srcObject = null;
  state.cam.on = false;
  state.cam.stream = null;
  state.face.detected = false;
  if (faceTimer) { clearInterval(faceTimer); faceTimer = null; }
}

export async function startScreenShare(videoEl) {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  state.screen.video = videoEl;
  state.screen.stream = stream;
  videoEl.srcObject = stream;
  await videoEl.play();
  state.screen.on = true;
  stream.getVideoTracks()[0].addEventListener('ended', () => { state.screen.on = false; });
}

export function stopScreenShare() {
  state.screen.stream?.getTracks().forEach((t) => t.stop());
  if (state.screen.video) state.screen.video.srcObject = null;
  state.screen.on = false;
  state.screen.stream = null;
}

const scratch = document.createElement('canvas');
function grabFrame(video, maxW, quality = 0.7) {
  if (!video || !video.videoWidth) return null;
  const scale = Math.min(1, maxW / video.videoWidth);
  scratch.width = Math.round(video.videoWidth * scale);
  scratch.height = Math.round(video.videoHeight * scale);
  scratch.getContext('2d').drawImage(video, 0, 0, scratch.width, scratch.height);
  return scratch.toDataURL('image/jpeg', quality).split(',')[1];
}

export const captureScreen = () => grabFrame(state.screen.video, 1280, 0.6);
export const captureCam = () => grabFrame(state.cam.video, 480, 0.6);

let landmarker = null;
let faceTimer = null;
export async function startFaceTracking(onUpdate) {
  if (faceTimer) return;
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
  } catch (e) {
    console.warn('MediaPipe 初始化失败，跳过人脸检测', e);
    return;
  }
  faceTimer = setInterval(() => {
    if (!landmarker || !state.cam.on || !state.cam.video?.videoWidth) return;
    const res = landmarker.detectForVideo(state.cam.video, performance.now());
    const f = state.face;
    if (res.faceLandmarks?.length) {
      const lm = res.faceLandmarks[0];
      f.detected = true;
      f.lastSeen = performance.now();
      // 用两眼中心估计人脸位置
      const l = lm[159], r = lm[386];
      f.x = ((l.x + r.x) / 2);
      f.y = ((l.y + r.y) / 2);
      const bs = Object.fromEntries(res.faceBlendshapes?.[0]?.categories.map((c) => [c.categoryName, c.score]) ?? []);
      f.smile = ((bs.mouthSmileLeft ?? 0) + (bs.mouthSmileRight ?? 0)) / 2;
      f.blink = ((bs.eyeBlinkLeft ?? 0) + (bs.eyeBlinkRight ?? 0)) / 2;
    } else {
      f.detected = false;
    }
    onUpdate?.(f);
  }, 200);
}
