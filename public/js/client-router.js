/**
 * Enhanced Client-Side Router for Hybrid SSR/CSR Navigation
 * Features:
 * - Top progress bar for instant feedback
 * - Skeleton screens for perceived performance
 * - Loading overlays for slow connections
 * - Smooth page transitions
 * - Link prefetching on hover
 * - Intelligent error handling
 */

(function() {
  'use strict';

  // Router state
  let isNavigating = false;
  let currentUrl = window.location.href;
  let prefetchCache = new Map(); // URL -> Promise<PageData>
  let prefetchTimeouts = new Map(); // Link element -> timeout ID

  // Loading state timers
  let skeletonTimer = null;
  let overlayTimer = null;
  let loadingOverlay = null;

  // Configuration
  const CONFIG = {
    // Selector for main content container
    contentSelector: 'main, #page-content, [role="main"]',
    // Selector for links that should be handled by router
    linkSelector: 'a[href^="/"]:not([href^="//"]):not([target="_blank"]):not([data-no-router])',
    // Loading indicator class
    loadingClass: 'router-loading',
    // Timing thresholds (ms)
    skeletonDelay: 150, // Show skeleton after 150ms if still loading
    overlayDelay: 500,  // Show overlay after 500ms if still loading
    prefetchDelay: 100, // Prefetch after 100ms hover
    // Animation durations (ms)
    fadeOutDuration: 150,
    fadeInDuration: 200,
  };

  /**
   * Create loading overlay element
   */
  function createLoadingOverlay() {
    if (loadingOverlay) return loadingOverlay;

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="spinner"></div>
    `;
    document.body.appendChild(loadingOverlay);
    return loadingOverlay;
  }

  /**
   * Show loading overlay
   */
  function showLoadingOverlay() {
    const overlay = createLoadingOverlay();
    // Force reflow for CSS transition
    overlay.offsetHeight;
    overlay.classList.add('active');
  }

  /**
   * Hide loading overlay
   */
  function hideLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
    }
  }

  /**
   * Find main content container (excluding header/footer)
   */
  function findContentContainer() {
    // Try multiple selectors
    const selectors = [
      'main',
      '#page-content',
      '[role="main"]',
      '#__next > main',
      '#__next > div > main',
      '.main-content',
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    
    // Fallback: find content div in #__next (not header/footer)
    const nextDiv = document.querySelector('#__next');
    if (nextDiv) {
      const children = Array.from(nextDiv.children);
      
      // Skip header (first) and footer (last), get content (middle)
      if (children.length > 2) {
        // Find the middle child that's not header or footer
        for (let i = 1; i < children.length - 1; i++) {
          const child = children[i];
          if (!child.closest('header') && !child.closest('footer')) {
            return child;
          }
        }
        // If all middle children are header/footer, return middle one anyway
        return children[Math.floor(children.length / 2)];
      } else if (children.length === 2) {
        // Two children: likely header and content (or content and footer)
        // Return the one that's not header/footer
        return children.find(child => 
          !child.closest('header') && !child.closest('footer')
        ) || children[1]; // Default to second child
      } else if (children.length === 1) {
        // Single child: check if it has nested content
        const nested = children[0].querySelector('main, [role="main"]');
        if (nested) return nested;
        return children[0];
    }
    }
    
    // Final fallback
    return document.body;
  }

  /**
   * Show loading indicator with multi-stage approach
   */
  function showLoading(url) {
    // Stage 1: Start progress bar immediately
    if (window.ProgressBar) {
      window.ProgressBar.start();
    }

    // Stage 2: Show skeleton screen after delay (if still loading)
    skeletonTimer = setTimeout(() => {
      if (isNavigating && window.SkeletonScreens) {
        window.SkeletonScreens.show(new URL(url, window.location.origin).pathname);
      }
    }, CONFIG.skeletonDelay);

    // Stage 3: Show loading overlay after longer delay (for slow connections)
    overlayTimer = setTimeout(() => {
      if (isNavigating) {
        showLoadingOverlay();
      }
    }, CONFIG.overlayDelay);

    // Add loading class to main content (but not header/footer)
    const container = findContentContainer();
    if (container && 
        !container.closest('header') && 
        !container.closest('footer') &&
        container.id !== 'header' &&
        container.id !== 'footer') {
      container.classList.add(CONFIG.loadingClass);
      container.classList.add('no-select');
    }
  }

  /**
   * Hide all loading indicators
   */
  function hideLoading() {
    // Clear timers
    if (skeletonTimer) {
      clearTimeout(skeletonTimer);
      skeletonTimer = null;
    }
    if (overlayTimer) {
      clearTimeout(overlayTimer);
      overlayTimer = null;
    }

    // Hide skeleton screen
    if (window.SkeletonScreens) {
      window.SkeletonScreens.hide();
    }

    // Hide loading overlay
    hideLoadingOverlay();

    // Complete progress bar
    if (window.ProgressBar) {
      window.ProgressBar.done();
    }

    // Remove loading class from main content (but not header/footer)
    const container = findContentContainer();
    if (container && 
        !container.closest('header') && 
        !container.closest('footer') &&
        container.id !== 'header' &&
        container.id !== 'footer') {
      container.classList.remove(CONFIG.loadingClass);
      container.classList.remove('no-select');
    }
  }

  /**
   * Show error overlay with retry option
   */
  function showErrorOverlay(errorMessage, retryUrl) {
    // Create error overlay if it doesn't exist
    let errorOverlay = document.getElementById('router-error-overlay');
    if (!errorOverlay) {
      errorOverlay = document.createElement('div');
      errorOverlay.id = 'router-error-overlay';
      errorOverlay.className = 'error-overlay';
      document.body.appendChild(errorOverlay);
    }

    errorOverlay.innerHTML = `
      <div class="error-overlay-content">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3>Unable to Load Page</h3>
        <p>${errorMessage || 'Something went wrong while loading this page. Please try again.'}</p>
        <div class="error-overlay-actions">
          <button class="btn-primary" onclick="window.clientRouter.retry('${retryUrl}')">
            Retry
          </button>
          <button class="btn-secondary" onclick="window.clientRouter.hideError()">
            Cancel
          </button>
        </div>
      </div>
    `;

    // Show overlay with animation
    setTimeout(() => {
      errorOverlay.classList.add('active');
    }, 10);
  }

  /**
   * Hide error overlay
   */
  function hideErrorOverlay() {
    const errorOverlay = document.getElementById('router-error-overlay');
    if (errorOverlay) {
      errorOverlay.classList.remove('active');
      setTimeout(() => {
        if (errorOverlay.parentNode) {
          errorOverlay.parentNode.removeChild(errorOverlay);
        }
      }, 300);
    }
  }

  /**
   * Update page title
   */
  function updateTitle(title) {
    if (title && document.title !== title) {
      document.title = title;
    }
  }

  /**
   * Update meta tags
   */
  function updateMetaTags(meta) {
    if (!meta) return;

    // Update description
    if (meta.description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', meta.description);
    }

    // Update keywords
    if (meta.keywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.setAttribute('name', 'keywords');
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.setAttribute('content', meta.keywords);
    }

    // Update Open Graph tags
    if (meta.ogTitle) {
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (!ogTitle) {
        ogTitle = document.createElement('meta');
        ogTitle.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitle);
      }
      ogTitle.setAttribute('content', meta.ogTitle);
    }

    if (meta.ogDescription) {
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        ogDesc = document.createElement('meta');
        ogDesc.setAttribute('property', 'og:description');
        document.head.appendChild(ogDesc);
      }
      ogDesc.setAttribute('content', meta.ogDescription);
    }
  }

  /**
   * Update canonical link
   */
  function updateCanonical(canonical) {
    if (!canonical) return;

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonical);
  }

  /**
   * Update structured data
   */
  function updateStructuredData(structuredData) {
    if (!structuredData) return;

    // Remove existing structured data scripts (keep organization schema)
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        // Keep organization schema, remove others
        if (data['@type'] === 'Organization') {
          return;
        }
        script.remove();
      } catch (e) {
        // If parsing fails, remove it
        script.remove();
      }
    });

    // Add new structured data
    if (structuredData) {
      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(structuredData, null, 2);
      document.head.appendChild(script);
    }
  }

  /**
   * Update page content with smooth transitions
   */
  function updateContent(html) {
    const container = findContentContainer();
    if (!container) {
      console.error('Router: Could not find content container');
      return false;
    }

    // Fade out current content
    container.classList.add('page-fade-out');

    // Wait for fade out animation
    setTimeout(() => {
    // Create temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Extract main content (remove header/footer if present)
    let content = temp.innerHTML;
    
    // If temp contains a main element, use that
    const mainElement = temp.querySelector('main, [role="main"]');
    if (mainElement) {
      content = mainElement.innerHTML;
      } else {
        // If no main element, try to extract content from #__next structure
        const nextDiv = temp.querySelector('#__next');
        if (nextDiv) {
          const children = Array.from(nextDiv.children);
          // Get middle content (skip header/footer)
          if (children.length > 2) {
            const contentChild = children[Math.floor(children.length / 2)];
            if (contentChild) {
              content = contentChild.innerHTML;
            }
          } else if (children.length === 2) {
            // Two children: likely header and content
            const contentChild = children.find(child => 
              !child.closest('header') && !child.closest('footer')
            ) || children[1];
            if (contentChild) {
              content = contentChild.innerHTML;
            }
          }
        }
      }

      // Only update if we have valid content
      // Also ensure we're not replacing header or footer
      if (content && content.trim() && 
          !container.closest('header') && 
          !container.closest('footer') &&
          container.id !== 'header' &&
          container.id !== 'footer') {
    container.innerHTML = content;
      } else {
        console.warn('Router: No content extracted or container is header/footer, skipping update');
        container.classList.remove('page-fade-out');
        return false;
      }
      
      // Remove fade-out class and add fade-in
      container.classList.remove('page-fade-out');
      container.classList.add('page-fade-in');

      // Remove fade-in class after animation completes
      setTimeout(() => {
        container.classList.remove('page-fade-in');
      }, CONFIG.fadeInDuration);

    // Re-initialize any scripts that need to run
    initializePageScripts();
    }, CONFIG.fadeOutDuration);

    return true;
  }

  /**
   * Initialize page-specific scripts after navigation
   */
  function initializePageScripts() {
    // Re-attach event listeners to new content
    attachLinkListeners();
    attachPrefetchListeners();

    // Trigger custom event for page initialization
    window.dispatchEvent(new CustomEvent('router:page-loaded', {
      detail: { url: currentUrl }
    }));

    // Re-initialize Google Sign-In if present
    if (window.google && window.google.accounts && window.GOOGLE_CLIENT_ID) {
      const googleButton = document.getElementById('google-signin-button');
      if (googleButton && !googleButton.hasChildNodes()) {
        try {
          window.google.accounts.id.initialize({
            client_id: window.GOOGLE_CLIENT_ID,
            callback: window.handleGoogleSignIn || (() => {})
          });
          window.google.accounts.id.renderButton(
            googleButton,
            { theme: 'outline', size: 'large', width: '100%' }
          );
        } catch (err) {
          console.error('Failed to re-initialize Google Sign-In:', err);
        }
      }
    }
    }

  /**
   * Fetch page data (with caching support)
   */
  async function fetchPageData(url) {
    // Check prefetch cache first
    if (prefetchCache.has(url)) {
      console.log('Router: Using prefetched data for', url);
      const cachedPromise = prefetchCache.get(url);
      prefetchCache.delete(url); // Use once, then remove
      return await cachedPromise;
    }

      // Fetch page data with JSON accept header
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest', // CSR detection header
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      
    // If response is HTML (fallback), return as full page load signal
      if (contentType.includes('text/html')) {
      return { isFullPageLoad: true };
    }

    // Parse JSON response
    const pageData = await response.json();
    return pageData;
  }

  /**
   * Navigate to a URL
   */
  async function navigate(url, pushState = true) {
    // CRITICAL: Don't navigate if router not initialized (prevents issues on page load)
    if (!window.__ROUTER_INITIALIZED__) {
      console.log('Router: Not initialized yet, using full page load');
      window.location.href = url;
      return;
    }
    
    if (isNavigating) {
      console.log('Router: Navigation already in progress, ignoring');
      return;
    }

    // Don't navigate to same URL
    if (url === currentUrl) {
      console.log('Router: Already on this URL');
      return;
    }

    // Parse URL
    let targetUrl;
    try {
      targetUrl = new URL(url, window.location.origin);
    } catch (e) {
      console.error('Router: Invalid URL', url);
      return;
    }

    // Only handle same-origin URLs
    if (targetUrl.origin !== window.location.origin) {
      console.log('Router: External URL, using full page load');
      window.location.href = url;
      return;
    }

    console.log('Router: Navigating to', url);
    isNavigating = true;

    // Start loading indicators
    showLoading(url);

    try {
      // Fetch page data
      const pageData = await fetchPageData(url);

      // If server returned HTML instead of JSON, do full page load
      if (pageData.isFullPageLoad) {
        console.log('Router: Server returned HTML, doing full page load');
        // Clear loading state before redirect
        hideLoading();
        window.location.href = url;
        return;
      }

      // Update page content with fade transition
      const success = updateContent(pageData.html);
      if (!success) {
        throw new Error('Failed to update page content');
      }

      // Update meta information (parallel - don't block rendering)
      Promise.all([
        Promise.resolve(updateTitle(pageData.title)),
        Promise.resolve(updateMetaTags(pageData.meta)),
        Promise.resolve(updateCanonical(pageData.canonical)),
        Promise.resolve(pageData.structuredData && updateStructuredData(pageData.structuredData)),
      ]).catch(err => {
        console.warn('Router: Error updating meta tags:', err);
      });

      // Update URL in browser
      if (pushState) {
        window.history.pushState({ url: url }, '', url);
      }

      currentUrl = url;

      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Track page view (if analytics present)
      if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
          page_path: targetUrl.pathname,
          page_location: url,
        });
      }

    } catch (error) {
      console.error('Router navigation error:', error);
      
      // Check if it's a network error or server error
      const isNetworkError = error.message.includes('fetch') || 
                            error.message.includes('Network') ||
                            error.message.includes('Failed to fetch');
      
      const isServerError = error.message.includes('HTTP 5');
      const is404 = error.message.includes('HTTP 404');

      if (is404) {
        // For 404s, do full page load to show proper 404 page
        console.log('Router: 404 error, doing full page load');
        window.location.href = url;
      } else if (isNetworkError || isServerError) {
        // Show error overlay with retry option
        hideLoading();
        const errorMsg = isNetworkError 
          ? 'Unable to connect. Please check your internet connection.'
          : 'Server error occurred. Please try again.';
        showErrorOverlay(errorMsg, url);
      } else {
        // Unknown error - fallback to full page load
        console.log('Router: Unknown error, doing full page load');
      window.location.href = url;
      }
    } finally {
      isNavigating = false;
      // Hide loading indicators (with delay to prevent flash)
      setTimeout(() => {
        if (!isNavigating) {
      hideLoading();
    }
      }, 50);
    }
  }

  /**
   * Prefetch page data for faster navigation
   */
  function prefetchPage(url) {
    // Don't prefetch if already navigating or already cached
    if (isNavigating || prefetchCache.has(url)) {
      return;
    }

    // Don't prefetch external URLs
    try {
      const targetUrl = new URL(url, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        return;
      }
    } catch (e) {
      return;
    }

    console.log('Router: Prefetching', url);

    // Start fetching and cache the promise
    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/html',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
    })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        return { isFullPageLoad: true };
      }
      return await response.json();
    })
    .catch(err => {
      console.warn('Router: Prefetch failed for', url, err);
      // Remove from cache on error
      prefetchCache.delete(url);
      return null;
    });

    // Cache the promise (not the result)
    prefetchCache.set(url, fetchPromise);

    // Clear cache after 10 seconds if not used
    setTimeout(() => {
      if (prefetchCache.has(url)) {
        prefetchCache.delete(url);
        console.log('Router: Prefetch cache expired for', url);
      }
    }, 10000);
  }

  /**
   * Handle browser back/forward buttons
   */
  function handlePopState(event) {
    const url = window.location.href;
    console.log('Router: Browser back/forward to', url);
    navigate(url, false);
  }

  /**
   * Handle link clicks
   */
  function handleLinkClick(event) {
    const link = event.currentTarget;
    const href = link.getAttribute('href');

    // Skip if:
    // - External link
    // - Has target="_blank"
    // - Has data-no-router attribute
    // - Ctrl/Cmd + click (open in new tab)
    // - Middle mouse button
    // - Starts with # (anchor)
    // - mailto: or tel: links
    // - API routes
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('/api/') ||
      href.startsWith('//') ||
      href.startsWith('http') && !href.startsWith(window.location.origin) ||
      link.getAttribute('target') === '_blank' ||
      link.hasAttribute('data-no-router') ||
      event.ctrlKey ||
      event.metaKey ||
      event.button !== 0
    ) {
      return;
    }

    // Only handle same-origin links
    try {
      const linkUrl = new URL(href, window.location.origin);
      if (linkUrl.origin !== window.location.origin) {
        return;
      }
    } catch (e) {
      return;
    }

    event.preventDefault();
    navigate(href);
  }

  /**
   * Handle link hover for prefetching
   */
  function handleLinkHover(event) {
    const link = event.currentTarget;
    const href = link.getAttribute('href');

    // Skip invalid links
    if (!href || 
        href.startsWith('#') || 
        href.startsWith('mailto:') || 
        href.startsWith('tel:') ||
        href.startsWith('/api/') ||
        link.hasAttribute('data-no-prefetch') ||
        link.getAttribute('target') === '_blank') {
      return;
    }

    // Clear any existing timeout for this link
    if (prefetchTimeouts.has(link)) {
      clearTimeout(prefetchTimeouts.get(link));
    }

    // Set timeout for prefetch
    const timeoutId = setTimeout(() => {
      prefetchPage(href);
      prefetchTimeouts.delete(link);
    }, CONFIG.prefetchDelay);

    prefetchTimeouts.set(link, timeoutId);
  }

  /**
   * Handle link mouse leave (cancel prefetch if not started)
   */
  function handleLinkLeave(event) {
    const link = event.currentTarget;
    
    // Clear prefetch timeout if exists
    if (prefetchTimeouts.has(link)) {
      clearTimeout(prefetchTimeouts.get(link));
      prefetchTimeouts.delete(link);
    }
  }

  /**
   * Attach click listeners to links
   */
  function attachLinkListeners() {
    // Use event delegation on document body for clicks
    // Note: This is already set up in init(), just ensure new links work
  }

  /**
   * Attach prefetch listeners to links
   */
  function attachPrefetchListeners() {
    // Prevent duplicate listeners
    if (window.__PREFETCH_LISTENERS_ATTACHED__) {
      return;
    }
    window.__PREFETCH_LISTENERS_ATTACHED__ = true;
    
    // Use event delegation for hover events
    document.body.addEventListener('mouseenter', (event) => {
      const link = event.target.closest('a[href]');
      if (link) {
        handleLinkHover({ currentTarget: link });
      }
    }, true); // Use capture phase

    document.body.addEventListener('mouseleave', (event) => {
      const link = event.target.closest('a[href]');
      if (link) {
        handleLinkLeave({ currentTarget: link });
      }
    }, true); // Use capture phase
  }

  /**
   * Initialize router
   */
  function init() {
    // Prevent double initialization
    if (window.__ROUTER_INITIALIZED__) {
      console.log('Router already initialized, skipping');
      return;
    }
    
    // Attach link listeners using event delegation
    document.body.addEventListener('click', (event) => {
      // Find the closest link
      const link = event.target.closest('a[href]');
      if (!link) return;

      // Check if link should be handled by router
      const href = link.getAttribute('href');
      if (!href) return;

      // Create a pseudo-event for handleLinkClick
      handleLinkClick({ 
        currentTarget: link, 
        preventDefault: () => event.preventDefault(), 
        ctrlKey: event.ctrlKey, 
        metaKey: event.metaKey, 
        button: event.button 
      });
    });

    // Attach prefetch listeners
    attachPrefetchListeners();

    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Add smooth scroll class to html
    document.documentElement.classList.add('smooth-scroll');

    // Mark that router is initialized
    window.__ROUTER_INITIALIZED__ = true;

    console.log('Enhanced client router initialized');
  }

  /**
   * Retry navigation after error
   */
  function retry(url) {
    hideErrorOverlay();
    navigate(url);
  }

  // Initialize when DOM is ready (but after page fully loaded to avoid interfering with SSR)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait a tick to ensure all SSR content is rendered
      setTimeout(init, 0);
    });
  } else {
    // If DOM already loaded, init immediately
    setTimeout(init, 0);
  }

  // Export for external use
  window.clientRouter = {
    navigate: navigate,
    isNavigating: () => isNavigating,
    prefetch: prefetchPage,
    retry: retry,
    hideError: hideErrorOverlay,
  };

})();
