/**
 * Chunked Video Upload Client Library
 * Bypasses Cloudflare's 100MB limit by splitting videos into 99MB chunks
 * 
 * Usage:
 *   const uploader = new ChunkedVideoUpload(file, {
 *     onProgress: (progress) => console.log(progress),
 *     onComplete: (result) => console.log('Done!', result),
 *     onError: (error) => console.error(error)
 *   });
 *   await uploader.start();
 */

(function() {
  'use strict';

  class ChunkedVideoUpload {
    constructor(file, options = {}) {
      // File to upload
      this.file = file;
      
      // Configuration
      this.chunkSize = options.chunkSize || (99 * 1024 * 1024); // 99MB chunks
      this.maxRetries = options.maxRetries || 3;
      this.retryDelay = options.retryDelay || 1000; // 1 second
      
      // State
      this.uploadId = null;
      this.uploadedBytes = 0;
      this.totalBytes = file.size;
      this.currentChunkIndex = 0;
      this.totalChunks = Math.ceil(file.size / this.chunkSize);
      this.isPaused = false;
      this.isCancelled = false;
      this.retryCount = 0;
      
      // Callbacks
      this.onProgress = options.onProgress || (() => {});
      this.onComplete = options.onComplete || (() => {});
      this.onError = options.onError || (() => {});
      this.onChunkComplete = options.onChunkComplete || (() => {});
      
      // API endpoints
      this.endpoints = {
        create: '/api/videos/tus/create',
        chunk: '/api/videos/tus/chunk',
        finalize: '/api/videos/tus/finalize',
      };
    }

    /**
     * Calculate progress information
     */
    getProgress() {
      return {
        uploadedBytes: this.uploadedBytes,
        totalBytes: this.totalBytes,
        percentage: (this.uploadedBytes / this.totalBytes) * 100,
        currentChunk: this.currentChunkIndex + 1,
        totalChunks: this.totalChunks,
        chunksComplete: this.currentChunkIndex,
        bytesRemaining: this.totalBytes - this.uploadedBytes,
        isComplete: this.uploadedBytes >= this.totalBytes,
      };
    }

    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Create upload session on server
     */
    async createSession() {
      const response = await fetch(this.endpoints.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filename: this.file.name,
          totalSize: this.file.size,
          contentType: this.file.type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create upload session' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response from server');
      }

      this.uploadId = result.data.uploadId;
      return result.data;
    }

    /**
     * Upload a single chunk
     */
    async uploadChunk(chunk, offset) {
      const formData = new FormData();
      formData.append('uploadId', this.uploadId);
      formData.append('offset', String(offset));
      formData.append('chunk', chunk, 'chunk.bin');

      const response = await fetch(this.endpoints.chunk, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to upload chunk' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response from server');
      }

      return result.data;
    }

    /**
     * Finalize upload and get video metadata
     */
    async finalizeUpload() {
      const response = await fetch(this.endpoints.finalize, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          uploadId: this.uploadId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to finalize upload' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response from server');
      }

      return result.data;
    }

    /**
     * Start upload process
     */
    async start() {
      try {
        this.isCancelled = false;
        this.isPaused = false;
        this.retryCount = 0;

        // Step 1: Create upload session
        console.log('ChunkedUpload: Creating upload session...');
        await this.createSession();
        console.log('ChunkedUpload: Session created, uploadId:', this.uploadId);

        // Step 2: Upload chunks sequentially
        while (this.currentChunkIndex < this.totalChunks && !this.isCancelled) {
          // Check if paused
          if (this.isPaused) {
            console.log('ChunkedUpload: Upload paused');
            await this.waitForResume();
            if (this.isCancelled) break;
          }

          // Calculate chunk boundaries
          const start = this.currentChunkIndex * this.chunkSize;
          const end = Math.min(start + this.chunkSize, this.totalBytes);
          const chunk = this.file.slice(start, end);

          console.log(`ChunkedUpload: Uploading chunk ${this.currentChunkIndex + 1}/${this.totalChunks} (${this.formatBytes(chunk.size)})`);

          try {
            // Upload chunk with retry logic
            const chunkResult = await this.uploadChunkWithRetry(chunk, start);
            
            // Update progress
            this.uploadedBytes = chunkResult.offset;
            this.currentChunkIndex++;
            
            // Notify progress
            const progress = this.getProgress();
            this.onProgress(progress);
            this.onChunkComplete(this.currentChunkIndex, this.totalChunks);

            console.log(`ChunkedUpload: Chunk ${this.currentChunkIndex}/${this.totalChunks} complete (${progress.percentage.toFixed(1)}%)`);

            // Reset retry count on success
            this.retryCount = 0;

          } catch (error) {
            console.error(`ChunkedUpload: Failed to upload chunk ${this.currentChunkIndex + 1}:`, error);
            throw error;
          }
        }

        // Check if cancelled
        if (this.isCancelled) {
          throw new Error('Upload cancelled by user');
        }

        // Step 3: Finalize upload
        console.log('ChunkedUpload: Finalizing upload...');
        const finalResult = await this.finalizeUpload();
        console.log('ChunkedUpload: Upload complete!', finalResult);

        // Notify completion
        this.onComplete(finalResult);

        return finalResult;

      } catch (error) {
        console.error('ChunkedUpload: Upload failed:', error);
        this.onError(error);
        throw error;
      }
    }

    /**
     * Upload chunk with automatic retry
     */
    async uploadChunkWithRetry(chunk, offset) {
      let lastError = null;
      
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        if (this.isCancelled) {
          throw new Error('Upload cancelled');
        }

        try {
          const result = await this.uploadChunk(chunk, offset);
          return result; // Success
        } catch (error) {
          lastError = error;
          this.retryCount++;

          if (attempt < this.maxRetries) {
            console.warn(`ChunkedUpload: Chunk upload failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying...`);
            // Wait before retry with exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt);
            await this.sleep(delay);
          }
        }
      }

      // All retries failed
      throw new Error(`Failed to upload chunk after ${this.maxRetries + 1} attempts: ${lastError?.message}`);
    }

    /**
     * Pause upload
     */
    pause() {
      if (!this.isPaused) {
        this.isPaused = true;
        console.log('ChunkedUpload: Upload paused');
      }
    }

    /**
     * Resume upload
     */
    resume() {
      if (this.isPaused) {
        this.isPaused = false;
        console.log('ChunkedUpload: Upload resumed');
      }
    }

    /**
     * Cancel upload
     */
    cancel() {
      this.isCancelled = true;
      this.isPaused = false;
      console.log('ChunkedUpload: Upload cancelled');
    }

    /**
     * Wait for resume (used when paused)
     */
    async waitForResume() {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isPaused || this.isCancelled) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    /**
     * Sleep utility
     */
    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get upload state for resume
     */
    getState() {
      return {
        uploadId: this.uploadId,
        uploadedBytes: this.uploadedBytes,
        currentChunkIndex: this.currentChunkIndex,
        filename: this.file.name,
        totalSize: this.totalBytes,
      };
    }

    /**
     * Restore upload state (for resume after page reload)
     */
    restoreState(state) {
      this.uploadId = state.uploadId;
      this.uploadedBytes = state.uploadedBytes;
      this.currentChunkIndex = state.currentChunkIndex;
    }
  }

  // Export to global scope
  if (typeof window !== 'undefined') {
    window.ChunkedVideoUpload = ChunkedVideoUpload;
    console.log('ChunkedVideoUpload library loaded');
  }

})();

