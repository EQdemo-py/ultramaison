document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('product-modal.product-media-modal').forEach((modal) => {
    if (modal.dataset.umLightboxReady === 'true') return;
    modal.dataset.umLightboxReady = 'true';

    const content = modal.querySelector('.product-media-modal__content');
    if (!content) return;

    const items = Array.from(content.children).filter((item) =>
      item.matches('.product__media-item')
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

    const getActiveIndex = () => {
      const index = items.findIndex((item) => item.classList.contains('active'));
      return index >= 0 ? index : 0;
    };

    const updateSlides = (index) => {
      items.forEach((item, i) => {
        item.classList.remove(
          'active',
          'um-lightbox-prev',
          'um-lightbox-next',
          'um-lightbox-hidden'
        );

        if (i === index) {
          item.classList.add('active');
          return;
        }

        const prevIndex = (index - 1 + items.length) % items.length;
        const nextIndex = (index + 1) % items.length;

        if (i === prevIndex) {
          item.classList.add('um-lightbox-prev');
        } else if (i === nextIndex) {
          item.classList.add('um-lightbox-next');
        } else {
          item.classList.add('um-lightbox-hidden');
        }
      });
    };

    const move = (direction) => {
      const current = getActiveIndex();
      const next =
        direction === 'next'
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;

      updateSlides(next);
    };

    prevButton.addEventListener('click', () => move('prev'));
    nextButton.addEventListener('click', () => move('next'));

    modal.addEventListener('keydown', (event) => {
      if (!modal.hasAttribute('open')) return;

      if (event.key === 'ArrowLeft') move('prev');
      if (event.key === 'ArrowRight') move('next');
    });

    const observer = new MutationObserver(() => {
      if (!modal.hasAttribute('open')) return;

      requestAnimationFrame(() => {
        updateSlides(getActiveIndex());
      });
    });

    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['open'],
    });

    content.addEventListener('click', (event) => {
      const prev = event.target.closest('.um-lightbox-prev');
      const next = event.target.closest('.um-lightbox-next');

      if (prev) move('prev');
      if (next) move('next');
    });
  });
});
