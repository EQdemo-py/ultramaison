class UltramaisonTryOn {
  constructor(root) {
    this.root = root;
    this.button = root.querySelector('[data-tryon-open]');
    this.modal = root.querySelector('[data-tryon-modal]');
    this.closeButton = root.querySelector('[data-tryon-close]');
    this.video = root.querySelector('[data-tryon-video]');
    this.watch = root.querySelector('[data-tryon-watch]');
    this.guide = root.querySelector('.um-tryon-modal__guide');

    this.stream = null;
    this.handLandmarker = null;
    this.running = false;
    this.lastVideoTime = -1;

    this.smoothedX = null;
    this.smoothedY = null;
    this.smoothedScale = null;
    this.smoothedAngle = null;

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
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.5
      });
  }

  async open() {
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

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
      this.guide.textContent = 'Mostrá tu mano completa y mantené la muñeca visible';

      requestAnimationFrame(() => this.detectLoop());

    } catch (error) {
      console.error('ULTRAMAISON Try-On:', error);
      alert('No pudimos iniciar el probador virtual. Revisá los permisos de cámara.');
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

      if (result.landmarks && result.landmarks.length > 0) {
        this.placeWatch(result.landmarks[0]);
      } else {
        this.watch.style.display = 'none';
        this.guide.textContent =
          'Mostrá tu mano completa y mantené la muñeca visible';
      }
    }

    requestAnimationFrame(() => this.detectLoop());
  }

  placeWatch(landmarks) {
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];
    const middleMcp = landmarks[9];

    const stage = this.modal.querySelector('.um-tryon-modal__stage');
    const rect = stage.getBoundingClientRect();

    /*
      MediaPipe:
      x/y son coordenadas normalizadas 0–1.
      Como usamos cámara trasera, no invertimos X.
    */
    const x = wrist.x * rect.width;
    const y = wrist.y * rect.height;

    /*
      Ancho visual de la mano entre índice y meñique.
      Nos sirve como referencia para escalar el reloj.
    */
    const handDx = indexMcp.x - pinkyMcp.x;
    const handDy = indexMcp.y - pinkyMcp.y;
    const handWidthNorm = Math.sqrt(
      handDx * handDx + handDy * handDy
    );

    /*
      Escala del reloj.
      Queremos que la caja ocupe aprox. 70–80% del ancho
      superior de la muñeca.
    */
    let watchWidth = handWidthNorm * rect.width * 0.82;

    watchWidth = Math.max(85, Math.min(watchWidth, 190));

    /*
      Dirección desde muñeca hacia centro de la palma.
    */
    const dx = middleMcp.x - wrist.x;
    const dy = middleMcp.y - wrist.y;

    const angle =
      Math.atan2(dy, dx) * (180 / Math.PI) + 90;

    /*
      Desplazamos ligeramente hacia el antebrazo para
      que la caja no quede en la palma.
    */
    const offset = watchWidth * 0.38;

    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    const ux = dx / length;
    const uy = dy / length;

    const targetX = x - ux * offset;
    const targetY = y - uy * offset;

    /*
      Suavizado para evitar vibraciones.
    */
    const smoothing = 0.28;

    this.smoothedX =
      this.smoothedX === null
        ? targetX
        : this.smoothedX + (targetX - this.smoothedX) * smoothing;

    this.smoothedY =
      this.smoothedY === null
        ? targetY
        : this.smoothedY + (targetY - this.smoothedY) * smoothing;

    this.smoothedScale =
      this.smoothedScale === null
        ? watchWidth
        : this.smoothedScale +
          (watchWidth - this.smoothedScale) * smoothing;

    this.smoothedAngle =
      this.smoothedAngle === null
        ? angle
        : this.smoothedAngle +
          (angle - this.smoothedAngle) * smoothing;

    this.watch.style.display = 'block';
    this.watch.style.left = `${this.smoothedX}px`;
    this.watch.style.top = `${this.smoothedY}px`;
    this.watch.style.width = `${this.smoothedScale}px`;
    this.watch.style.height = 'auto';

    this.watch.style.transform =
      `translate(-50%, -50%) rotate(${this.smoothedAngle}deg)`;

    this.guide.textContent = 'Mové suavemente la muñeca';
  }

  close() {
    this.running = false;

    this.modal.classList.remove('is-open');
    document.body.style.overflow = '';

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    this.watch.style.display = 'none';

    this.smoothedX = null;
    this.smoothedY = null;
    this.smoothedScale = null;
    this.smoothedAngle = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-ultramaison-tryon]')
    .forEach(el => new UltramaisonTryOn(el));
});
