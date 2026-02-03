/**
 * Skeleton Screen Templates
 * Generate loading placeholders for different page types
 * 
 * Usage:
 *   window.SkeletonScreens.show('company') - Show company profile skeleton
 *   window.SkeletonScreens.show('search') - Show search results skeleton
 *   window.SkeletonScreens.hide() - Hide skeleton screen
 *   window.SkeletonScreens.detect('/company/abc') - Auto-detect skeleton type from URL
 */

(function() {
  'use strict';

  class SkeletonScreens {
    constructor() {
      this.container = null;
      this.currentType = null;
    }

    /**
     * Detect skeleton type from URL pathname
     */
    detect(pathname) {
      if (pathname.startsWith('/company/')) {
        return 'company';
      } else if (pathname.startsWith('/search') || pathname.startsWith('/browse')) {
        return 'search';
      } else if (pathname.startsWith('/discussions/') && pathname.split('/').length > 2) {
        return 'thread';
      } else if (pathname.startsWith('/discussions')) {
        return 'discussions';
      } else if (pathname.startsWith('/cariversity/') && pathname !== '/cariversity' && pathname !== '/cariversity/') {
        return 'article';
      } else if (pathname.startsWith('/cariversity')) {
        return 'cariversity';
      } else if (pathname.startsWith('/state/') || pathname.startsWith('/companies/')) {
        return 'search';
      }
      return 'generic';
    }

    /**
     * Generate shimmer animation class (using Tailwind)
     */
    getShimmerClasses() {
      return 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]';
    }

    /**
     * Company profile skeleton
     */
    getCompanySkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-7xl">
            <!-- Header Skeleton -->
            <div class="bg-white shadow-lg rounded-2xl p-8 mb-6">
              <div class="flex items-start gap-6">
                <!-- Logo Placeholder -->
                <div class="w-24 h-24 ${this.getShimmerClasses()} rounded-xl"></div>
                <div class="flex-1">
                  <!-- Company Name -->
                  <div class="h-8 ${this.getShimmerClasses()} rounded w-3/4 mb-3"></div>
                  <!-- Status Badge -->
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-24 mb-4"></div>
                  <!-- Action Buttons -->
                  <div class="flex gap-3">
                    <div class="h-10 ${this.getShimmerClasses()} rounded-lg w-32"></div>
                    <div class="h-10 ${this.getShimmerClasses()} rounded-lg w-32"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Main Content -->
              <div class="lg:col-span-2 space-y-6">
                <!-- Stats Row -->
                <div class="bg-white shadow-lg rounded-2xl p-6">
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${Array(4).fill('').map(() => `
                      <div>
                        <div class="h-4 ${this.getShimmerClasses()} rounded w-16 mb-2"></div>
                        <div class="h-6 ${this.getShimmerClasses()} rounded w-20"></div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Content Blocks -->
                ${Array(2).fill('').map(() => `
                  <div class="bg-white shadow-lg rounded-2xl p-6">
                    <div class="h-6 ${this.getShimmerClasses()} rounded w-48 mb-4"></div>
                    <div class="space-y-3">
                      ${Array(3).fill('').map(() => `
                        <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                      `).join('')}
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-3/4"></div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Sidebar -->
              <div class="space-y-6">
                <!-- Contact Card -->
                <div class="bg-white shadow-lg rounded-2xl p-6">
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-32 mb-4"></div>
                  <div class="space-y-3">
                    ${Array(4).fill('').map(() => `
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                    `).join('')}
                  </div>
                </div>

                <!-- Additional Card -->
                <div class="bg-white shadow-lg rounded-2xl p-6">
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-40 mb-4"></div>
                  <div class="space-y-2">
                    ${Array(5).fill('').map(() => `
                      <div class="h-3 ${this.getShimmerClasses()} rounded w-full"></div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Search results skeleton
     */
    getSearchSkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-7xl">
            <!-- Search Header -->
            <div class="mb-6">
              <div class="h-8 ${this.getShimmerClasses()} rounded w-64 mb-2"></div>
              <div class="h-4 ${this.getShimmerClasses()} rounded w-48"></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <!-- Filters Sidebar -->
              <div class="lg:col-span-1">
                <div class="bg-white shadow-lg rounded-2xl p-6 sticky top-24">
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-24 mb-4"></div>
                  ${Array(5).fill('').map(() => `
                    <div class="mb-4">
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-32 mb-2"></div>
                      <div class="h-8 ${this.getShimmerClasses()} rounded w-full"></div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Results List -->
              <div class="lg:col-span-3">
                <div class="space-y-4">
                  ${Array(8).fill('').map(() => `
                    <div class="bg-white shadow-lg rounded-2xl p-6">
                      <div class="flex items-start gap-4">
                        <div class="w-16 h-16 ${this.getShimmerClasses()} rounded-lg"></div>
                        <div class="flex-1">
                          <div class="h-6 ${this.getShimmerClasses()} rounded w-3/4 mb-2"></div>
                          <div class="h-4 ${this.getShimmerClasses()} rounded w-1/2 mb-3"></div>
                          <div class="flex gap-2">
                            ${Array(3).fill('').map(() => `
                              <div class="h-6 ${this.getShimmerClasses()} rounded-full w-20"></div>
                            `).join('')}
                          </div>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Pagination Skeleton -->
                <div class="mt-8 flex justify-center gap-2">
                  ${Array(5).fill('').map(() => `
                    <div class="w-10 h-10 ${this.getShimmerClasses()} rounded"></div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Discussions list skeleton
     */
    getDiscussionsSkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-7xl">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Thread List -->
              <div class="lg:col-span-2 space-y-4">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                  <div class="h-8 ${this.getShimmerClasses()} rounded w-48"></div>
                  <div class="h-10 ${this.getShimmerClasses()} rounded-lg w-32"></div>
                </div>

                <!-- Threads -->
                ${Array(10).fill('').map(() => `
                  <div class="bg-white shadow-lg rounded-2xl p-6">
                    <div class="flex gap-4">
                      <!-- Vote Section -->
                      <div class="flex flex-col items-center gap-1">
                        <div class="w-8 h-8 ${this.getShimmerClasses()} rounded"></div>
                        <div class="w-8 h-6 ${this.getShimmerClasses()} rounded"></div>
                      </div>
                      <!-- Content -->
                      <div class="flex-1">
                        <div class="h-6 ${this.getShimmerClasses()} rounded w-4/5 mb-2"></div>
                        <div class="h-4 ${this.getShimmerClasses()} rounded w-full mb-1"></div>
                        <div class="h-4 ${this.getShimmerClasses()} rounded w-3/4 mb-3"></div>
                        <div class="flex gap-4">
                          <div class="h-4 ${this.getShimmerClasses()} rounded w-24"></div>
                          <div class="h-4 ${this.getShimmerClasses()} rounded w-20"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Sidebar -->
              <div class="space-y-6">
                <div class="bg-white shadow-lg rounded-2xl p-6 sticky top-24">
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-32 mb-4"></div>
                  ${Array(5).fill('').map(() => `
                    <div class="mb-3">
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-full mb-1"></div>
                      <div class="h-3 ${this.getShimmerClasses()} rounded w-2/3"></div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Thread detail skeleton
     */
    getThreadSkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-4xl">
            <!-- Thread Header -->
            <div class="bg-white shadow-lg rounded-2xl p-8 mb-6">
              <div class="h-8 ${this.getShimmerClasses()} rounded w-3/4 mb-4"></div>
              <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 ${this.getShimmerClasses()} rounded-full"></div>
                <div class="h-4 ${this.getShimmerClasses()} rounded w-32"></div>
              </div>
              <div class="space-y-2">
                ${Array(4).fill('').map(() => `
                  <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                `).join('')}
                <div class="h-4 ${this.getShimmerClasses()} rounded w-2/3"></div>
              </div>
            </div>

            <!-- Comments -->
            ${Array(6).fill('').map(() => `
              <div class="bg-white shadow-lg rounded-2xl p-6 mb-4">
                <div class="flex gap-4">
                  <div class="w-10 h-10 ${this.getShimmerClasses()} rounded-full"></div>
                  <div class="flex-1">
                    <div class="h-4 ${this.getShimmerClasses()} rounded w-32 mb-3"></div>
                    <div class="space-y-2">
                      ${Array(2).fill('').map(() => `
                        <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                      `).join('')}
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Cariversity home skeleton
     */
    getCariversitySkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-7xl">
            <!-- Hero Section -->
            <div class="bg-white shadow-lg rounded-2xl p-12 mb-8 text-center">
              <div class="h-10 ${this.getShimmerClasses()} rounded w-96 mx-auto mb-4"></div>
              <div class="h-6 ${this.getShimmerClasses()} rounded w-2/3 mx-auto"></div>
            </div>

            <!-- Category Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${Array(9).fill('').map(() => `
                <div class="bg-white shadow-lg rounded-2xl p-6">
                  <div class="w-12 h-12 ${this.getShimmerClasses()} rounded-lg mb-4"></div>
                  <div class="h-6 ${this.getShimmerClasses()} rounded w-3/4 mb-2"></div>
                  <div class="h-4 ${this.getShimmerClasses()} rounded w-16 mb-3"></div>
                  <div class="space-y-2">
                    ${Array(3).fill('').map(() => `
                      <div class="h-3 ${this.getShimmerClasses()} rounded w-full"></div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Article skeleton
     */
    getArticleSkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-4xl">
            <!-- Article Header -->
            <div class="bg-white shadow-lg rounded-2xl p-8 mb-6">
              <div class="h-10 ${this.getShimmerClasses()} rounded w-4/5 mb-4"></div>
              <div class="flex items-center gap-4 mb-6">
                <div class="h-4 ${this.getShimmerClasses()} rounded w-32"></div>
                <div class="h-4 ${this.getShimmerClasses()} rounded w-24"></div>
              </div>
              
              <!-- Article Content -->
              <div class="space-y-4">
                ${Array(8).fill('').map(() => `
                  <div class="space-y-2">
                    ${Array(3).fill('').map(() => `
                      <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                    `).join('')}
                    <div class="h-4 ${this.getShimmerClasses()} rounded w-5/6"></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Generic skeleton for other pages
     */
    getGenericSkeleton() {
      return `
        <div class="min-h-screen bg-gray-50 pt-24 pb-16">
          <div class="container mx-auto px-4 max-w-6xl">
            <div class="bg-white shadow-lg rounded-2xl p-8">
              <div class="h-8 ${this.getShimmerClasses()} rounded w-64 mb-6"></div>
              <div class="space-y-4">
                ${Array(10).fill('').map(() => `
                  <div class="h-4 ${this.getShimmerClasses()} rounded w-full"></div>
                `).join('')}
                <div class="h-4 ${this.getShimmerClasses()} rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * Get skeleton HTML for specific type
     */
    getSkeletonHTML(type) {
      switch (type) {
        case 'company':
          return this.getCompanySkeleton();
        case 'search':
          return this.getSearchSkeleton();
        case 'discussions':
          return this.getDiscussionsSkeleton();
        case 'thread':
          return this.getThreadSkeleton();
        case 'cariversity':
          return this.getCariversitySkeleton();
        case 'article':
          return this.getArticleSkeleton();
        default:
          return this.getGenericSkeleton();
      }
    }

    /**
     * Show skeleton screen
     */
    show(typeOrUrl) {
      // CRITICAL: Never show skeleton on initial page load
      // Only show during client-side navigation
      if (!window.__ROUTER_INITIALIZED__) {
        console.log('SkeletonScreens: Router not initialized yet, skipping skeleton');
        return;
      }
      
      // Detect type from URL if string starts with /
      const type = typeOrUrl.startsWith('/') ? this.detect(typeOrUrl) : typeOrUrl;
      
      // Don't show if already showing same type
      if (this.container && this.currentType === type) {
        return;
      }

      // Hide any existing skeleton first
      this.hide();

      // Find content container - try multiple selectors
      let mainContent = document.querySelector('main') || 
                        document.querySelector('[role="main"]') ||
                        document.querySelector('#__next > div > main');
      
      // If no main element, find the content div (not header/footer)
      if (!mainContent) {
        const nextDiv = document.querySelector('#__next');
        if (nextDiv) {
          // Find the middle div (content) between header and footer
          const children = Array.from(nextDiv.children);
          // Skip first child (header) and last child (footer), get middle content
          if (children.length > 2) {
            mainContent = children[1]; // Middle child is usually content
          } else if (children.length === 2) {
            // If only 2 children, second is likely content
            mainContent = children[1];
          } else if (children.length === 1) {
            // If only one child, use it
            mainContent = children[0];
          }
        }
      }
      
      // Final fallback: find any div that's not header/footer
      if (!mainContent) {
        const nextDiv = document.querySelector('#__next');
        if (nextDiv) {
          // Look for divs that aren't header or footer
          const divs = Array.from(nextDiv.querySelectorAll('div'));
          mainContent = divs.find(div => 
            !div.closest('header') && 
            !div.closest('footer') &&
            div.offsetHeight > 100 // Has some height (likely content)
          ) || divs[0]; // Fallback to first div
        }
      }
      
      if (!mainContent) {
        console.warn('SkeletonScreens: Could not find main content container');
        return;
      }

      // Ensure we're not hiding header or footer
      if (mainContent.closest('header') || 
          mainContent.closest('footer') ||
          mainContent.id === 'header' ||
          mainContent.id === 'footer' ||
          mainContent.classList.contains('header') ||
          mainContent.classList.contains('footer') ||
          mainContent.querySelector('header') ||
          mainContent.querySelector('footer')) {
        console.warn('SkeletonScreens: Container contains header/footer, skipping');
        return;
      }
      
      // Create skeleton container
      this.container = document.createElement('div');
      this.container.id = 'skeleton-screen-container';
      this.container.className = 'skeleton-screen-active';
      this.container.innerHTML = this.getSkeletonHTML(type);
      
      // Insert skeleton (replace content)
      // Only hide if it's not the entire #__next container
      if (mainContent.id !== '__next') {
        mainContent.style.display = 'none';
        mainContent.parentNode.insertBefore(this.container, mainContent);
      } else {
        // If mainContent is #__next, find the actual content child
        const contentChild = Array.from(mainContent.children).find(child => 
          !child.closest('header') && !child.closest('footer')
        );
        if (contentChild) {
          contentChild.style.display = 'none';
          contentChild.parentNode.insertBefore(this.container, contentChild);
        } else {
          // Fallback: append to end
          mainContent.appendChild(this.container);
        }
      }
      
      this.currentType = type;
    }

    /**
     * Hide skeleton screen
     */
    hide() {
      if (this.container) {
        // Find what was hidden (the element before the skeleton)
        const hiddenElement = this.container.previousElementSibling;
        
        // Remove skeleton
        if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.currentType = null;
        
        // Restore hidden element visibility
        if (hiddenElement && hiddenElement.style.display === 'none') {
          hiddenElement.style.display = '';
        }
      }

      // Also restore any elements with display:none that might be content
      const hiddenElements = document.querySelectorAll('[style*="display: none"]');
      hiddenElements.forEach(el => {
        // Only restore if it's not header/footer and was likely hidden by skeleton
        if (!el.closest('header') && 
            !el.closest('footer') &&
            el.id !== 'header' &&
            el.id !== 'footer' &&
            (el.tagName === 'MAIN' || el.getAttribute('role') === 'main' || el.classList.contains('main-content'))) {
          el.style.display = '';
        }
      });
    }

    /**
     * Check if skeleton is currently showing
     */
    isShowing() {
      return this.container !== null;
    }
  }

  // Create global instance
  if (typeof window !== 'undefined') {
    window.SkeletonScreens = new SkeletonScreens();
    console.log('SkeletonScreens initialized');
  }
})();

