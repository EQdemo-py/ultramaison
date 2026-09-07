class UltramaisonTryOn {
  constructor(root) {
    this.root = root;
    this.button = root.querySelector('[data-tryon-open]');
    this.modal = root.querySelector('[data-tryon-modal]');
    this.closeButton = root.querySelector('[data-tryon-close]');
    this.video = root.querySelector('[data-tryon-video]');
    this.watch = root.querySelector('[data-tryon-watch]');
    this.stream = null;

    this.button?.addEventListener('click', () => this.open());
    this.closeButton?.addEventListener('click', () => this.close());
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
      this.watch.style.width = '84px';
      this.watch.style.height = 'auto';
      this.watch.style.maxWidth = 'none';
      this.watch.style.maxHeight = 'none';
      this.watch.style.display = 'block';
    } catch (error) {
      console.error('Try-On camera error:', error);
      alert('No pudimos acceder a la cámara. Revisá los permisos del navegador.');
      this.close();
    }
  }

  close() {
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelectorAll('[data-ultramaison-tryon]')
    .forEach(el => new UltramaisonTryOn(el));
});

// Shopify resync marker
