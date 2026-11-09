import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  GLTFLoader,
} from '../vendor/three-gltf.js';

const TARGET_HEIGHT = 1.5;
const ARENA = 2.15;
const ROBOT = { x: 1.28, z: 0.72 };
const BENCH = { x: 0.42, z: 0.22 };
const MODEL_URL = new URL('../models/astra-animated.glb', import.meta.url).href;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function dampAngle(current, target, lambda, dt) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function makeFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#12183a';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(61, 240, 255, 0.28)';
  ctx.lineWidth = 2;
  for (let r = 40; r <= 240; r += 40) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(124, 107, 255, 0.25)';
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
  for (let i = 0; i < 18; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 200;
    ctx.beginPath();
    ctx.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, 2 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function metal(color, emissive = 0x000000, intensity = 0) {
  return new MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.28,
    emissive,
    emissiveIntensity: intensity,
  });
}

function makeRobot() {
  const group = new Group();
  const bodyMat = metal(0x243056);
  const glow = metal(0x07343c, 0x3df0ff, 1.5);
  const body = new Mesh(new BoxGeometry(0.4, 0.42, 0.28), bodyMat);
  body.position.y = 0.5;
  const head = new Mesh(new BoxGeometry(0.32, 0.26, 0.24), bodyMat);
  head.position.y = 0.88;
  const eyeL = new Mesh(new SphereGeometry(0.04, 12, 12), glow);
  eyeL.position.set(-0.08, 0.9, 0.13);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  const antenna = new Mesh(new CylinderGeometry(0.015, 0.015, 0.2, 8), bodyMat);
  antenna.position.y = 1.1;
  const bulb = new Mesh(new SphereGeometry(0.05, 12, 12), glow);
  bulb.position.y = 1.22;
  const legL = new Mesh(new BoxGeometry(0.08, 0.24, 0.1), bodyMat);
  legL.position.set(-0.1, 0.14, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;
  const part = new Mesh(new BoxGeometry(0.18, 0.1, 0.12), metal(0x1a3a4a, 0x145a66, 0.4));
  part.position.set(0.36, 0.78, 0.02);
  part.name = 'spare-part';
  group.add(body, head, eyeL, eyeR, antenna, bulb, legL, legR, part);
  group.position.set(ROBOT.x, 0, ROBOT.z);
  group.rotation.y = -0.7;
  return { group, part };
}

function makeCrystals() {
  const group = new Group();
  const mat = new MeshStandardMaterial({
    color: 0x8ef6ff,
    emissive: 0x145a66,
    emissiveIntensity: 0.6,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
  });
  const spots = [[-1.9, -1.3], [2.1, -1.15], [-1.5, 1.7]];
  spots.forEach(([x, z], index) => {
    const crystal = new Mesh(new ConeGeometry(0.1, 0.38, 5), mat);
    crystal.position.set(x, 0.2, z);
    crystal.userData.phase = index * 1.3;
    group.add(crystal);
  });
  return group;
}

function freezeWalkForward(clip) {
  const track = clip.tracks.find((item) => item.name.includes('Hips') && item.name.endsWith('.position'));
  if (!track) return null;
  const { values } = track;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 1; i < values.length; i += 3) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }
  const base = values[1];
  for (let i = 1; i < values.length; i += 3) values[i] = base;
  return { track: track.name, delta: max - min };
}

export function createAstraScene(canvas, hooks = {}) {
  const world = new AstraWorld(canvas, hooks);
  return world;
}

class AstraWorld {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = {
      onStatus: () => {},
      onBubble: () => {},
      onReady: () => {},
      onError: () => {},
      ...hooks,
    };
    this.ready = false;
    this.failed = false;
    this.errorMessage = '';
    this.running = false;
    this.state = 'loading';
    this.clipName = '';
    this.info = {};
    this.yaw = 0;
    this.modelOffset = 0;
    this.walkSpeed = 0.72;
    this.elapsed = 0;
    this.introLeft = 2.4;
    this.fightIn = randRange(20, 40);
    this.buildIn = randRange(18, 34);
    this.greetLeft = 0;
    this.buildLeft = 0;
    this.buildDur = 1;
    this.goingBench = false;
    this.resumeBuild = false;
    this.target = null;
    this.clock = new Clock();
    this.raycaster = new Raycaster();
    this.pointer = new Vector2();
    this.waveAxis = new Vector3(0, 0, 1);
    this.waveLift = new Quaternion();
    this.waveTwist = new Quaternion();
    this.down = null;
    this._onPointerDown = (event) => {
      this.down = { x: event.clientX, y: event.clientY };
    };
    this._onPointerUp = (event) => this.onPointerUp(event);
    try {
      this.renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      this.fail(error);
      return;
    }
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(new Color('#0b1028'), 1);
    this.scene = new Scene();
    this.scene.background = new Color('#0b1028');
    this.scene.fog = new Fog('#0b1028', 8, 18);
    this.camera = new PerspectiveCamera(38, 1, 0.1, 40);
    this.avatar = new Group();
    this.fit = new Group();
    this.avatar.add(this.fit);
    this.scene.add(this.avatar);
    this.buildLights();
    this.buildSet();
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement || canvas);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointerup', this._onPointerUp);
    this.load();
  }

  fail(error) {
    this.failed = true;
    this.errorMessage = error && error.message ? error.message : String(error);
    this.hooks.onError(this.errorMessage);
  }

  buildLights() {
    this.scene.add(new HemisphereLight(0xd8f6ff, 0x1a1038, 1.25));
    this.scene.add(new AmbientLight(0x8ea0e0, 0.35));
    const key = new DirectionalLight(0xffffff, 2.15);
    key.position.set(3.2, 6.2, 4.2);
    this.scene.add(key);
    const fill = new DirectionalLight(0x9ec2ff, 0.7);
    fill.position.set(-4, 2.2, -2);
    this.scene.add(fill);
    const rim = new PointLight(0x3df0ff, 12, 12);
    rim.position.set(-1.6, 2.1, -1.4);
    this.scene.add(rim);
  }

  buildSet() {
    const floor = new Mesh(
      new CircleGeometry(2.95, 56),
      new MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.88, metalness: 0.04 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.012;
    const base = new Mesh(
      new CylinderGeometry(2.95, 3.12, 0.24, 48),
      metal(0x141833),
    );
    base.position.y = -0.11;
    const ring = new Mesh(
      new TorusGeometry(2.95, 0.028, 8, 72),
      metal(0x39f3ff, 0x1aa8c4, 0.9),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(floor, base, ring);

    const shadow = new Mesh(
      new CircleGeometry(0.32, 24),
      new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.shadow = shadow;
    this.scene.add(shadow);

    const robot = makeRobot();
    this.robot = robot.group;
    this.part = robot.part;
    this.scene.add(this.robot);

    this.crystals = makeCrystals();
    this.scene.add(this.crystals);

    const planet = new Mesh(
      new SphereGeometry(1.25, 28, 18),
      new MeshStandardMaterial({ color: 0x6d4dff, emissive: 0x2a1466, emissiveIntensity: 0.35, roughness: 0.62 }),
    );
    planet.position.set(-4.6, 2.5, -7.2);
    this.planet = planet;
    this.scene.add(planet);

    const positions = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i += 1) {
      const radius = 7 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.15) * 8;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
    }
    const starsGeo = new BufferGeometry();
    starsGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.scene.add(new Points(starsGeo, new PointsMaterial({ color: 0xffffff, size: 0.045, sizeAttenuation: true })));
  }

  load() {
    const loader = new GLTFLoader();
    loader.load(MODEL_URL, (gltf) => {
      try {
        this.onModel(gltf);
      } catch (error) {
        this.fail(error);
      }
    }, undefined, (error) => this.fail(error));
  }

  onModel(gltf) {
    const clips = {};
    gltf.animations.forEach((clip) => {
      clips[clip.name.toLowerCase()] = clip;
    });
    if (!clips.walk || !clips.fight || !clips.idle) {
      throw new Error('Animações walk, fight e idle não encontradas.');
    }
    const frozen = freezeWalkForward(clips.walk);
    this.fit.add(gltf.scene);
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.frustumCulled = false;
      obj.castShadow = false;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((material) => {
        if (!material) return;
        material.metalness = Math.min(material.metalness ?? 1, 0.08);
        material.roughness = Math.max(material.roughness ?? 0.5, 0.48);
        if (material.specularColor) material.specularColor.setRGB(1, 1, 1);
      });
    });
    this.mixer = new AnimationMixer(gltf.scene);
    this.actions = {
      walk: this.mixer.clipAction(clips.walk),
      fight: this.mixer.clipAction(clips.fight),
      idle: this.mixer.clipAction(clips.idle),
    };
    this.mixer.addEventListener('finished', (event) => {
      if (this.state === 'fight' && event.action === this.actions.fight) {
        this.fightIn = randRange(20, 40);
        if (this.resumeBuild && this.buildLeft > 0) this.enterBuild(true);
        else this.enterWalk();
      }
    });
    this.play('idle', false);
    this.mixer.update(0.001);
    gltf.scene.updateMatrixWorld(true);
    const head = new Vector3();
    const left = new Vector3();
    const right = new Vector3();
    const headBone = gltf.scene.getObjectByName('mixamorigHeadTop_End');
    const leftFoot = gltf.scene.getObjectByName('mixamorigLeftFoot');
    const rightFoot = gltf.scene.getObjectByName('mixamorigRightFoot');
    if (!headBone || !leftFoot || !rightFoot) {
      throw new Error('Esqueleto incompleto.');
    }
    headBone.getWorldPosition(head);
    leftFoot.getWorldPosition(left);
    rightFoot.getWorldPosition(right);
    const footY = Math.min(left.y, right.y);
    const height = head.y - footY;
    if (!Number.isFinite(height) || height < 1e-4) throw new Error('Não medi a altura da Astra.');
    const footX = (left.x + right.x) / 2;
    const footZ = (left.z + right.z) / 2;
    gltf.scene.position.x -= footX;
    gltf.scene.position.y -= footY;
    gltf.scene.position.z -= footZ;
    this.fit.scale.setScalar(TARGET_HEIGHT / height);
    this.rightArm = gltf.scene.getObjectByName('mixamorigRightArm');
    const collider = new Mesh(
      new CylinderGeometry(0.42, 0.48, 1.7, 12),
      new MeshBasicMaterial({ visible: false }),
    );
    collider.position.y = 0.85;
    this.avatar.add(collider);
    this.avatar.position.set(0, 0, 0.15);
    this.shadow.position.x = this.avatar.position.x;
    this.shadow.position.z = this.avatar.position.z;
    this.info = {
      height: TARGET_HEIGHT,
      sourceHeight: height,
      scale: TARGET_HEIGHT / height,
      neutralized: frozen,
      clips: Object.keys(clips),
    };
    this.state = 'intro';
    this.ready = true;
    this.hooks.onReady();
    this.hooks.onStatus('');
  }

  play(name, once) {
    const next = this.actions[name];
    if (!next) return;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = Boolean(once);
    const prev = this.current;
    if (prev && prev !== next) {
      next.reset();
      next.play();
      prev.crossFadeTo(next, 0.22, false);
    } else {
      next.reset().play();
    }
    this.current = next;
    this.clipName = name;
  }

  enterWalk() {
    this.state = 'walk';
    this.resumeBuild = false;
    this.play('walk', false);
    this.hooks.onStatus('');
    this.hooks.onBubble('');
    if (!this.target) this.target = this.randomPoint();
  }

  enterBuild(resume) {
    this.state = 'build';
    this.goingBench = false;
    if (!resume) {
      this.buildLeft = randRange(8, 12);
      this.buildDur = this.buildLeft;
    }
    this.play('idle', false);
    this.hooks.onStatus('Montando um robô');
  }

  enterFight() {
    this.resumeBuild = this.state === 'build';
    this.state = 'fight';
    this.play('fight', true);
    this.hooks.onStatus('Treinando krav maga');
    this.hooks.onBubble('');
  }

  greet() {
    if (!this.ready || this.state === 'greet') return;
    if (this.state === 'fight') this.fightIn = randRange(20, 40);
    this.state = 'greet';
    this.greetLeft = 2.4;
    this.play('idle', false);
    const lines = ['Oi! Vamos praticar?', 'Você consegue!', 'I like your energy!'];
    this.hooks.onBubble(lines[Math.floor(Math.random() * lines.length)]);
    this.hooks.onStatus('');
  }

  randomPoint() {
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.35 + Math.random() * 1.65;
      const point = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      const dx = point.x - ROBOT.x;
      const dz = point.z - ROBOT.z;
      if (dx * dx + dz * dz > 0.9) return point;
    }
    return { x: -1.1, z: -0.4 };
  }

  faceToward(x, z, dt) {
    const dx = x - this.avatar.position.x;
    const dz = z - this.avatar.position.z;
    if (dx * dx + dz * dz < 0.0004) return 0;
    const desired = Math.atan2(dx, dz);
    this.yaw = dampAngle(this.yaw, desired, 7, dt);
    this.avatar.rotation.y = this.yaw + this.modelOffset;
    return Math.atan2(Math.sin(desired - this.yaw), Math.cos(desired - this.yaw));
  }

  stepToward(dt) {
    if (!this.target) this.target = this.randomPoint();
    const dx = this.target.x - this.avatar.position.x;
    const dz = this.target.z - this.avatar.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.16) {
      if (this.goingBench) this.enterBuild(false);
      else this.target = this.randomPoint();
      return;
    }
    const err = this.faceToward(this.target.x, this.target.z, dt);
    const align = Math.max(0, Math.cos(err));
    const speed = this.walkSpeed * (0.12 + 0.88 * align) * (dist < 0.45 ? dist / 0.45 : 1);
    let nx = this.avatar.position.x + Math.sin(this.yaw) * speed * dt;
    let nz = this.avatar.position.z + Math.cos(this.yaw) * speed * dt;
    const radius = Math.hypot(nx, nz);
    if (radius > ARENA) {
      nx = (nx / radius) * ARENA;
      nz = (nz / radius) * ARENA;
      if (!this.goingBench) this.target = this.randomPoint();
    }
    this.avatar.position.x = nx;
    this.avatar.position.z = nz;
  }

  applyWave() {
    if (!this.rightArm) return;
    const wave = Math.sin(this.elapsed * 9);
    this.waveLift.setFromAxisAngle(this.waveAxis, -0.7 + wave * 0.22);
    this.rightArm.quaternion.multiply(this.waveLift);
  }

  animateProps(dt) {
    this.elapsed += dt;
    this.planet.rotation.y += dt * 0.15;
    this.crystals.children.forEach((crystal) => {
      crystal.position.y = 0.22 + Math.sin(this.elapsed * 1.6 + crystal.userData.phase) * 0.06;
      crystal.rotation.y += dt * 0.6;
    });
    if (this.part) {
      const hover = Math.sin(this.elapsed * 2.2) * 0.04;
      if (this.state === 'build') {
        const progress = 1 - this.buildLeft / this.buildDur;
        this.part.position.y = 0.98 - progress * 0.32 + hover * (1 - progress);
        this.part.position.x = 0.36 - progress * 0.2;
      } else {
        this.part.position.y = 0.78 + hover;
        this.part.position.x = 0.36;
      }
    }
    this.shadow.position.x = this.avatar.position.x;
    this.shadow.position.z = this.avatar.position.z;
    this.shadow.scale.setScalar(this.state === 'greet' ? 0.86 : 1);
  }

  update(dt) {
    if (!this.ready) return;
    this.mixer.update(dt);
    this.animateProps(dt);
    if (this.state === 'walk' || this.state === 'build') {
      this.fightIn -= dt;
      if (this.fightIn <= 0) {
        this.enterFight();
        return;
      }
    }
    if (this.state === 'greet') {
      this.greetLeft -= dt;
      this.avatar.position.y = Math.abs(Math.sin(this.elapsed * 8)) * 0.16;
      this.avatar.rotation.y = this.yaw + Math.sin(this.elapsed * 7) * 0.22;
      this.applyWave();
      if (this.greetLeft <= 0) this.enterWalk();
      return;
    }
    this.avatar.position.y = 0;
    if (this.state === 'fight') return;
    if (this.state === 'intro') {
      this.faceToward(0, 2.2, dt);
      this.introLeft -= dt;
      if (this.introLeft <= 0) this.enterWalk();
      return;
    }
    if (this.state === 'build') {
      this.faceToward(ROBOT.x, ROBOT.z, dt);
      this.buildLeft -= dt;
      if (this.buildLeft <= 0) {
        this.buildIn = randRange(22, 38);
        this.enterWalk();
      }
      return;
    }
    this.buildIn -= dt;
    if (this.buildIn <= 0 && !this.goingBench) {
      this.goingBench = true;
      this.target = { ...BENCH };
    }
    this.stepToward(dt);
  }

  frame() {
    if (!this.running) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.failed || this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  stop() {
    this.running = false;
    if (this.renderer) this.renderer.setAnimationLoop(null);
  }

  resize() {
    if (!this.renderer) return;
    const parent = this.canvas.parentElement || this.canvas;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width < 2 || height < 2) return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const cap = coarse || (navigator.hardwareConcurrency || 8) <= 4 ? 1.25 : 1.6;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    if (this.camera.aspect < 0.9) {
      this.camera.fov = 40;
      this.camera.position.set(0.35, 1.95, 5.15);
      this.camera.lookAt(0.15, 0.8, 0.1);
    } else {
      this.camera.fov = 36;
      this.camera.position.set(0.05, 1.88, 5.35);
      this.camera.lookAt(0.02, 0.78, 0.05);
    }
    this.camera.updateProjectionMatrix();
    this.info.pixelRatio = this.renderer.getPixelRatio();
  }

  onPointerUp(event) {
    if (!this.ready || !this.down) return;
    const dx = event.clientX - this.down.x;
    const dy = event.clientY - this.down.y;
    this.down = null;
    if (dx * dx + dy * dy > 144) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.avatar, true);
    if (hits.length) this.greet();
  }

  get debug() {
    return {
      ready: this.ready,
      failed: this.failed,
      error: this.errorMessage,
      clip: this.clipName,
      state: this.state,
      mixerTime: this.mixer ? this.mixer.time : 0,
      info: this.info,
      position: { x: this.avatar.position.x, y: this.avatar.position.y, z: this.avatar.position.z },
      yaw: this.yaw,
    };
  }

  train() {
    if (this.ready) this.enterFight();
  }

  dispose() {
    this.stop();
    this.observer?.disconnect();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
  }
}
