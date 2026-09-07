class UltramaisonTryOn {
  constructor(root) {
    this.root = root;
    this.button = root.querySelector('[data-tryon-open]');
    this.modal = root.querySelector('[data-tryon-modal]');
    this.closeButton = root.querySelector('[data-tryon-close]');
    this.video = root.querySelector('[data-tryon-video]');
    this.watch = root.querySelector('[data-tryon-watch]');
    this.error = root.querySelector('[data-tryon-error]');
    this.stream = null;

    this.bindEvents();
  }

  bindEvents() {
    this.button?.addEventListener('click', () => this.open());
    this.closeButton?.addEventListener('click', () => this.close());

    this.modal?.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.close();
      }
    });
  }

  async open() {
    this.modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      /*
       * MVP etapa 1:
       * mostramos el reloj en el centro.
       *
       * En la siguiente etapa esta posición será reemplazada
       * por detección automática de muñeca.
       */
      this.watch.style.display = 'block';
      this.watch.style.left = '50%';
      this.watch.style.top = '50%';
      this.watch.style.transform =
        'translate(-50%, -50%) rotate(0deg)';
    } catch (error) {
      console.error('ULTRAMAISON Try-On camera error:', error);

      this.error.classList.add('is-visible');
    }
  }

  close() {
    this.modal.classList.remove('is-open');
    document.body.style.overflow = '';

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    this.watch.style.display = 'none';
    this.error.classList.remove('is-visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-ultramaison-tryon]')
    .forEach((element) => new UltramaisonTryOn(element));
});
