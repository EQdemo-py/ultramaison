document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('product-modal.product-media-modal').forEach((modal) => {
    if (modal.dataset.umLightboxReady === 'true') return;
    modal.dataset.umLightboxReady = 'true';

    const content = modal.querySelector('.product-media-modal__content');
    if (!content) return;

    const items = Array.from(content.children).filter((item) =>
      item.hasAttribute('data-media-id')
    );

    if (items.length < 2) return;

    let currentIndex = 0;

    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'um-lightbox-arrow um-lightbox-arrow--prev';
    prevButton.setAttribute('aria-label', 'Imagen anterior');
    prevButton.innerHTML = '&#10094;';

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'um-lightbox-arrow um-lightbox-arrow--next';
    nextButton.setAttribute('aria-label', 'Imagen siguiente');
    nextButton.innerHTML = '&#10095;';

    /* IMPORTANTE:
       Van directamente dentro del modal, no dentro del dialog */
    modal.appendChild(prevButton);
    modal.appendChild(nextButton);

    function updateSlides(index) {
      currentIndex = ((index % items.length) + items.length) % items.length;

      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      const nextIndex = (currentIndex + 1) % items.length;

      items.forEach((item, i) => {
        item.classList.remove(
          'active',
          'um-lightbox-prev',
          'um-lightbox-next',
          'um-lightbox-hidden'
        );

        if (i === currentIndex) {
          item.classList.add('active');
        } else if (i === prevIndex) {
          item.classList.add('um-lightbox-prev');
        } else if (i === nextIndex) {
          item.classList.add('um-lightbox-next');
        } else {
          item.classList.add('um-lightbox-hidden');
        }
      });
    }

    function syncOpenedImage() {
      const openerId = modal.openedBy?.getAttribute('data-media-id');

      if (openerId) {
        const index = items.findIndex(
          (item) => String(item.dataset.mediaId) === String(openerId)
        );

        if (index >= 0) {
          updateSlides(index);
          return;
        }
      }

      const activeIndex = items.findIndex((item) =>
        item.classList.contains('active')
      );

      updateSlides(activeIndex >= 0 ? activeIndex : 0);
    }

    function previous() {
      updateSlides(currentIndex - 1);
    }

    function next() {
      updateSlides(currentIndex + 1);
    }

    function killEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function bindArrow(button, callback) {
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach((eventName) => {
        button.addEventListener(eventName, killEvent, true);
      });

      button.addEventListener(
        'click',
        (event) => {
          killEvent(event);
          callback();
        },
        true
      );
    }

    bindArrow(prevButton, previous);
    bindArrow(nextButton, next);

    document.addEventListener('keydown', (event) => {
      if (!modal.hasAttribute('open')) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previous();
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      }
    });

    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute('open')) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(syncOpenedImage);
      });
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['open']
    });
  });
});
