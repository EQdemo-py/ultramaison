import {
  HandLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm';

class UltramaisonTryOnV4 {
  constructor(root) {
    this.root = root;
    this.video = root.querySelector('[data-tryon-video]');
    this.watch = root.querySelector('[data-tryon-watch]');
    this.stage = root.querySelector('.um-tryon-modal__stage');
    this.guide = root.querySelector('.um-tryon-modal__guide');

    this.diameter = Number(root.dataset.watchDiameter || 40);
    this.stream = null;
    this.tracker = null;
    this.running = false;
    this.lastVideoTime = -1;

    this.pose = {
      x: null, y: null, width: null,
      angle: null, tiltX: null, tiltY: null
    };

    window.addEventListener('ultramaison:ar-open', e => {
      if (e.detail?.root === root) this.open();
    });

    window.addEventListener('ultramaison:ar-close', e => {
      if (e.detail?.root === root) this.close();
    });
  }

  smooth(a, b, f) {
    return a === null ? b : a + (b - a) * f;
  }

  clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  async initTracker() {
    if (this.tracker) return;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
    );

    this.tracker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: .65,
      minHandPresenceConfidence: .65,
      minTrackingConfidence: .6
    });
  }

  async open() {
    if (this.running) return;

    try {
      this.guide.textContent = 'Preparando cámara...';

      await this.initTracker();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      this.running = true;
      this.guide.textContent = 'Mostrá tu mano y muñeca';

      requestAnimationFrame(() => this.loop());

    } catch (e) {
      console.error('ULTRAMAISON V4', e);
      this.guide.textContent = 'No pudimos iniciar la cámara';
    }
  }

  close() {
    this.running = false;

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    this.watch.classList.remove('is-visible');
  }

  mapPoint(p) {
    const r = this.stage.getBoundingClientRect();

    const vw = this.video.videoWidth || r.width;
    const vh = this.video.videoHeight || r.height;

    const scale = Math.max(r.width / vw, r.height / vh);

    const rw = vw * scale;
    const rh = vh * scale;

    return {
      x: p.x * rw - (rw - r.width) / 2,
      y: p.y * rh - (rh - r.height) / 2
    };
  }

  solve(lm, world) {
    const wrist = this.mapPoint(lm[0]);
    const index = this.mapPoint(lm[5]);
    const middle = this.mapPoint(lm[9]);
    const pinky = this.mapPoint(lm[17]);

    const palmWidth = Math.hypot(
      index.x - pinky.x,
      index.y - pinky.y
    );

    if (palmWidth < 28) return null;

    const vx = middle.x - wrist.x;
    const vy = middle.y - wrist.y;

    const len = Math.hypot(vx, vy) || 1;

    const ux = vx / len;
    const uy = vy / len;

    /*
      Landmark 0 está en el pliegue de la muñeca.
      Retrocedemos ligeramente hacia el antebrazo.
    */
    /*
      Posición anatómica del reloj.

      El landmark 0 marca la unión mano-muñeca.
      Un reloj real se coloca del lado del antebrazo,
      inmediatamente después del pliegue de la muñeca.

      Usamos la longitud wrist -> middleMCP como referencia
      para que el desplazamiento sea proporcional al tamaño
      y a la distancia de la mano frente a la cámara.
    */
    /*
      Centro anatómico de la caja.

      Landmark 0 representa la unión mano-muñeca.
      El centro de un reloj real queda más atrás sobre el
      antebrazo, no directamente sobre el pliegue.

      0.38 de wrist->middleMCP aproxima mejor esa posición.
    */
    const wristOffset = len * .38;

    const x = wrist.x - ux * wristOffset;
    const y = wrist.y - uy * wristOffset;

    /*
      Escala basada en diámetro real del producto.
      82 mm = referencia aproximada de palma MCP.
    */
    /*
      La caja del reloj ocupa aprox. 60% del ancho visible
      del PNG transparente. Compensamos el ancho completo
      para que el diámetro real de la caja coincida mejor
      con la muñeca.
    */
    const WATCH_FACE_FACTOR = 0.60;

    const caseWidthPx =
      palmWidth * (this.diameter / 82);

    const width = this.clamp(
      caseWidthPx / WATCH_FACE_FACTOR,
      70,
      240
    );

    const angle =
      Math.atan2(vy, vx) * 180 / Math.PI - 90;

    let tiltX = 0;
    let tiltY = 0;

    if (world?.length) {
      const w0 = world[0];
      const w5 = world[5];
      const w9 = world[9];
      const w17 = world[17];

      const across =
        Math.hypot(w5.x-w17.x, w5.y-w17.y) || .05;

      const forward =
        Math.hypot(w9.x-w0.x, w9.y-w0.y) || .05;

      tiltY = this.clamp(
        ((w5.z-w17.z)/across)*20,
        -18, 18
      );

      tiltX = this.clamp(
        (-(w9.z-w0.z)/forward)*16,
        -14, 14
      );
    }

    return { x, y, width, angle, tiltX, tiltY };
  }

  render(p) {
    this.pose.x =
      this.smooth(this.pose.x, p.x, .30);

    this.pose.y =
      this.smooth(this.pose.y, p.y, .30);

    this.pose.width =
      this.smooth(this.pose.width, p.width, .22);

    this.pose.angle =
      this.smooth(this.pose.angle, p.angle, .20);

    this.pose.tiltX =
      this.smooth(this.pose.tiltX, p.tiltX, .16);

    this.pose.tiltY =
      this.smooth(this.pose.tiltY, p.tiltY, .16);

    this.watch.style.left = `${this.pose.x}px`;
    this.watch.style.top = `${this.pose.y}px`;
    this.watch.style.width = `${this.pose.width}px`;

    this.watch.style.transform = `
      translate(-50%,-50%)
      perspective(900px)
      rotateZ(${this.pose.angle}deg)
      rotateX(${this.pose.tiltX}deg)
      rotateY(${this.pose.tiltY}deg)
    `;

    this.watch.classList.add('is-visible');
  }

  loop() {
    if (!this.running) return;

    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastVideoTime
    ) {
      this.lastVideoTime = this.video.currentTime;

      const result =
        this.tracker.detectForVideo(
          this.video,
          performance.now()
        );

      const lm = result.landmarks?.[0];
      const world = result.worldLandmarks?.[0];

      if (lm) {
        const pose = this.solve(lm, world);

        if (pose) {
          this.render(pose);
          this.guide.textContent =
            `${this.diameter} mm · Mové la muñeca suavemente`;
        }
      } else {
        this.watch.classList.remove('is-visible');
        this.guide.textContent =
          'Mostrá la mano y la muñeca completas';
      }
    }

    requestAnimationFrame(() => this.loop());
  }
}

function boot() {
  document
    .querySelectorAll('[data-ultramaison-tryon]')
    .forEach(root => {

      if (root.dataset.v4Ready) return;

      root.dataset.v4Ready = '1';

      new UltramaisonTryOnV4(root);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

document.addEventListener('shopify:section:load', boot);
