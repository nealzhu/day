import PhotoSwipe from 'photoswipe';
import photoSwipeCss from 'photoswipe/style.css?inline';
import viewerCss from '../styles/image-viewer.css?inline';

// Keep both styles in this lazy chunk. Astro otherwise hoists their link into article pages.
const style = document.createElement('style');
style.textContent = photoSwipeCss + '\n' + viewerCss;
document.head.append(style);

export function openImageViewer(gallery: HTMLElement, trigger: HTMLAnchorElement) {
  const slides = [...gallery.querySelectorAll<HTMLImageElement>('img[data-gallery-image]')].map(image => ({
    element: image,
    src: image.src,
    width: Number(image.getAttribute('width')),
    height: Number(image.getAttribute('height')),
    alt: image.alt,
    msrc: image.complete && image.naturalWidth ? image.currentSrc : undefined,
    caption: image.closest('figure')?.querySelector('figcaption')?.textContent ?? image.title,
  }));
  const index = Number(trigger.dataset.galleryOpen);
  if (!slides[index]) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'image-viewer';
  dialog.setAttribute('aria-label', '文章图片');
  const root = document.documentElement;
  const position = { left: scrollX, top: scrollY, behavior: 'instant' } as const;
  const scrollbarWidth = innerWidth - root.clientWidth;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const viewer = new PhotoSwipe({
    appendToEl: dialog,
    dataSource: slides,
    index,
    loop: false,
    preload: [0, 0],
    bgOpacity: 0.95,
    paddingFn: ({ x }) => {
      const sides = x > 768 ? 54 : 12;
      return { top: 60, bottom: 80, left: sides, right: sides };
    },
    showHideAnimationType: reduceMotion ? 'none' : 'zoom',
    showAnimationDuration: 240,
    hideAnimationDuration: 200,
    zoomAnimationDuration: reduceMotion ? 0 : 180,
    secondaryZoomLevel: zoom => zoom.initial >= 1 ? 2 : Math.min(1, zoom.initial * 2.5),
    imageClickAction: false,
    doubleTapAction: 'zoom',
    tapAction: false,
    pinchToClose: false,
    closeOnVerticalDrag: false,
    allowPanToNext: false,
    trapFocus: false,
    returnFocus: false,
    closeTitle: '关闭图片浏览',
    arrowPrevTitle: '上一张',
    arrowNextTitle: '下一张',
    zoomTitle: '缩放图片',
    errorMsg: '图片无法加载。请检查网络后重新打开。',
  });

  // If the current thumbnail is outside the viewport, fade without moving the page.
  viewer.on('close', () => {
    if (reduceMotion) return;
    const rect = slides[viewer.currIndex].element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.top >= innerHeight || rect.bottom <= 0 ||
        rect.left >= innerWidth || rect.right <= 0) viewer.options.showHideAnimationType = 'fade';
  });

  viewer.addFilter('contentErrorElement', element => {
    element.setAttribute('role', 'status');
    return element;
  });

  viewer.on('uiRegister', () => {
    viewer.ui?.registerElement({
      name: 'caption',
      appendTo: 'root',
      onInit: (caption, pswp) => {
        pswp.on('change', () => {
          caption.textContent = slides[pswp.currIndex].caption;
          caption.hidden = !caption.textContent;
        });
      },
    });
  });

  viewer.on('afterInit', () => {
    viewer.element?.removeAttribute('role');
    viewer.element?.querySelector('.pswp__counter')?.setAttribute('aria-live', 'polite');
    viewer.element?.focus({ preventScroll: true });
  });

  dialog.addEventListener('dblclick', event => {
    const slide = viewer.currSlide;
    if (viewer.opener.isOpen && slide && event.target === slide.content.element) {
      slide.toggleZoom({ x: event.clientX, y: event.clientY });
    }
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (viewer.opener.isOpen) viewer.close();
    else if (viewer.opener.isOpening) viewer.on('openingAnimationEnd', () => queueMicrotask(() => viewer.close()));
  });

  function restore() {
    dialog.close();
    dialog.remove();
    root.style.removeProperty('--image-viewer-scrollbar');
    scrollTo(position);
    trigger.focus({ preventScroll: true });
  }
  viewer.on('destroy', restore);
  document.body.append(dialog);
  try {
    // Reserve only the space that an existing scrollbar actually used.
    root.style.setProperty('--image-viewer-scrollbar', `${scrollbarWidth}px`);
    dialog.showModal();
    viewer.init();
  } catch (error) {
    restore();
    throw error;
  }
}
