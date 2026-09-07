import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

import {
  HandLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm';

class UltramaisonAR {
  constructor(root) {
    this.root = root;

    this.openButton = root.querySelector('[data-tryon-open]');
    this.modal = root.querySelector('[data-tryon-modal]');
    this.closeButton = root.querySelector('[data-tryon-close]');
    this.video = root.querySelector('[data-tryon-video]');
    this.stage = root.querySelector('.um-tryon-modal__stage');
    this.guide = root.querySelector('.um-tryon-modal__guide');

    this.diameter = Number(root.dataset.watchDiameter || 40);

    this.stream = null;
    this.tracker = null;
    this.running = false;
    this.lastVideoTime = -1;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.watch = null;

    this.pose = {
      x: null,
      y: null,
      scale: null,
      rx: null,
      ry: null,
      rz: null
    };

    this.openButton?.addEventListener('click', () => this.open());
    this.closeButton?.addEventListener('click', () => this.close());

    window.addEventListener('resize', () => this.resize());
  }

  clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  smooth(current, target, factor = 0.2) {
    if (current === null) return target;
    return current + (target - current) * factor;
  }

  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  async initTracker() {
    if (this.tracker) return;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
    );

    this.tracker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },

      runningMode: 'VIDEO',
      numHands: 1,

      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence: 0.7,
      minTrackingConfidence: 0.65
    });
  }

  initThree() {
    if (this.renderer) return;

    const canvas = document.createElement('canvas');

    canvas.className = 'um-tryon-modal__ar-canvas';

    this.stage.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(
      0,
      window.innerWidth,
      0,
      window.innerHeight,
      -1000,
      1000
    );

    this.camera.position.z = 500;

    const ambient =
      new THREE.HemisphereLight(
        0xffffff,
        0x28324a,
        2.5
      );

    this.scene.add(ambient);

    const key =
      new THREE.DirectionalLight(
        0xffffff,
        3.2
      );

    key.position.set(-200, -200, 300);

    this.scene.add(key);

    const fill =
      new THREE.DirectionalLight(
        0x9db8ff,
        1.5
      );

    fill.position.set(200, 100, 250);

    this.scene.add(fill);

    this.watch = this.createWatch();

    this.scene.add(this.watch);

    this.resize();
  }

  createWatch() {
    const group = new THREE.Group();

    /*
     * CAJA
     */
    const steel =
      new THREE.MeshStandardMaterial({
        color: 0x25282d,
        metalness: 0.95,
        roughness: 0.22
      });

    const caseMesh =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          21,
          21,
          6,
          64
        ),
        steel
      );

    caseMesh.rotation.x = Math.PI / 2;

    caseMesh.position.z = 2;

    group.add(caseMesh);

    /*
     * BISEL
     */
    const bezel =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          20.5,
          20.5,
          2,
          64
        ),

        new THREE.MeshStandardMaterial({
          color: 0x05070a,
          metalness: 0.8,
          roughness: 0.25
        })
      );

    bezel.rotation.x = Math.PI / 2;

    bezel.position.z = 5;

    group.add(bezel);

    /*
     * ESFERA
     */
    const dial =
      new THREE.Mesh(
        new THREE.CircleGeometry(
          18,
          64
        ),

        new THREE.MeshStandardMaterial({
          color: 0x08090b,
          metalness: 0.15,
          roughness: 0.3
        })
      );

    dial.position.z = 6.2;

    group.add(dial);

    /*
     * MARCAS HORARIAS
     */
    for (let i = 0; i < 12; i++) {
      const marker =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            i % 3 === 0 ? 1.6 : 0.8,
            i % 3 === 0 ? 5 : 3.2,
            0.5
          ),

          new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            metalness: 0.5,
            roughness: 0.25
          })
        );

      const angle =
        (i / 12) *
        Math.PI *
        2;

      marker.position.x =
        Math.sin(angle) * 14;

      marker.position.y =
        -Math.cos(angle) * 14;

      marker.position.z = 6.5;

      marker.rotation.z = -angle;

      group.add(marker);
    }

    /*
     * AGUJAS
     */
    const handMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.2
      });

    const hour =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          1.2,
          10,
          0.6
        ),
        handMaterial
      );

    hour.position.set(
      -2,
      -3,
      7
    );

    hour.rotation.z = -0.6;

    group.add(hour);

    const minute =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.8,
          14,
          0.5
        ),
        handMaterial
      );

    minute.position.set(
      3,
      -3,
      7.2
    );

    minute.rotation.z = 0.9;

    group.add(minute);

    /*
     * CORREA CAMUFLADA
     */
    const strapMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x55603e,
        roughness: 0.7,
        metalness: 0.05
      });

    const strapTop =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          20,
          58,
          4
        ),
        strapMaterial
      );

    strapTop.position.set(
      0,
      -48,
      -1
    );

    group.add(strapTop);

    const strapBottom =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          20,
          58,
          4
        ),
        strapMaterial
      );

    strapBottom.position.set(
      0,
      48,
      -1
    );

    group.add(strapBottom);

    /*
     * CORONA
     */
    const crown =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          2.6,
          2.6,
          5,
          24
        ),
        steel
      );

    crown.rotation.z =
      Math.PI / 2;

    crown.position.set(
      23,
      0,
      2
    );

    group.add(crown);

    group.visible = false;

    return group;
  }

  resize() {
    if (!this.renderer) return;

    const rect =
      this.stage.getBoundingClientRect();

    this.renderer.setSize(
      rect.width,
      rect.height,
      false
    );

    this.camera.left = 0;
    this.camera.right = rect.width;
    this.camera.top = 0;
    this.camera.bottom = rect.height;

    this.camera.updateProjectionMatrix();
  }

  async open() {
    this.modal.classList.add('is-open');

    this.modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    try {
      this.guide.textContent =
        'Preparando AR 3D...';

      this.initThree();

      await this.initTracker();

      this.stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: 'environment'
            },

            width: {
              ideal: 1920
            },

            height: {
              ideal: 1080
            }
          },

          audio: false
        });

      this.video.srcObject =
        this.stream;

      await this.video.play();

      this.resize();

      this.running = true;

      this.guide.textContent =
        'Mostrá la mano completa y dejá visible la muñeca';

      requestAnimationFrame(() =>
        this.loop()
      );

    } catch (error) {
      console.error(
        'ULTRAMAISON AR V3',
        error
      );

      this.guide.textContent =
        'No pudimos iniciar el AR';
    }
  }

  solvePose(landmarks, world) {
    const wrist = landmarks[0];

    const index =
      landmarks[5];

    const middle =
      landmarks[9];

    const pinky =
      landmarks[17];

    const rect =
      this.stage.getBoundingClientRect();

    /*
     * Ancho de palma.
     */
    const palmWidth =
      this.distance(
        index,
        pinky
      ) * rect.width;

    if (palmWidth < 25) {
      return null;
    }

    /*
     * Vector palma.
     */
    const vx =
      middle.x -
      wrist.x;

    const vy =
      middle.y -
      wrist.y;

    const len =
      Math.hypot(
        vx,
        vy
      ) || 0.001;

    const ux =
      vx / len;

    const uy =
      vy / len;

    /*
     * El landmark 0 cae en la unión mano/muñeca.
     * Retrocedemos hacia el antebrazo.
     */
    const offset =
      palmWidth * 0.50;

    const x =
      wrist.x *
      rect.width -
      ux *
      offset;

    const y =
      wrist.y *
      rect.height -
      uy *
      offset;

    /*
     * ESCALA FÍSICA
     *
     * referencia palma ≈ 82mm
     */
    const pxPerMM =
      palmWidth / 82;

    const scale =
      pxPerMM *
      (this.diameter / 42);

    /*
     * Rotación plana.
     */
    const rz =
      Math.atan2(
        vy,
        vx
      ) +
      Math.PI /
      2;

    let rx = 0;
    let ry = 0;

    /*
     * Profundidad real utilizando world landmarks.
     */
    if (world?.length) {
      const w0 =
        world[0];

      const w5 =
        world[5];

      const w9 =
        world[9];

      const w17 =
        world[17];

      const across =
        Math.hypot(
          w5.x - w17.x,
          w5.y - w17.y
        ) || 0.05;

      const forward =
        Math.hypot(
          w9.x - w0.x,
          w9.y - w0.y
        ) || 0.05;

      ry =
        this.clamp(
          (
            (w5.z - w17.z) /
            across
          ) *
          1.4,
          -1.1,
          1.1
        );

      rx =
        this.clamp(
          (
            -(w9.z - w0.z) /
            forward
          ) *
          1.2,
          -1,
          1
        );
    }

    return {
      x,
      y,
      scale,
      rx,
      ry,
      rz
    };
  }

  updateWatch(pose) {
    this.pose.x =
      this.smooth(
        this.pose.x,
        pose.x,
        0.28
      );

    this.pose.y =
      this.smooth(
        this.pose.y,
        pose.y,
        0.28
      );

    this.pose.scale =
      this.smooth(
        this.pose.scale,
        pose.scale,
        0.18
      );

    this.pose.rx =
      this.smooth(
        this.pose.rx,
        pose.rx,
        0.18
      );

    this.pose.ry =
      this.smooth(
        this.pose.ry,
        pose.ry,
        0.18
      );

    this.pose.rz =
      this.smooth(
        this.pose.rz,
        pose.rz,
        0.18
      );

    this.watch.visible =
      true;

    this.watch.position.set(
      this.pose.x,
      this.pose.y,
      30
    );

    this.watch.rotation.set(
      this.pose.rx,
      this.pose.ry,
      this.pose.rz
    );

    this.watch.scale.setScalar(
      this.pose.scale
    );
  }

  loop() {
    if (!this.running) return;

    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !==
        this.lastVideoTime
    ) {
      this.lastVideoTime =
        this.video.currentTime;

      const result =
        this.tracker.detectForVideo(
          this.video,
          performance.now()
        );

      if (
        result.landmarks &&
        result.landmarks.length
      ) {
        const pose =
          this.solvePose(
            result.landmarks[0],
            result.worldLandmarks?.[0]
          );

        if (pose) {
          this.updateWatch(pose);

          this.guide.textContent =
            `${this.diameter} mm · AR 3D activo`;

        } else {
          this.watch.visible =
            false;

          this.guide.textContent =
            'Alejá un poco la cámara';
        }

      } else {
        this.watch.visible =
          false;

        this.guide.textContent =
          'Mostrá la mano y la muñeca completas';
      }
    }

    this.renderer.render(
      this.scene,
      this.camera
    );

    requestAnimationFrame(() =>
      this.loop()
    );
  }

  close() {
    this.running = false;

    this.modal.classList.remove(
      'is-open'
    );

    this.modal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow =
      '';

    if (this.stream) {
      this.stream
        .getTracks()
        .forEach(track =>
          track.stop()
        );

      this.stream = null;
    }

    this.video.srcObject = null;

    if (this.watch) {
      this.watch.visible =
        false;
    }
  }
}

function bootAR() {
  document
    .querySelectorAll(
      '[data-ultramaison-tryon]'
    )
    .forEach(root => {

      if (
        root.dataset.arV3 ===
        'true'
      ) {
        return;
      }

      root.dataset.arV3 =
        'true';

      new UltramaisonAR(root);
    });
}

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    bootAR
  );

} else {
  bootAR();
}

document.addEventListener(
  'shopify:section:load',
  bootAR
);
