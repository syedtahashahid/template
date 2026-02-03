/**
 * Page Transition Utilities
 * Smooth animations and transitions for enhanced UX
 */

(function() {
  'use strict';

  /**
   * Initialize smooth scroll behavior
   */
  function initSmoothScroll() {
    // Add smooth scroll class to html element
    document.documentElement.classList.add('smooth-scroll');
    
    // Handle hash links with smooth scroll
    document.addEventListener('click', (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      
      const hash = anchor.getAttribute('href');
      if (!hash || hash === '#') return;
      
      const targetElement = document.querySelector(hash);
      if (targetElement) {
        e.preventDefault();
        
        // Smooth scroll to element
        const headerOffset = 80; // Account for fixed header
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        // Update URL hash
        if (history.pushState) {
          history.pushState(null, null, hash);
        }
      }
    });
  }

  /**
   * Add fade-in animation to elements as they scroll into view
   */
  function initScrollAnimations() {
    // Create Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          // Optionally unobserve after animation
          // observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements with data-animate attribute
    const animateElements = document.querySelectorAll('[data-animate]');
    animateElements.forEach(el => observer.observe(el));

    // Store observer globally for cleanup
    window.__scrollAnimationObserver = observer;
  }

  /**
   * Add loading states to buttons and forms
   */
  function initFormLoadingStates() {
    // Add loading state to all forms
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form.matches('form')) return;
      
      // Don't add loading if form has data-no-loading attribute
      if (form.hasAttribute('data-no-loading')) return;
      
      // Find submit button
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        // Save original text
        const originalText = submitBtn.textContent || submitBtn.value;
        submitBtn.setAttribute('data-original-text', originalText);
        
        // Add loading state
        submitBtn.disabled = true;
        submitBtn.classList.add('cursor-loading');
        
        // Update button text with loading indicator
        if (submitBtn.tagName === 'BUTTON') {
          submitBtn.innerHTML = `
            <span class="inline-flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading...</span>
            </span>
          `;
        }
      }
    });

    // Listen for form completion events to reset loading state
    window.addEventListener('form:complete', (e) => {
      const form = e.detail?.form;
      if (!form) return;
      
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('cursor-loading');
        
        const originalText = submitBtn.getAttribute('data-original-text');
        if (originalText) {
          if (submitBtn.tagName === 'BUTTON') {
            submitBtn.textContent = originalText;
          } else {
            submitBtn.value = originalText;
          }
          submitBtn.removeAttribute('data-original-text');
        }
      }
    });
  }

  /**
   * Add hover effects to interactive elements
   */
  function initHoverEffects() {
    // Add subtle lift effect to cards on hover
    const cards = document.querySelectorAll('[data-card], .card, .company-card');
    cards.forEach(card => {
      if (!card.classList.contains('hover-lift')) {
        card.classList.add('hover-lift');
      }
    });
  }

  /**
   * Lazy load images for better performance
   */
  function initLazyLoading() {
    // Use native lazy loading for images
    const images = document.querySelectorAll('img[data-src]');
    
    if ('loading' in HTMLImageElement.prototype) {
      // Native lazy loading supported
      images.forEach(img => {
        const src = img.getAttribute('data-src');
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          img.loading = 'lazy';
        }
      });
    } else {
      // Fallback: use Intersection Observer
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
            }
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
    }
  }

  /**
   * Add ripple effect to buttons
   */
  function addRippleEffect(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  /**
   * Initialize ripple effects on buttons
   */
  function initRippleEffects() {
    // Add CSS animation if not present
    if (!document.getElementById('ripple-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'ripple-animation-styles';
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Add ripple to buttons
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button:not([disabled]), .btn, [role="button"]');
      if (button && !button.hasAttribute('data-no-ripple')) {
        addRippleEffect(button, e);
      }
    });
  }

  /**
   * Optimize page performance on load
   */
  function optimizePerformance() {
    // Add will-change hints to frequently animated elements
    const animatedElements = document.querySelectorAll(
      '.modal, .dropdown, [data-animate], .skeleton-shimmer'
    );
    animatedElements.forEach(el => {
      el.style.willChange = 'transform, opacity';
    });

    // Remove will-change after animations complete to save memory
    setTimeout(() => {
      animatedElements.forEach(el => {
        el.style.willChange = 'auto';
      });
    }, 1000);
  }

  /**
   * Preload critical resources
   */
  function preloadCriticalResources() {
    // Preload fonts if not already loaded
    const fonts = [
      '/fonts/inter-var.woff2', // Adjust to your actual font paths
    ];

    fonts.forEach(font => {
      const existingLink = document.querySelector(`link[href="${font}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
        link.href = font;
        document.head.appendChild(link);
      }
    });
  }

  /**
   * Initialize all page transitions and utilities
   */
  function init() {
    initSmoothScroll();
    initScrollAnimations();
    initFormLoadingStates();
    initHoverEffects();
    initLazyLoading();
    initRippleEffects();
    optimizePerformance();
    // preloadCriticalResources(); // Uncomment if you have custom fonts

    console.log('Page transitions initialized');
  }

  /**
   * Re-initialize after client-side navigation
   */
  function reinit() {
    initScrollAnimations();
    initHoverEffects();
    initLazyLoading();
    optimizePerformance();
  }

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize on client-side navigation
  window.addEventListener('router:page-loaded', reinit);

  // Export for external use
  window.PageTransitions = {
    reinit: reinit,
    addRippleEffect: addRippleEffect,
  };

})();

