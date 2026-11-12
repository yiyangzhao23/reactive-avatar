import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const EMOTION_KEYS = ['happy', 'angry', 'sad', 'surprised', 'relaxed'];

export async function createAvatar(scene) {
  try {
    const vrm = await loadVRM();
    console.info('已加载 model.vrm');
    return new VRMAvatar(scene, vrm);
  } catch (e) {
    console.warn('加载 model.vrm 失败，使用占位角色', e);
    return new PlaceholderAvatar(scene);
  }
}

function loadVRM() {
  return new Promise((resolve, reject) => {
    fetch('./model.vrm', { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) return reject(new Error('model.vrm 不存在'));
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        loader.load('./model.vrm', (gltf) => {
          const vrm = gltf.userData.vrm;
          if (!vrm) return reject(new Error('不是有效的 VRM'));
          vrm.scene.traverse((o) => { o.frustumCulled = false; });
          // VRM 0.x 模型默认背对镜头，转 180°（VRM 1.0 会自动跳过）
          VRMUtils.rotateVRM0(vrm);
          resolve(vrm);
        }, undefined, reject);
      })
      .catch(reject);
  });
}

// 统一接口: setEmotion(name), setGaze(x, y), setTalking(bool), update(dt, t), frame
class VRMAvatar {
  constructor(scene, vrm) {
    this.vrm = vrm;
    scene.add(vrm.scene);
    vrm.scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = box.getSize(new THREE.Vector3());
    this.baseYaw = vrm.scene.rotation.y;
    this.basePos = vrm.scene.position.clone();
    this.frame = {
      height: size.y || 1.5,
      top: box.max.y || 1.5,
      bottom: box.min.y || 0,
      centerX: (box.min.x + box.max.x) / 2,
      centerY: (box.max.y || 1.4) * 0.82,
    };

    this.target = { emotion: 'relaxed', weight: 0 };
    this.weights = Object.fromEntries(EMOTION_KEYS.map((k) => [k, 0]));
    this.gaze = new THREE.Vector2(0, 0);
    this.talking = false;
    this.headBias = new THREE.Vector2(0, 0);
    this.headBiasTarget = new THREE.Vector2(0, 0);
    this.turnVel = 0;
    this.turnVelTarget = 0;
    this.interacting = false;
    this.gestureFactor = 1;
    this.nextBlink = 2 + Math.random() * 3;
    this.blinkT = 0;
    this.lookObj = new THREE.Object3D();
    this.lookObj.position.set(0, this.frame.centerY, 1);
    scene.add(this.lookObj);
    if (vrm.lookAt) vrm.lookAt.target = this.lookObj;

    this.bones = {};
    for (const n of ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'rightHand']) {
      this.bones[n] = vrm.humanoid?.getNormalizedBoneNode(n) ?? null;
    }
    this.gesture = null;
    this.time = 0;
    this.nextGesture = 12 + Math.random() * 8;
    this.gesturePool = ['hips'];
    this.applyIdlePose();
  }

  setBone(name, x, y, z) {
    const b = this.bones[name];
    if (b) b.rotation.set(x, y, z);
  }

  applyIdlePose() {
    if (!this.vrm.humanoid) return;
    // 放下 T-pose 的手臂，自然垂在身体两侧
    this.setBone('leftUpperArm', 0.05, 0, 1.33);
    this.setBone('rightUpperArm', 0.05, 0, -1.33);
    this.setBone('leftLowerArm', 0, -0.08, 0);
    this.setBone('rightLowerArm', 0, 0.08, 0);
  }

  wave() {
    this.playGesture('wave');
  }

  playGesture(name) {
    if (!name || name === 'none') return;
    const durations = {
      wave: 2.8,
      nod: 1.6,
      shake: 1.6,
      bow: 2.4,
      cheer: 2.4,
      point: 2.2,
      think: 2.8,
      lean: 2.6,
      hips: 3.0,
    };
    this.gesture = { type: name, start: this.time, dur: durations[name] || 2.4 };
    this.nextGesture = this.time + this.gesture.dur + 6;
  }

  updateIdle(t, dt = 0.016) {
    this.time = t;
    this.headBias.lerp(this.headBiasTarget, Math.min(1, dt * 8));
    this.turnVel += (this.turnVelTarget - this.turnVel) * Math.min(1, dt * 6);
    const lean = Math.max(-0.12, Math.min(0.12, this.turnVel * 0.06));
    this.gestureFactor += ((this.interacting ? 0 : 1) - this.gestureFactor) * Math.min(1, dt * 12);
    const armSway = Math.sin(t * 1.1) * 0.03;

    if (!this.interacting && !this.gesture && t > this.nextGesture) {
      const type = this.gesturePool[Math.floor(Math.random() * this.gesturePool.length)];
      this.gesture = { type, start: t, dur: type === 'wave' ? 2.8 : type === 'hips' ? 3.0 : 2.6 };
    }
    let gw = 0;
    if (this.gesture) {
      const p = (t - this.gesture.start) / this.gesture.dur;
      if (p >= 1) {
        this.gesture = null;
        this.nextGesture = t + 12 + Math.random() * 12;
      } else {
        gw = Math.sin(Math.PI * p);
      }
    }

    const breathe = Math.sin(t * 1.6) * 0.018;
    let spineX = 0;
    let chestX = breathe;
    let leanShift = 0;
    let neckX = 0;
    let llY = -0.08;
    let llZ = 0;
    let luZ = 1.33 + armSway;
    let ruZ = -1.33 - armSway;
    let ruX = 0.05;
    let rlY = 0.08;
    let rlZ = 0;
    let headX = Math.sin(t * 1.3) * 0.02 - this.headBias.y * 0.3;
    let headY = Math.sin(t * 0.45) * 0.04 + this.headBias.x * 0.5 + lean * 1.4;
    let headZ = 0;
    let rhX = 0;

    const eff = gw * this.gestureFactor;
    if (eff > 0.001 && this.gesture) {
      const gt = t - this.gesture.start;
      if (this.gesture.type === 'wave') {
        ruZ += 1.7 * eff + 0.05 * Math.sin(gt * 7) * eff;
        ruX -= 0.18 * eff;
        rlZ += 1.35 * eff + 0.22 * Math.sin(gt * 8) * eff;
        rhX = 1.5 * eff + 0.12 * Math.sin(gt * 8) * eff;
        headZ -= 0.05 * eff;
        headY += 0.06 * eff;
      } else if (this.gesture.type === 'lean') {
        spineX -= 0.26 * eff;
        chestX -= 0.28 * eff;
        neckX -= 0.2 * eff;
        headX += 0.42 * eff;
        headZ += 0.02 * eff;
        leanShift = 0.26 * eff;
      } else if (this.gesture.type === 'hips') {
        luZ += (1.12 - luZ) * eff;
        ruZ += (-1.12 - ruZ) * eff;
        llY += (-0.5 - llY) * eff;
        rlY += (0.5 - rlY) * eff;
        llZ += 0.5 * eff;
        rlZ += -0.5 * eff;
      } else if (this.gesture.type === 'nod') {
        const s = Math.sin(gt * 9);
        headX += 0.2 * eff * s;
        neckX += 0.08 * eff * s;
      } else if (this.gesture.type === 'shake') {
        headY += 0.24 * eff * Math.sin(gt * 11);
        headZ += 0.02 * eff * Math.sin(gt * 11);
      } else if (this.gesture.type === 'bow') {
        spineX -= 0.42 * eff;
        chestX -= 0.34 * eff;
        neckX -= 0.16 * eff;
        headX += 0.26 * eff;
        leanShift = 0.12 * eff;
      } else if (this.gesture.type === 'cheer') {
        luZ -= 2.65 * eff;
        ruZ += 2.65 * eff;
        llZ -= 0.45 * eff;
        rlZ += 0.45 * eff;
        headX -= 0.08 * eff;
        headZ += 0.04 * eff * Math.sin(gt * 8);
      } else if (this.gesture.type === 'point') {
        ruZ += 1.45 * eff;
        ruX -= 0.45 * eff;
        rlZ += 0.35 * eff;
        headY += 0.12 * eff;
      } else if (this.gesture.type === 'think') {
        ruZ += 1.05 * eff;
        ruX -= 0.8 * eff;
        rlZ += 1.8 * eff;
        rlY += 0.4 * eff;
        rhX = 1.0 * eff;
        headZ += 0.12 * eff;
        headY += 0.04 * eff;
      }
    }

    const lift = Math.abs(lean) * 1.2;
    luZ -= lift;
    ruZ += lift;
    this.setBone('hips', 0, -lean * 0.8, Math.sin(t * 0.5) * 0.018);
    this.setBone('spine', spineX, -lean * 0.4, Math.sin(t * 0.62) * 0.026 + lean);
    this.setBone('chest', chestX, -lean * 0.8, lean * 0.6);
    this.setBone('neck', headX * 0.4 + neckX, headY * 0.35, headZ * 0.5);
    this.setBone('head', headX, headY, headZ);
    this.setBone('leftUpperArm', 0.05, 0, luZ);
    this.setBone('rightUpperArm', ruX, 0, ruZ);
    this.setBone('leftLowerArm', 0, llY, llZ);
    this.setBone('rightLowerArm', 0, rlY, rlZ);
    this.setBone('rightHand', rhX, 0, 0);
    this.vrm.scene.position.z = this.basePos.z + leanShift;
  }

  setEmotion(name) {
    this.target = { emotion: name === 'neutral' ? 'relaxed' : name, weight: 1 };
  }

  setGaze(x, y) {
    // x,y 为画面归一化坐标 (0..1)，映射到角色眼前的目标点
    this.lookObj.position.set((x - 0.5) * 1.6, this.frame.centerY + (0.5 - y) * 0.6, 1.2);
  }

  lookAtWorld(v) {
    this.lookObj.position.copy(v);
  }

  setHeadBias(x, y) {
    this.headBiasTarget.set(x, y);
  }

  setTurnRate(v) {
    this.turnVelTarget = Math.max(-5, Math.min(5, v));
  }

  setInteracting(on) {
    if (on === this.interacting) return;
    this.interacting = on;
    if (on) this.gesture = null;
    else this.nextGesture = this.time + 6 + Math.random() * 6;
  }

  setYaw(y) {
    this.vrm.scene.rotation.y = this.baseYaw + y;
  }

  setTalking(on) { this.talking = on; }

  update(dt, t) {
    const em = this.vrm.expressionManager;
    if (em) {
      for (const k of EMOTION_KEYS) {
        const goal = this.target.emotion === k ? this.target.weight : 0;
        this.weights[k] += (goal - this.weights[k]) * Math.min(1, dt * 6);
        try { em.setValue(k, this.weights[k]); } catch { /* 缺该表情 */ }
      }
      const mouth = this.talking ? (0.4 + 0.35 * Math.sin(t * 16)) : 0;
      try { em.setValue('aa', mouth); } catch { /* noop */ }

      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.nextBlink = 2 + Math.random() * 3; this.blinkT = 0.12; }
      this.blinkT = Math.max(0, this.blinkT - dt);
      try { em.setValue('blink', this.blinkT > 0 ? 1 : 0); } catch { /* noop */ }
    }
    this.updateIdle(t, dt);
    this.vrm.update(dt);
  }
}

class PlaceholderAvatar {
  constructor(scene) {
    this.group = new THREE.Group();
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 512;
    this.faceCanvas.height = 512;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.emotion = 'neutral';
    this.gaze = { x: 0, y: 0 };
    this.talking = false;
    this.nextBlink = 2;
    this.blinkT = 0;

    const skin = new THREE.MeshStandardMaterial({ color: 0xf6d7b8 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x4650ff });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 48, 48), skin);
    head.position.y = 1.35;
    head.scale.set(1, 1.08, 0.95);
    this.head = head;

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true })
    );
    face.position.set(0, 0, 0.275);
    head.add(face);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.345, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x3a2e55 })
    );
    hair.position.y = 0.04;
    head.add(hair);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 8, 24), cloth);
    body.position.y = 0.62;

    this.group.add(head, body);
    scene.add(this.group);
    this.drawFace(0);
  }

  setEmotion(name) { this.emotion = name; }
  setGaze(x, y) { this.gaze = { x, y }; }
  setTalking(on) { this.talking = on; }
  setYaw(y) { this.group.rotation.y = y; }
  lookAtWorld() {}
  setHeadBias(x, y) { this.headBias = { x, y }; }
  setTurnRate() {}
  setInteracting() {}
  playGesture() {}

  update(dt, t) {
    this.group.position.y = Math.sin(t * 1.6) * 0.02;
    const hb = this.headBias ?? { x: 0, y: 0 };
    const targetYaw = (this.gaze.x - 0.5) * -0.5 + hb.x * 0.5;
    const targetPitch = (this.gaze.y - 0.5) * 0.3 - hb.y * 0.3;
    this.head.rotation.y += (targetYaw - this.head.rotation.y) * dt * 4;
    this.head.rotation.x += (targetPitch - this.head.rotation.x) * dt * 4;

    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0.12; this.nextBlink = 2 + Math.random() * 3; }
    this.blinkT = Math.max(0, this.blinkT - dt);

    this.drawFace(t);
  }

  drawFace(t) {
    const ctx = this.faceCanvas.getContext('2d');
    const { emotion } = this;
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = ctx.fillStyle = '#2b2438';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';

    const blinking = this.blinkT > 0;
    for (const dx of [-110, 110]) {
      const cx = 256 + dx;
      const cy = 225 + (this.gaze.y - 0.5) * 12;
      const px = cx + (this.gaze.x - 0.5) * 22;
      if (emotion === 'surprised') {
        ctx.beginPath(); ctx.arc(cx, cy, 42, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, cy, 16, 0, Math.PI * 2); ctx.fill();
      } else if (blinking) {
        ctx.beginPath(); ctx.moveTo(cx - 38, cy); ctx.lineTo(cx + 38, cy); ctx.stroke();
      } else if (emotion === 'happy') {
        ctx.beginPath(); ctx.arc(cx, cy + 18, 40, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        const r = emotion === 'sad' ? 26 : 32;
        ctx.beginPath(); ctx.arc(px, cy, r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 眉毛
    ctx.lineWidth = 12;
    for (const dx of [-110, 110]) {
      const cx = 256 + dx, cy = 150;
      ctx.beginPath();
      if (emotion === 'angry') ctx.moveTo(cx - 45, cy + (dx < 0 ? -12 : 18)), ctx.lineTo(cx + 45, cy + (dx < 0 ? 18 : -12));
      else if (emotion === 'sad') ctx.moveTo(cx - 45, cy + (dx < 0 ? 14 : -6)), ctx.lineTo(cx + 45, cy + (dx < 0 ? -6 : 14));
      else if (emotion === 'surprised') { ctx.moveTo(cx - 40, cy - 18); ctx.lineTo(cx + 40, cy - 18); }
      else { ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy); }
      ctx.stroke();
    }

    // 嘴
    ctx.lineWidth = 14;
    const my = 340;
    if (this.talking) {
      const h = 30 + 22 * Math.abs(Math.sin(t * 14));
      ctx.beginPath(); ctx.ellipse(256, my, 52, h, 0, 0, Math.PI * 2); ctx.fill();
    } else if (emotion === 'happy' || emotion === 'relaxed') {
      ctx.beginPath(); ctx.arc(256, my - 22, 62, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    } else if (emotion === 'sad') {
      ctx.beginPath(); ctx.arc(256, my + 45, 62, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (emotion === 'surprised') {
      ctx.beginPath(); ctx.arc(256, my, 34, 0, Math.PI * 2); ctx.fill();
    } else if (emotion === 'angry') {
      ctx.beginPath(); ctx.moveTo(210, my); ctx.lineTo(302, my - 10); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(214, my); ctx.lineTo(298, my); ctx.stroke();
    }

    if (emotion === 'happy') {
      ctx.fillStyle = 'rgba(255, 130, 130, 0.5)';
      for (const dx of [-150, 150]) { ctx.beginPath(); ctx.ellipse(256 + dx, 285, 34, 18, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    this.faceTex.needsUpdate = true;
  }
}
