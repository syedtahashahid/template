/**
 * Comment Polling System
 * Polls for new comments and updates the UI in real-time
 */

class CommentPoller {
  constructor(threadId, options = {}) {
    this.threadId = threadId;
    this.pollInterval = options.pollInterval || 10000; // 10 seconds
    this.maxInactiveTime = options.maxInactiveTime || 1800000; // 30 minutes
    this.lastTimestamp = options.initialTimestamp || Math.floor(Date.now() / 1000);
    this.isActive = true;
    this.pollTimer = null;
    this.inactiveTimer = null;
    this.commentIds = new Set(); // Track displayed comment IDs
    this.onNewComments = options.onNewComments || null;
    this.onError = options.onError || null;
    
    // Initialize comment IDs from existing comments
    this.initializeCommentIds();
    
    // Start polling
    this.start();
    
    // Handle visibility changes
    this.setupVisibilityHandling();
  }

  initializeCommentIds() {
    const comments = document.querySelectorAll('.comment-item[data-comment-id]');
    comments.forEach(comment => {
      const id = comment.getAttribute('data-comment-id');
      if (id) {
        this.commentIds.add(parseInt(id, 10));
      }
    });
  }

  start() {
    if (!this.isActive) return;
    
    this.pollTimer = setTimeout(() => {
      this.poll();
    }, this.pollInterval);
    
    // Set inactive timer
    this.resetInactiveTimer();
  }

  stop() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.inactiveTimer) {
      clearTimeout(this.inactiveTimer);
      this.inactiveTimer = null;
    }
    this.isActive = false;
  }

  resetInactiveTimer() {
    if (this.inactiveTimer) {
      clearTimeout(this.inactiveTimer);
    }
    
    this.inactiveTimer = setTimeout(() => {
      this.stop();
      console.log('Comment polling stopped due to inactivity');
    }, this.maxInactiveTime);
  }

  async poll() {
    if (!this.isActive) return;
    
    try {
      const url = new URL('/api/comments', window.location.origin);
      url.searchParams.set('threadId', this.threadId);
      url.searchParams.set('since', this.lastTimestamp);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.comments) {
        const newComments = data.comments.filter(comment => {
          return !this.commentIds.has(comment.id) && comment.createdAt > this.lastTimestamp;
        });
        
        if (newComments.length > 0) {
          // Update last timestamp
          this.lastTimestamp = Math.max(
            ...newComments.map(c => c.createdAt),
            this.lastTimestamp
          );
          
          // Add new comment IDs
          newComments.forEach(comment => {
            this.commentIds.add(comment.id);
          });
          
          // Notify callback
          if (this.onNewComments) {
            this.onNewComments(newComments, data.latestTimestamp);
          } else {
            // Default behavior: insert comments
            this.insertNewComments(newComments);
          }
          
          // Reset inactive timer on activity
          this.resetInactiveTimer();
        }
        
        // Update latest timestamp if provided
        if (data.latestTimestamp) {
          this.lastTimestamp = data.latestTimestamp;
        }
      }
    } catch (error) {
      console.error('Error polling for comments:', error);
      if (this.onError) {
        this.onError(error);
      }
    } finally {
      // Schedule next poll
      if (this.isActive) {
        this.start();
      }
    }
  }

  insertNewComments(newComments) {
    const container = document.getElementById('comments-container');
    if (!container) return;
    
    // Get user for rendering
    const user = window.authManager?.user || JSON.parse(localStorage.getItem('auth_user') || 'null');
    
    // Check if renderCommentHTML function exists
    if (typeof renderCommentHTML === 'function') {
      newComments.forEach(comment => {
        const html = renderCommentHTML(comment, 0, user);
        container.insertAdjacentHTML('afterbegin', html);
        
        // Scroll to new comment
        const newComment = document.querySelector(`.comment-item[data-comment-id="${comment.id}"]`);
        if (newComment) {
          newComment.classList.add('comment-new');
          // Smooth scroll if near bottom of page
          const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          
          if (documentHeight - scrollPosition - windowHeight < 500) {
            newComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          // Remove highlight after animation
          setTimeout(() => {
            newComment.classList.remove('comment-new');
          }, 2000);
        }
      });
      
      // Update comment count
      this.updateCommentCount(newComments.length);
    }
  }

  updateCommentCount(newCount) {
    const countElement = document.querySelector('h2.text-xl.font-bold.text-gray-900');
    if (countElement) {
      const currentCount = parseInt(countElement.textContent.match(/\d+/)?.[0] || '0');
      const updatedCount = currentCount + newCount;
      countElement.textContent = `${updatedCount} ${updatedCount === 1 ? 'Comment' : 'Comments'}`;
    }
    
    // Also update thread header comment count
    const threadCommentCount = document.querySelector('.flex.items-center.gap-4.text-sm.text-gray-600.mb-4 span:has(svg)');
    if (threadCommentCount) {
      const currentCount = parseInt(threadCommentCount.textContent.match(/\d+/)?.[0] || '0');
      const updatedCount = currentCount + newCount;
      threadCommentCount.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        ${updatedCount} ${updatedCount === 1 ? 'comment' : 'comments'}
      `;
    }
  }

  setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Pause polling when tab is inactive
        if (this.pollTimer) {
          clearTimeout(this.pollTimer);
          this.pollTimer = null;
        }
      } else {
        // Resume polling when tab becomes active
        if (this.isActive && !this.pollTimer) {
          this.start();
        }
      }
    });
  }
}

// Auto-initialize if on thread detail page
if (document.getElementById('comments-container')) {
  // Extract thread ID from URL or data attribute
  const threadIdMatch = window.location.pathname.match(/\/discussions\/(\d+)/);
  if (threadIdMatch) {
    const threadId = parseInt(threadIdMatch[1], 10);
    const initialTimestamp = Math.floor(Date.now() / 1000);
    
    window.commentPoller = new CommentPoller(threadId, {
      pollInterval: 10000, // 10 seconds
      initialTimestamp,
      onNewComments: (newComments, latestTimestamp) => {
        // Use default insertion behavior
        window.commentPoller.insertNewComments(newComments);
        
        // Show notification if user is not at bottom of page
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        if (documentHeight - scrollPosition - windowHeight > 500) {
          // Show "New comments available" badge
          showNewCommentsBadge(newComments.length);
        }
      }
    });
  }
}

// Show new comments badge
function showNewCommentsBadge(count) {
  let badge = document.getElementById('new-comments-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'new-comments-badge';
    badge.className = 'fixed bottom-4 right-4 bg-primary-600 text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer z-50 hover:bg-primary-700 transition-colors';
    badge.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${count} new comment${count === 1 ? '' : 's'}</span>
        <button onclick="scrollToNewComments()" class="underline">View</button>
      </div>
    `;
    document.body.appendChild(badge);
  } else {
    badge.querySelector('span').textContent = `${count} new comment${count === 1 ? '' : 's'}`;
  }
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (badge) {
      badge.remove();
    }
  }, 10000);
}

window.scrollToNewComments = function() {
  const newComments = document.querySelectorAll('.comment-new');
  if (newComments.length > 0) {
    newComments[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('new-comments-badge')?.remove();
  }
};

