/**
 * Top Progress Bar Component
 * Slim progress bar for page navigation
 * 
 * Usage:
 *   window.ProgressBar.start() - Start progress animation
 *   window.ProgressBar.set(0.5) - Set to specific progress (0-1)
 *   window.ProgressBar.done() - Complete and fade out
 *   window.ProgressBar.hide() - Immediately hide without animation
 */

(function () {
  'use strict';

  class ProgressBar {
    constructor() {
      this.element = null;
      this.currentProgress = 0;
      this.targetProgress = 0;
      this.animationFrame = null;
      this.autoIncrementTimer = null;
      this.hideTimeout = null;
      this.isShowing = false;

      // Configuration
      this.config = {
        color: '#f59e0b', // Amber color matching site theme
        height: '3px',
        animationSpeed: 200, // ms for smooth transitions
        autoIncrementInterval: 300, // ms between auto increments
        fadeOutDuration: 400, // ms for fade out
        zIndex: 99999,
      };

      this.init();
    }

    init() {
      // Create progress bar element
      this.element = document.createElement('div');
      this.element.id = 'top-progress-bar';
      this.element.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: ${this.config.height};
        z-index: ${this.config.zIndex};
        pointer-events: none;
        opacity: 0;
        transition: opacity ${this.config.fadeOutDuration}ms ease-out;
      `;

      // Create inner bar (the colored part)
      const inner = document.createElement('div');
      inner.id = 'top-progress-bar-inner';
      inner.style.cssText = `
        height: 100%;
        background: linear-gradient(90deg, ${this.config.color}, ${this.config.color}CC);
        box-shadow: 0 0 10px ${this.config.color}88, 0 0 5px ${this.config.color}66;
        width: 0%;
        transition: width ${this.config.animationSpeed}ms ease-out, opacity ${this.config.fadeOutDuration}ms ease-out;
        transform-origin: left;
        will-change: width;
      `;

      this.element.appendChild(inner);
      document.body.appendChild(this.element);
    }

    getInner() {
      return this.element.querySelector('#top-progress-bar-inner');
    }

    start() {
      // CRITICAL: Only show during navigation, not on page load
      if (!window.__ROUTER_INITIALIZED__) {
        console.log('ProgressBar: Router not initialized yet, skipping');
        return;
      }

      // Clear any existing timers
      this.stop();

      // Reset progress
      this.currentProgress = 0;
      this.targetProgress = 0;

      // Show bar
      this.show();

      // Set initial progress
      this.set(0);

      // Start auto-increment
      this.autoIncrement();
    }

    show() {
      if (!this.isShowing) {
        this.element.style.opacity = '1';
        this.isShowing = true;
      }
    }

    hide() {
      if (this.isShowing) {
        this.element.style.opacity = '0';
        this.isShowing = false;

        // Reset after fade out
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
        }
        this.hideTimeout = setTimeout(() => {
          const inner = this.getInner();
          if (inner) {
            inner.style.width = '0%';
          }
          this.currentProgress = 0;
          this.targetProgress = 0;
        }, this.config.fadeOutDuration);
      }
    }

    set(progress) {
      // Clamp progress between 0 and 1
      progress = Math.max(0, Math.min(1, progress));
      this.targetProgress = progress;
      this.currentProgress = progress;

      const inner = this.getInner();
      if (inner) {
        inner.style.width = `${progress * 100}%`;
      }
    }

    inc(amount = 0.1) {
      const newProgress = Math.min(0.994, this.currentProgress + amount);
      this.set(newProgress);
    }

    autoIncrement() {
      // Auto-increment logic: start fast, slow down as we get closer to 90%
      const increment = () => {
        if (this.currentProgress < 0.3) {
          // Fast increment at start (0-30%)
          this.inc(0.1);
        } else if (this.currentProgress < 0.6) {
          // Medium increment (30-60%)
          this.inc(0.06);
        } else if (this.currentProgress < 0.9) {
          // Slow increment (60-90%)
          this.inc(0.03);
        } else {
          // Very slow increment (90%+) - never quite reaches 100%
          this.inc(0.01);
        }

        // Continue auto-increment if not done
        if (this.currentProgress < 0.994) {
          this.autoIncrementTimer = setTimeout(increment, this.config.autoIncrementInterval);
        }
      };

      // Start incrementing
      increment();
    }

    done() {
      // Clear auto-increment
      this.stop();

      // Jump to 100%
      this.set(1);

      // Fade out after a brief moment
      setTimeout(() => {
        this.hide();
      }, this.config.animationSpeed);
    }

    stop() {
      if (this.autoIncrementTimer) {
        clearTimeout(this.autoIncrementTimer);
        this.autoIncrementTimer = null;
      }
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }
    }

    destroy() {
      this.stop();
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  // Create global instance
  if (typeof window !== 'undefined') {
    window.ProgressBar = new ProgressBar();

    // Log initialization
    console.log('ProgressBar initialized');
  }
})();

