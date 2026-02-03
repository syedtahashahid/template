/**
 * Standalone Media Gallery Script for CarrierInfo
 * Usage: 
 *   const gallery = new MediaGallery(items);
 *   gallery.open(startIndex);
 */

class MediaGallery {
  constructor(mediaItems = []) {
    this.mediaItems = mediaItems;
    this.currentIndex = 0;
    this.modalId = 'unified-media-gallery-modal';
    this.isPlaying = false;
    this.autoPlayTimer = null;
    this.elementCache = new Map();
    this.borrowedElements = new Map(); // Store metadata for borrowed elements
    this.cacheName = 'media-gallery-v1';
    this.mediaBlobUrls = new Map(); // url -> objectUrl

    // Bind methods
    this.handleKeydown = this.handleKeydown.bind(this);
    this.close = this.close.bind(this);
    this.next = this.next.bind(this);
    this.prev = this.prev.bind(this);

    // Inject CSS
    this.injectStyles();

    // Create Modal DOM if not exists
    this.createModal();

    // Start background prefetch of video assets
    this.prefetchVideos();
  }

  injectStyles() {
    if (document.getElementById('media-gallery-styles')) return;
    const style = document.createElement('style');
    style.id = 'media-gallery-styles';
    style.textContent = `
      #${this.modalId} {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background-color: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      #${this.modalId}.open {
        opacity: 1;
        pointer-events: auto;
      }
      .gallery-controls {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }
      .gallery-btn {
        pointer-events: auto;
        background: rgba(0, 0, 0, 0.5);
        border: none;
        color: white;
        cursor: pointer;
        padding: 1rem;
        border-radius: 50%;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .gallery-btn:hover {
        background: rgba(0, 0, 0, 0.8);
      }
      .gallery-close {
        position: absolute;
        top: 20px;
        right: 20px;
        z-index: 10001;
      }
      .gallery-prev, .gallery-next {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10000;
        width: 50px;
        height: 50px;
      }
      .gallery-prev { left: 20px; }
      .gallery-next { right: 20px; }
      
      .gallery-content-wrapper {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .gallery-media {
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 4px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      
      .gallery-counter {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        background: rgba(0, 0, 0, 0.5);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 14px;
      }
      
      @media (max-width: 768px) {
        .gallery-prev, .gallery-next {
           width: 40px;
           height: 40px;
           padding: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  createModal() {
    if (document.getElementById(this.modalId)) return;

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.innerHTML = `
      <div class="gallery-controls">
        <button class="gallery-btn gallery-close" aria-label="Close">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <button class="gallery-btn gallery-prev" aria-label="Previous">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <button class="gallery-btn gallery-next" aria-label="Next">
          <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"></path></svg>
        </button>
        <div class="gallery-counter"></div>
      </div>
      <div class="gallery-content-wrapper"></div>
    `;
    document.body.appendChild(modal);

    // Event Listeners
    modal.querySelector('.gallery-close').addEventListener('click', this.close);
    modal.querySelector('.gallery-prev').addEventListener('click', this.prev);
    modal.querySelector('.gallery-next').addEventListener('click', this.next);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('gallery-content-wrapper')) {
        this.close();
      }
    });
  }

  setItems(items) {
    this.mediaItems = items;
    this.elementCache.clear();
    const container = document.getElementById(this.modalId)?.querySelector('.gallery-content-wrapper');
    if (container) container.innerHTML = '';
  }

  open(index = 0) {
    if (!this.mediaItems.length) return;

    // Validate index
    if (index < 0) index = 0;
    if (index >= this.mediaItems.length) index = 0;

    this.currentIndex = index;
    const modal = document.getElementById(this.modalId);
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', this.handleKeydown);

    this.render();
  }

  close() {
    const modal = document.getElementById(this.modalId);
    modal.classList.remove('open');
    document.body.style.overflow = '';

    // Only pause iframes
    const container = modal.querySelector('.gallery-content-wrapper');
    if (container) {
      container.querySelectorAll('iframe').forEach(iframe => {
        // Reset src to stop playback
        const src = iframe.src;
        iframe.src = src;
      });
    }

    // Return all borrowed elements to their original homes
    // We iterate through all keys in map and return them
    // This ensures if user browsed multiple videos, all go back
    for (const index of this.borrowedElements.keys()) {
      this.returnElement(index);
    }
    this.borrowedElements.clear();

    document.removeEventListener('keydown', this.handleKeydown);
  }

  next(e) {
    if (e) e.stopPropagation();
    // Return current element before moving?
    // Optionally return it to keep DOM clean, or keep it borrowed to allow faster back-nav.
    // User requested "uses the video it cached". 
    // Keeping it "borrowed" (in Gallery DOM) is fine as long as we hide it.
    // BUT, if we keep it in Gallery DOM, it's NOT in the original list.
    // If the Gallery is translucent or small, the list looks empty.
    // But Gallery is fullscreen opaque (rgba 0,0,0,0.95). So user won't see the hole in the list.
    // So we can keep it borrowed.

    // However, to ensure background loading continues correctly for ALL items, it might be safer to keep them borrowed.
    // BUT we must hide the previous one.

    const prevIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.mediaItems.length;

    // Pause previous if it was a video
    this.pauseElementAtIndex(prevIndex);

    this.render();
  }

  prev(e) {
    if (e) e.stopPropagation();
    const prevIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex - 1 + this.mediaItems.length) % this.mediaItems.length;

    this.pauseElementAtIndex(prevIndex);

    this.render();
  }

  pauseElementAtIndex(index) {
    if (this.borrowedElements.has(index)) {
      const { meta } = this.borrowedElements.get(index);
      // Metadata doesn't store the element reference directly, but we can find it in container
      // Actually, we should store element ref.
      // Let's look in container
      // It's easier to just find all videos in container and pause them, except current?
      // We do that in render() by hiding and pausing all children.
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }

  borrowElement(index) {
    const item = this.mediaItems[index];
    if (!item.elementId) return null; // Not borrowable

    const originalEl = document.getElementById(item.elementId);
    if (!originalEl) return null; // Can't find it

    // Capture state
    const nextSibling = originalEl.nextSibling;
    const parent = originalEl.parentNode;

    // We must check if it's already borrowed?
    // If it's already in the gallery container, we don't need to move it.
    const container = document.getElementById(this.modalId).querySelector('.gallery-content-wrapper');
    if (originalEl.parentNode === container) {
      return originalEl;
    }

    // Save metadata
    this.borrowedElements.set(index, {
      element: originalEl,
      originalParent: parent,
      originalNextSibling: nextSibling,
      originalClasses: originalEl.className,
      originalStyles: {
        display: originalEl.style.display,
        width: originalEl.style.width,
        height: originalEl.style.height
      }
    });

    // Modify for gallery
    // We need it to look like .gallery-media
    // Preserve "hidden" class? No, we need to show it.
    originalEl.classList.remove('hidden');
    originalEl.classList.add('gallery-media');

    // Move it!
    container.appendChild(originalEl);

    // If we have a cached blob URL for this video, replace src to avoid network re-request
    if (originalEl.tagName === 'VIDEO') {
      const srcUrl = originalEl.querySelector('source')?.src || originalEl.src;
      const blobUrl = this.mediaBlobUrls.get(srcUrl);
      if (blobUrl) {
        // Save original src so we can restore later
        const meta = this.borrowedElements.get(index) || {};
        meta.savedOriginalSrc = srcUrl;
        this.borrowedElements.set(index, meta);
        try {
          originalEl.pause();
          originalEl.removeAttribute('src');
          // Remove existing <source> children to avoid double-requests
          Array.from(originalEl.querySelectorAll('source')).forEach(s => s.remove());
          originalEl.src = blobUrl;
          originalEl.load();
        } catch (e) {
          console.warn('Failed to attach blob URL to borrowed video', e);
        }
      }
    }
    return originalEl;
  }

  returnElement(index) {
    if (!this.borrowedElements.has(index)) return;

    const data = this.borrowedElements.get(index);
    const { element, originalParent, originalNextSibling, originalClasses, originalStyles } = data;

    if (!element || !originalParent) return;

    // Restore styling
    element.className = originalClasses;
    element.style.display = originalStyles.display;
    element.style.width = originalStyles.width;
    element.style.height = originalStyles.height;
    if (element.tagName === 'VIDEO') {
      element.pause(); // Pause when returning to list
      // Keep any blob URL attached so reopening won't re-fetch the remote resource.
      // We intentionally do NOT restore the original remote src here to avoid
      // causing the browser to request the network resource again. The original
      // source URL is stored in metadata (`savedOriginalSrc`) if needed later.
      // Ensure controls are whatever they were (likely true)
    }

    // Move back
    if (originalNextSibling) {
      originalParent.insertBefore(element, originalNextSibling);
    } else {
      originalParent.appendChild(element);
    }

    this.borrowedElements.delete(index);
  }

  // Prefetch video assets into Cache Storage and create object URLs for playback
  async prefetchVideos() {
    try {
      for (const item of this.mediaItems) {
        if (!item) continue;
        const isVideo = item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm|mov)$/i));
        if (isVideo && item.url) {
          this.ensureCachedVideo(item.url).catch(err => {
            // Don't fail overall prefetch if one fails
            console.debug('prefetch video failed', item.url, err);
          });
        }
      }
    } catch (e) {
      console.warn('prefetchVideos error', e);
    }
  }

  async ensureCachedVideo(url) {
    if (!url) return null;
    if (this.mediaBlobUrls.has(url)) return this.mediaBlobUrls.get(url);

    try {
      const cache = await caches.open(this.cacheName);
      const cached = await cache.match(url);
      if (cached) {
        const blob = await cached.blob();
        const objectUrl = URL.createObjectURL(blob);
        this.mediaBlobUrls.set(url, objectUrl);
        return objectUrl;
      }

      // Fetch from network and store in cache
      const resp = await fetch(url, { credentials: 'same-origin' });
      if (!resp || (!resp.ok && resp.type !== 'opaque')) {
        // store nothing but return null
        return null;
      }

      // Clone and store
      try {
        await cache.put(url, resp.clone());
      } catch (e) {
        // Some responses (opaque cross-origin) may not be puttable; ignore
        console.debug('cache.put failed', e);
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.mediaBlobUrls.set(url, objectUrl);
      return objectUrl;
    } catch (error) {
      console.warn('ensureCachedVideo error', url, error);
      return null;
    }
  }

  async render() {
    const modal = document.getElementById(this.modalId);
    const container = modal.querySelector('.gallery-content-wrapper');
    const counter = modal.querySelector('.gallery-counter');
    const item = this.mediaItems[this.currentIndex];

    counter.textContent = `${this.currentIndex + 1} / ${this.mediaItems.length}`;

    // 1. Hide all existing children in gallery
    Array.from(container.children).forEach(child => {
      child.style.display = 'none';
      if (child.tagName === 'VIDEO') {
        child.pause();
      }
    });

    let mediaEl;

    // Try to borrow first (if it's a video on the page)
    if (item.type === 'video' && item.elementId) {
      // Check if already borrowed (in our map)
      if (this.borrowedElements.has(this.currentIndex)) {
        // It is already here, just show it
        const data = this.borrowedElements.get(this.currentIndex);
        mediaEl = data.element;
        mediaEl.style.display = 'block';
      } else {
        // Try to borrow from page
        mediaEl = this.borrowElement(this.currentIndex);
      }
    }

    // If we successfully borrowed/found a borrowed element
    if (mediaEl) {
      mediaEl.style.display = 'block';
      if (mediaEl.tagName === 'VIDEO') {
        mediaEl.play().catch(e => console.log('Autoplay blocked', e));
      }
      return; // Done
    }

    // 2. Check if element exists in standard cache (for images/iframes)
    if (this.elementCache.has(this.currentIndex)) {
      mediaEl = this.elementCache.get(this.currentIndex);
      mediaEl.style.display = 'block'; // Show it
    } else {
      // 3. Create new element if not in cache (Images / Iframes / Non-list videos)
      // Check type
      const isVideo = item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm|mov)$/i));
      const isEmbed = item.url && (item.url.includes('youtube') || item.url.includes('vimeo'));

      if (isEmbed) {
        let embedUrl = item.url;
        if (item.url.includes('youtube.com/watch?v=')) {
          const videoId = item.url.split('v=')[1]?.split('&')[0];
          embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : item.url;
        } else if (item.url.includes('youtu.be/')) {
          const videoId = item.url.split('youtu.be/')[1]?.split('?')[0];
          embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : item.url;
        }
        mediaEl = document.createElement('iframe');
        mediaEl.src = embedUrl;
        mediaEl.className = 'gallery-media';
        mediaEl.allow = "autoplay; fullscreen";
      } else if (isVideo) {
        // Fallback for videos NOT in the list (shouldn't happen with current logic but good for safety)
        mediaEl = document.createElement('video');
        mediaEl.controls = true;
        mediaEl.autoplay = false;
        mediaEl.className = 'gallery-media';

        // Try to attach cached blob URL if available (await ensures we can use it immediately)
        const blobUrl = await this.ensureCachedVideo(item.url).catch(() => null);
        if (blobUrl) {
          mediaEl.src = blobUrl;
        } else {
          // Fallback to direct URL
          mediaEl.src = item.url;
        }
      } else {
        mediaEl = document.createElement('img');
        mediaEl.src = item.url;
        mediaEl.className = 'gallery-media';
      }

      // Add to cache and DOM
      this.elementCache.set(this.currentIndex, mediaEl);
      container.appendChild(mediaEl);
    }

    // Perform Preload of next item (Images only)
    const nextIndex = (this.currentIndex + 1) % this.mediaItems.length;
    if (!this.elementCache.has(nextIndex) && !this.borrowedElements.has(nextIndex)) {
      const nextItem = this.mediaItems[nextIndex];
      // Only preload images
      if (nextItem && nextItem.type !== 'video' && !nextItem.url.includes('youtube')) {
        const preloadImg = new Image();
        preloadImg.src = nextItem.url;
      }
    }
  }
}

// Attach to window
window.MediaGallery = MediaGallery;
