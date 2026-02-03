/**
 * Dedicated Messenger Media Gallery Script
 * Custom version for /account/messages to handle specific needs and avoid conflicts.
 */

class MessengerMediaGallery {
    constructor(mediaItems = []) {
        this.mediaItems = mediaItems || [];
        this.currentIndex = 0;
        this.modalId = 'messenger-media-gallery-modal'; // Unique ID to avoid conflicts
        this.isPlaying = false;
        this.autoPlayTimer = null;
        this.elementCache = new Map();
        this.borrowedElements = new Map(); // Store metadata for borrowed elements
        this.cacheName = 'messenger-media-gallery-v1';
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
        if (document.getElementById('messenger-gallery-styles')) return;
        const style = document.createElement('style');
        style.id = 'messenger-gallery-styles';
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
        // Check if modal exists
        let modal = document.getElementById(this.modalId);

        // If it exists, we must ensure THIS instance controls it.
        // The safest way is to replace the old buttons to clear old listeners
        if (modal) {
            const controls = modal.querySelector('.gallery-controls');
            const newControls = controls.cloneNode(true);
            controls.parentNode.replaceChild(newControls, controls);

            // Re-bind listeners to new elements
            newControls.querySelector('.gallery-close').addEventListener('click', this.close);
            newControls.querySelector('.gallery-prev').addEventListener('click', this.prev);
            newControls.querySelector('.gallery-next').addEventListener('click', this.next);
            return;
        }

        modal = document.createElement('div');
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
        this.mediaItems = items || [];
        this.elementCache.clear();
        const container = document.getElementById(this.modalId)?.querySelector('.gallery-content-wrapper');
        if (container) container.innerHTML = '';
    }

    open(index = 0) {
        if (!this.mediaItems || this.mediaItems.length === 0) return;

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

        // Return borrowed elements
        for (const index of this.borrowedElements.keys()) {
            this.returnElement(index);
        }
        this.borrowedElements.clear();

        document.removeEventListener('keydown', this.handleKeydown);
    }

    next(e) {
        if (e) e.stopPropagation();
        if (!this.mediaItems || this.mediaItems.length === 0) return; // CRASH GUARD

        const prevIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.mediaItems.length;

        // Pause previous if it was a video
        this.pauseElementAtIndex(prevIndex);

        this.render();
    }

    prev(e) {
        if (e) e.stopPropagation();
        if (!this.mediaItems || this.mediaItems.length === 0) return; // CRASH GUARD

        const prevIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex - 1 + this.mediaItems.length) % this.mediaItems.length;

        this.pauseElementAtIndex(prevIndex);

        this.render();
    }

    pauseElementAtIndex(index) {
        // Logic to pause borrowing is handled in render's "hide all children" step mostly
    }

    handleKeydown(e) {
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
    }

    borrowElement(index) {
        const item = this.mediaItems[index];
        if (!item || !item.elementId) return null;

        const originalEl = document.getElementById(item.elementId);
        if (!originalEl) return null;

        // Capture state
        const nextSibling = originalEl.nextSibling;
        const parent = originalEl.parentNode;

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

        originalEl.classList.remove('hidden');
        originalEl.classList.add('gallery-media');

        container.appendChild(originalEl);

        // Swap src for cached blob if available
        if (originalEl.tagName === 'VIDEO') {
            const srcUrl = originalEl.querySelector('source')?.src || originalEl.src;
            const blobUrl = this.mediaBlobUrls.get(srcUrl);
            if (blobUrl) {
                const meta = this.borrowedElements.get(index) || {};
                meta.savedOriginalSrc = srcUrl;
                this.borrowedElements.set(index, meta);
                try {
                    originalEl.pause();
                    originalEl.removeAttribute('src');
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

        // Restore
        element.className = originalClasses;
        element.style.display = originalStyles.display;
        element.style.width = originalStyles.width;
        element.style.height = originalStyles.height;
        if (element.tagName === 'VIDEO') {
            element.pause();
        }

        // Move back
        if (originalNextSibling) {
            originalParent.insertBefore(element, originalNextSibling);
        } else {
            originalParent.appendChild(element);
        }

        this.borrowedElements.delete(index);
    }

    async prefetchVideos() {
        try {
            if (!this.mediaItems) return;
            for (const item of this.mediaItems) {
                if (!item) continue;
                const isVideo = item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm|mov)$/i));
                if (isVideo && item.url) {
                    this.ensureCachedVideo(item.url).catch(err => {
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

            const resp = await fetch(url, { credentials: 'same-origin' });
            if (!resp || (!resp.ok && resp.type !== 'opaque')) {
                return null;
            }

            try {
                //    await cache.put(url, resp.clone());
            } catch (e) {
                console.debug('cache.put skipped');
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
        if (!this.mediaItems || this.mediaItems.length === 0) return; // CRASH GUARD

        const modal = document.getElementById(this.modalId);
        const container = modal.querySelector('.gallery-content-wrapper');
        const counter = modal.querySelector('.gallery-counter');
        const item = this.mediaItems[this.currentIndex];

        counter.textContent = `${this.currentIndex + 1} / ${this.mediaItems.length}`;

        // Hide all existing children
        Array.from(container.children).forEach(child => {
            child.style.display = 'none';
            if (child.tagName === 'VIDEO') {
                child.pause();
            }
        });

        let mediaEl;

        // Borrow if possible
        if (item.type === 'video' && item.elementId) {
            if (this.borrowedElements.has(this.currentIndex)) {
                const data = this.borrowedElements.get(this.currentIndex);
                mediaEl = data.element;
                mediaEl.style.display = 'block';
            } else {
                mediaEl = this.borrowElement(this.currentIndex);
            }
        }

        // Found/Borrowed successfully
        if (mediaEl) {
            mediaEl.style.display = 'block';
            if (mediaEl.tagName === 'VIDEO') {
                mediaEl.play().catch(e => console.log('Autoplay blocked', e));
            }
            return;
        }

        // Check cache
        if (this.elementCache.has(this.currentIndex)) {
            mediaEl = this.elementCache.get(this.currentIndex);
            mediaEl.style.display = 'block';
        } else {
            // Create new
            const isVideo = item.type === 'video' || (item.url && item.url.match(/\.(mp4|webm|mov)$/i));
            const isEmbed = item.url && (item.url.includes('youtube') || item.url.includes('vimeo'));

            if (isEmbed) {
                // Embed logic simplified for brevity
                mediaEl = document.createElement('iframe');
                mediaEl.src = item.url;
                mediaEl.className = 'gallery-media';
            } else if (isVideo) {
                mediaEl = document.createElement('video');
                mediaEl.controls = true;
                mediaEl.autoplay = false;
                mediaEl.className = 'gallery-media';

                const blobUrl = await this.ensureCachedVideo(item.url).catch(() => null);
                if (blobUrl) {
                    mediaEl.src = blobUrl;
                } else {
                    mediaEl.src = item.url;
                }
            } else {
                mediaEl = document.createElement('img');
                mediaEl.src = item.url;
                mediaEl.className = 'gallery-media';
            }

            this.elementCache.set(this.currentIndex, mediaEl);
            container.appendChild(mediaEl);
        }

        // Preload next image
        const nextIndex = (this.currentIndex + 1) % this.mediaItems.length;
        if (!this.elementCache.has(nextIndex) && !this.borrowedElements.has(nextIndex)) {
            const nextItem = this.mediaItems[nextIndex];
            if (nextItem && nextItem.type !== 'video' && !nextItem.url.includes('youtube')) {
                const preloadImg = new Image();
                preloadImg.src = nextItem.url;
            }
        }
    }
}

// Attach to window
window.MessengerMediaGallery = MessengerMediaGallery;
