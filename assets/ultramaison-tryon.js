class UltramaisonTryOn {
  constructor(root) {
    this.root = root;
    this.button = root.querySelector('[data-tryon-open]');
    this.modal = root.querySelector('[data-tryon-modal]');
    this.closeButton = root.querySelector('[data-tryon-close]');
    this.video = root.querySelector('[data-tryon-video]');
    this.watch = root.querySelector('[data-tryon-watch]');
    this.guide = root.querySelector('.um-tryon-modal__guide');

    this.diameter = Number(root.dataset.watchDiameter || 40);

    this.stream = null;
    this.handLandmarker = null;
    this.running = false;
    this.lastVideoTime = -1;

    this.state = {
      x: null,
      y: null,
      width: null,
      angle: null,
      squash: null
    };

    this.button?.addEventListener('click', () => this.open());
    this.closeButton?.addEventListener('click', () => this.close());
  }

  async initHandTracking() {
    if (this.handLandmarker) return;

    if (!window.UMFilesetResolver || !window.UMHandLandmarker) {
      throw new Error('MediaPipe no está disponible');
    }

    const vision = await window.UMFilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.handLandmarker =
      await window.UMHandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.65,
        minHandPresenceConfidence: 0.65,
        minTrackingConfidence: 0.60
      });
  }

  async open() {
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    this.watch.style.display = 'none';

    try {
      this.guide.textContent = 'Preparando cámara...';

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

      this.guide.textContent = 'Preparando detección de muñeca...';

      await this.initHandTracking();

      this.running = true;

      this.guide.textContent =
        'Mostrá la mano completa y dejá visible la muñeca';

      requestAnimationFrame(() => this.detectLoop());

    } catch (error) {
      console.error('ULTRAMAISON Try-On:', error);

      alert(
        'No pudimos iniciar el probador virtual. Revisá los permisos de cámara.'
      );

      this.close();
    }
  }

  detectLoop() {
    if (!this.running || !this.handLandmarker) return;

    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastVideoTime
    ) {
      this.lastVideoTime = this.video.currentTime;

      const result = this.handLandmarker.detectForVideo(
        this.video,
        performance.now()
      );

      if (result.landmarks?.length) {
        this.placeWatch(result.landmarks[0]);
      } else {
        this.watch.style.opacity = '0';

        this.guide.textContent =
          'Mostrá la mano completa y mantené visible la muñeca';
      }
    }

    requestAnimationFrame(() => this.detectLoop());
  }

  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
  }

  smooth(current, target, amount = 0.20) {
    if (current === null) return target;

    return current + (target - current) * amount;
  }

  placeWatch(lm) {
    const wrist = lm[0];

    const indexMcp = lm[5];
    const middleMcp = lm[9];
    const pinkyMcp = lm[17];

    const indexPip = lm[6];
    const pinkyPip = lm[18];

    const stage = this.modal.querySelector('.um-tryon-modal__stage');
    const rect = stage.getBoundingClientRect();

    /*
     * Ancho de palma real en pantalla.
     */
    const palmWidthNorm = this.distance(indexMcp, pinkyMcp);
    const palmWidthPx = palmWidthNorm * rect.width;

    /*
     * Dirección muñeca -> centro de palma.
     */
    const vx = middleMcp.x - wrist.x;
    const vy = middleMcp.y - wrist.y;

    const vectorLength =
      Math.sqrt(vx * vx + vy * vy) || 0.0001;

    const ux = vx / vectorLength;
    const uy = vy / vectorLength;

    /*
     * Colocamos el reloj hacia el antebrazo.
     *
     * MediaPipe landmark 0 está en la unión mano/muñeca.
     * Un reloj real queda detrás de ese punto.
     */
    const wristShift = palmWidthPx * 0.46;

    const wristX =
      wrist.x * rect.width - ux * wristShift;

    const wristY =
      wrist.y * rect.height - uy * wristShift;

    /*
     * Escala.
     *
     * Una palma adulta ronda aproximadamente 75-90 mm.
     * Tomamos 82 mm como referencia visual.
     *
     * 42mm / 82mm ≈ 0.51.
     */
    const referencePalmMM = 82;

    const caseRatio =
      this.diameter / referencePalmMM;

    /*
     * Nuestra imagen todavía incluye correa.
     * La caja ocupa aproximadamente ~60% del ancho visual.
     *
     * Compensamos para que la CAJA tenga el diámetro correcto.
     */
    const imageFaceFactor = 0.60;

    let targetWidth =
      (palmWidthPx * caseRatio) / imageFaceFactor;

    /*
     * Límites de seguridad.
     */
    const minWidth = rect.width * 0.18;
    const maxWidth = rect.width * 0.38;

    targetWidth = Math.min(
      Math.max(targetWidth, minWidth),
      maxWidth
    );

    /*
     * Rotación del brazo.
     *
     * Imagen del reloj está orientada verticalmente.
     */
    const angle =
      Math.atan2(vy, vx) * 180 / Math.PI + 90;

    /*
     * Perspectiva aproximada.
     *
     * Si la palma se inclina, reducimos horizontalmente
     * el reloj para que no parezca siempre completamente plano.
     */
    const upperPalmWidth =
      this.distance(indexPip, pinkyPip);

    const perspectiveRatio =
      upperPalmWidth > 0
        ? palmWidthNorm / upperPalmWidth
        : 1;

    let squash =
      1 / Math.max(0.85, Math.min(perspectiveRatio, 1.4));

    squash =
      Math.max(0.72, Math.min(squash, 1));

    /*
     * Suavizado.
     */
    this.state.x =
      this.smooth(this.state.x, wristX, 0.22);

    this.state.y =
      this.smooth(this.state.y, wristY, 0.22);

    this.state.width =
      this.smooth(this.state.width, targetWidth, 0.18);

    this.state.angle =
      this.smooth(this.state.angle, angle, 0.18);

    this.state.squash =
      this.smooth(this.state.squash, squash, 0.15);

    /*
     * Render final.
     */
    this.watch.style.display = 'block';
    this.watch.style.opacity = '1';

    this.watch.style.left =
      `${this.state.x}px`;

    this.watch.style.top =
      `${this.state.y}px`;

    this.watch.style.width =
      `${this.state.width}px`;

    this.watch.style.height = 'auto';

    this.watch.style.transform =
      `translate(-50%, -50%)
       rotate(${this.state.angle}deg)
       scaleX(${this.state.squash})`;

    this.guide.textContent =
      `${this.diameter} mm · Mové suavemente la muñeca`;
  }

  close() {
    this.running = false;

    this.modal.classList.remove('is-open');
    document.body.style.overflow = '';

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.video.srcObject = null;

    this.watch.style.display = 'none';
    this.watch.style.opacity = '0';

    this.state = {
      x: null,
      y: null,
      width: null,
      angle: null,
      squash: null
    };
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-ultramaison-tryon]')
    .forEach(el => new UltramaisonTryOn(el));
});
