document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('product-modal.product-media-modal').forEach((modal) => {
    if (modal.dataset.umLightboxReady === 'true') return;
    modal.dataset.umLightboxReady = 'true';

    const content = modal.querySelector('.product-media-modal__content');
    if (!content) return;

    const items = Array.from(content.children).filter((item) =>
      item.hasAttribute('data-media-id')
    );

    if (!items.length) return;

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

    modal.appendChild(prevButton);
    modal.appendChild(nextButton);

    let currentIndex = 0;

    const updateSlides = (index) => {
      currentIndex = index;

      const prevIndex = (index - 1 + items.length) % items.length;
      const nextIndex = (index + 1) % items.length;

      items.forEach((item, i) => {
        item.classList.remove(
          'active',
          'um-lightbox-prev',
          'um-lightbox-next',
          'um-lightbox-hidden'
        );

        if (i === index) {
          item.classList.add('active');
        } else if (i === prevIndex) {
          item.classList.add('um-lightbox-prev');
        } else if (i === nextIndex) {
          item.classList.add('um-lightbox-next');
        } else {
          item.classList.add('um-lightbox-hidden');
        }
      });
    };

    const detectActiveMedia = () => {
      const active = items.findIndex((item) => item.classList.contains('active'));
      return active >= 0 ? active : 0;
    };

    const move = (direction) => {
      const next =
        direction === 'next'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;

      updateSlides(next);
    };

    prevButton.addEventListener('click', (event) => {
      event.stopPropagation();
      move('prev');
    });

    nextButton.addEventListener('click', (event) => {
      event.stopPropagation();
      move('next');
    });

    modal.addEventListener('keydown', (event) => {
      if (!modal.hasAttribute('open')) return;

      if (event.key === 'ArrowLeft') move('prev');
      if (event.key === 'ArrowRight') move('next');
    });

    content.addEventListener('click', (event) => {
      const previous = event.target.closest('.um-lightbox-prev');
      const next = event.target.closest('.um-lightbox-next');

      if (previous) move('prev');
      if (next) move('next');
    });

    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute('open')) return;

      requestAnimationFrame(() => {
        currentIndex = detectActiveMedia();
        updateSlides(currentIndex);
      });
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['open'],
    });
  });
});
