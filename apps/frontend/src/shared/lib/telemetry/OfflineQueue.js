class OfflineQueue {
  constructor(attemptId) {
    this.storageKey = `trstprep_telemetry_offline_${attemptId}`;
    this.droppedKey = `trstprep_telemetry_dropped_${attemptId}`;
  }

  /**
   * Enqueue a single telemetry event to localStorage
   */
  enqueue(event) {
    try {
      const queue = this.getAll();
      queue.push(event);
      
      // Limit queue length to 1000 events to prevent localStorage quota exhaustion
      const MAX_OFFLINE_EVENTS = 1000;
      if (queue.length > MAX_OFFLINE_EVENTS) {
        queue.shift(); // Evict the oldest event (FIFO)
        this.incrementDroppedCount();
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(queue));
    } catch (err) {
      console.error('[Telemetry OfflineQueue] Failed to enqueue event:', err);
    }
  }

  /**
   * Get all queued events without removing them
   */
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('[Telemetry OfflineQueue] Failed to read queue:', err);
      return [];
    }
  }

  /**
   * Dequeue all events and clear the offline queue
   */
  dequeueAll() {
    const events = this.getAll();
    this.clear();
    return events;
  }

  /**
   * Clear the offline queue
   */
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (err) {
      console.error('[Telemetry OfflineQueue] Failed to clear queue:', err);
    }
  }

  /**
   * Get the current count of queued events
   */
  length() {
    return this.getAll().length;
  }

  /**
   * Get dropped events count from persistent storage
   */
  getDroppedCount() {
    try {
      return parseInt(localStorage.getItem(this.droppedKey) || '0', 10);
    } catch {
      return 0;
    }
  }

  /**
   * Increment dropped events count persistently
   */
  incrementDroppedCount() {
    try {
      const count = this.getDroppedCount() + 1;
      localStorage.setItem(this.droppedKey, String(count));
    } catch (err) {
      console.error('[Telemetry OfflineQueue] Failed to increment dropped count:', err);
    }
  }

  /**
   * Clear dropped count
   */
  clearDroppedCount() {
    try {
      localStorage.removeItem(this.droppedKey);
    } catch (_err) {
      void _err;
    }
  }
}

export default OfflineQueue;
