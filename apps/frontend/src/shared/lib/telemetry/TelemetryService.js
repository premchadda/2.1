import { apiClient } from "../apiClient.js";
import OfflineQueue from "./OfflineQueue.js";

// Helper to generate self-contained UUIDs
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class TelemetryService {
  constructor() {
    this.attemptId = null;
    this.testId = null;
    this.getCurrentQuestion = null;
    this.getTimeLeft = null;
    this.onViolation = null;

    this.queue = [];
    this.offlineQueue = null;
    this.flushInterval = null;
    this.heartbeatInterval = null;
    this.retryTimeout = null;

    // Server time offset in ms: ServerTime - ClientTime
    this.serverOffset = 0;
    this.lastActivity = Date.now();
    this.isRunning = false;

    // Hardening/Observability metrics
    this.retryCount = 0;
    this.droppedEventsCount = 0;
    this.batchCount = 0;
    this.telemetrySessionId = null;
    this.isFlushing = false;

    // Bind event listeners for clean mounting and unmounting
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    this.handleFullscreenChange = this.handleFullscreenChange.bind(this);
    this.handleCopy = this.handleCopy.bind(this);
    this.handleCut = this.handleCut.bind(this);
    this.handlePaste = this.handlePaste.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  /**
   * Start telemetry session
   */
  start({ attemptId, testId, getCurrentQuestion, getTimeLeft, onViolation }) {
    if (this.isRunning) {
      this.stop();
    }

    this.attemptId = attemptId;
    this.testId = testId;
    this.getCurrentQuestion = getCurrentQuestion;
    this.getTimeLeft = getTimeLeft;
    this.onViolation = onViolation;

    this.queue = [];
    this.offlineQueue = new OfflineQueue(attemptId);
    this.isRunning = true;
    this.lastActivity = Date.now();

    this.retryCount = 0;
    this.droppedEventsCount = 0;
    this.batchCount = 0;
    this.telemetrySessionId = generateUUID();
    this.isFlushing = false;
    this.hasEverEnteredFullscreen = false;

    // 1. Handshake to compute server time offset (tamper protection)
    this.syncServerTime();

    // 2. Attach browser telemetry event listeners
    this.attachListeners();

    // 3. Start batch flush interval (every 8 seconds)
    this.resumeInterval();

    // 4. Start heartbeat ping loop (every 30 seconds)
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);

    // Log startup event
    this.logEvent("start", { init: true }, "low");

    // Flush any leftover offline events from a previous crashed run
    setTimeout(() => this.flushOfflineEvents(), 1000);
  }

  /**
   * Stop telemetry session and clean up timers/listeners
   */
  stop() {
    if (!this.isRunning) return;

    // Log completion event
    this.logEvent("stop", { end: true }, "low");
    this.flushSync(); // synchronous flush on completion

    this.detachListeners();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.isRunning = false;
    this.attemptId = null;
    this.testId = null;
    this.getCurrentQuestion = null;
    this.getTimeLeft = null;
    this.onViolation = null;
    this.offlineQueue = null;
    this.queue = [];
    this.telemetrySessionId = null;
  }

  /**
   * Log an anti-cheat / security event
   */
  logEvent(eventType, metadata = {}, severity = "low") {
    if (!this.isRunning) return;

    const event = {
      id: generateUUID(),
      attemptId: this.attemptId,
      eventType,
      severity,
      clientTime: new Date().toISOString(),
      serverOffset: this.serverOffset,
      questionId: this.getCurrentQuestion ? this.getCurrentQuestion() : null,
      timeLeft: this.getTimeLeft ? this.getTimeLeft() : null,
      metadata,
      sdkVersion: "2.1.0",
      sessionId: this.telemetrySessionId,
    };

    // If local offline queueing is active because browser is offline
    if (!navigator.onLine && this.offlineQueue) {
      this.offlineQueue.enqueue(event);
      return;
    }

    this.queue.push(event);

    // Trigger immediate flush if queue is getting large
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush queued events to backend asynchronously
   */
  async flush() {
    if (!this.isRunning || this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const eventsToFlush = [...this.queue];
    this.queue = [];

    // Enforce max batch size of 100 on frontend
    const batch = eventsToFlush.slice(0, 100);
    const remainder = eventsToFlush.slice(100);
    if (remainder.length > 0) {
      this.queue = [...remainder, ...this.queue];
    }

    const batchUuid = generateUUID();
    const payloadEvents = batch.map((e) => ({
      ...e,
      batchUuid,
      sdkVersion: "2.1.0",
      sessionId: this.telemetrySessionId,
    }));

    try {
      await apiClient.post(`/api/attempt/${this.attemptId}/events`, {
        events: payloadEvents,
      });
      this.batchCount++;
      this.retryCount = 0; // reset retry counter on successful flush
      this.isFlushing = false;
    } catch (err) {
      console.error(
        "[TelemetryService] Failed to flush events, putting back in queue:",
        err,
      );

      // Re-queue failed events at the front
      this.queue = [...batch, ...this.queue];
      this.isFlushing = false;

      // Local storage overflow protection (memory limit: 1000 events)
      if (this.queue.length > 1000) {
        const excess = this.queue.length - 1000;
        this.queue = this.queue.slice(excess); // evict oldest (FIFO)
        this.droppedEventsCount += excess;
      }

      this.scheduleRetry();
    }
  }

  scheduleRetry() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.retryCount++;
    // Exponential backoff: 2s, 4s, 8s, 16s, 30s max, with random jitter
    const delay =
      Math.min(30000, 2000 * Math.pow(2, this.retryCount)) +
      Math.random() * 1000;
    this.retryTimeout = setTimeout(() => {
      this.flush().then(() => {
        if (this.retryCount === 0) {
          this.resumeInterval();
        }
      });
    }, delay);
  }

  resumeInterval() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flush(), 8000);
  }

  /**
   * Synchronously flush pending events (used on unload/beforeunload)
   */
  flushSync() {
    const offlineEventsCount = this.offlineQueue
      ? this.offlineQueue.length()
      : 0;
    if (this.queue.length === 0 && offlineEventsCount === 0) return;

    const events = [
      ...(this.offlineQueue ? this.offlineQueue.dequeueAll() : []),
      ...this.queue,
    ];
    this.queue = [];

    // Limit events payload to 100 for sendBeacon too to prevent server rejection
    const batch = events.slice(0, 100);
    const batchUuid = generateUUID();
    const payloadEvents = batch.map((e) => ({
      ...e,
      batchUuid,
      sdkVersion: "2.1.0",
      sessionId: this.telemetrySessionId,
    }));

    const url = `${apiClient.defaults.baseURL || ""}/api/attempt/${this.attemptId}/events`;
    const payload = JSON.stringify({ events: payloadEvents });

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } catch {
        this.fallbackFlushSync(url, payload);
      }
    } else {
      this.fallbackFlushSync(url, payload);
    }
  }

  fallbackFlushSync(url, payload) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, false); // Synchronous XMLHttpRequest
      xhr.setRequestHeader("Content-Type", "application/json");
      // httpOnly cookie auth: browser sends cookies automatically for same-origin
      // XHR (withCredentials is not set on sync XHR, but cookies are sent for
      // same-origin requests). No Authorization header from JS storage.
      xhr.withCredentials = true;
      xhr.send(payload);
    } catch (err) {
      console.error("[TelemetryService] Fallback sync flush failed:", err);
    }
  }

  /**
   * Flush events queued offline in localStorage
   */
  async flushOfflineEvents() {
    if (
      !this.isRunning ||
      !this.offlineQueue ||
      !navigator.onLine ||
      this.isFlushing
    )
      return;

    const offlineEvents = this.offlineQueue.getAll();
    if (offlineEvents.length === 0) return;

    this.isFlushing = true;
    const batch = offlineEvents.slice(0, 100);
    const remainder = offlineEvents.slice(100);

    const batchUuid = generateUUID();
    const payloadEvents = batch.map((e) => ({
      ...e,
      batchUuid,
      sdkVersion: "2.1.0",
      sessionId: this.telemetrySessionId,
    }));

    try {
      await apiClient.post(`/api/attempt/${this.attemptId}/events`, {
        events: payloadEvents,
      });
      this.batchCount++;
      this.retryCount = 0;

      // Update OfflineQueue
      if (remainder.length > 0) {
        localStorage.setItem(
          this.offlineQueue.storageKey,
          JSON.stringify(remainder),
        );
      } else {
        this.offlineQueue.clear();
      }
      this.isFlushing = false;

      // If there are more offline events, schedule another flush
      if (remainder.length > 0) {
        setTimeout(() => this.flushOfflineEvents(), 1000);
      }
    } catch (err) {
      console.error("[TelemetryService] Failed to flush offline events:", err);
      this.isFlushing = false;
      this.scheduleRetry();
    }
  }

  /**
   * Send heartbeat status ping to backend
   */
  async sendHeartbeat() {
    if (!this.isRunning) return;

    const heartbeatData = {
      attemptId: this.attemptId,
      questionId: this.getCurrentQuestion ? this.getCurrentQuestion() : null,
      timeLeft: this.getTimeLeft ? this.getTimeLeft() : null,
      visibility: document.hidden ? "hidden" : "visible",
      fullscreen: !!document.fullscreenElement,
      network: navigator.onLine ? "online" : "offline",
      lastActivityTime: this.lastActivity,
    };

    try {
      const res = await apiClient.post(
        `/api/attempt/${this.attemptId}/heartbeat`,
        heartbeatData,
      );
      const { attemptStatus, serverTime } = res.data || {};

      if (attemptStatus && attemptStatus !== "active") {
        console.warn(
          `[TelemetryService] Heartbeat reported attempt status: ${attemptStatus}. Stopping telemetry.`,
        );
        if (this.onViolation) {
          this.onViolation("attempt_revoked", { status: attemptStatus });
        }
        this.stop();
        return;
      }

      if (serverTime) {
        // Adjust serverOffset dynamically
        const clientTimeNow = Date.now();
        const serverTimeMs = new Date(serverTime).getTime();
        this.serverOffset = Math.round(serverTimeMs - clientTimeNow);
      }
    } catch (err) {
      console.warn("[TelemetryService] Heartbeat ping failed:", err.message);
    }
  }

  /**
   * Calculate client-server clock skew/offset
   */
  async syncServerTime() {
    const start = Date.now();
    try {
      const res = await apiClient.get("/api/health");
      const serverTimeStr = res.data?.timestamp || res.headers?.date;
      if (serverTimeStr) {
        const serverTime = new Date(serverTimeStr).getTime();
        const latency = Date.now() - start;
        // Offset = ServerTime - Adjusted ClientTime
        this.serverOffset = Math.round(serverTime - (start + latency / 2));
      }
    } catch {
      // Best-effort sync
    }
  }

  /**
   * Expose telemetry metrics for debugging
   */
  getMetrics() {
    const offlineCount = this.offlineQueue ? this.offlineQueue.length() : 0;
    const offlineDropped = this.offlineQueue
      ? this.offlineQueue.getDroppedCount()
      : 0;

    let oldestEventTime = null;
    const allEvents = [
      ...(this.offlineQueue ? this.offlineQueue.getAll() : []),
      ...this.queue,
    ];
    if (allEvents.length > 0) {
      const times = allEvents.map((e) => new Date(e.clientTime).getTime());
      oldestEventTime = Math.min(...times);
    }
    const queueAgeMs = oldestEventTime ? Date.now() - oldestEventTime : 0;

    return {
      queueDepth: this.queue.length + offlineCount,
      queueAgeMs,
      droppedEventsCount: this.droppedEventsCount + offlineDropped,
      batchCount: this.batchCount,
    };
  }

  // ─── Browser Event Listeners ──────────────────────────────────────────────

  attachListeners() {
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("focus", this.handleFocus);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener("copy", this.handleCopy);
    document.addEventListener("cut", this.handleCut);
    document.addEventListener("paste", this.handlePaste);
    document.addEventListener("contextmenu", this.handleContextMenu);
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  detachListeners() {
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("focus", this.handleFocus);
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange,
    );
    document.removeEventListener("copy", this.handleCopy);
    document.removeEventListener("cut", this.handleCut);
    document.removeEventListener("paste", this.handlePaste);
    document.removeEventListener("contextmenu", this.handleContextMenu);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  handleVisibilityChange() {
    this.lastActivity = Date.now();
    if (document.hidden) {
      this.logEvent("visibility_hidden", {}, "medium");
      if (this.onViolation) this.onViolation("tab_switch");
    } else {
      this.logEvent("visibility_visible", {}, "low");
      if (this.onViolation) this.onViolation("visibility_visible");
    }
  }

  handleBlur() {
    this.lastActivity = Date.now();
    this.logEvent("window_blur", {}, "medium");
    if (this.onViolation) this.onViolation("window_blur");
  }

  handleFocus() {
    this.lastActivity = Date.now();
    this.logEvent("window_focus", {}, "low");
    if (this.onViolation) this.onViolation("window_focus");
  }

  handleFullscreenChange() {
    this.lastActivity = Date.now();
    const isFs =
      typeof document !== "undefined" && Boolean(document.fullscreenElement);
    if (isFs) {
      this.hasEverEnteredFullscreen = true;
      this.logEvent("fullscreen_enter", {}, "low");
      if (this.onViolation) this.onViolation("fullscreen_enter");
    } else if (this.hasEverEnteredFullscreen) {
      this.hasEverEnteredFullscreen = false;
      this.logEvent("fullscreen_exit", {}, "high");
      if (this.onViolation) this.onViolation("fullscreen_exit");
    }
  }

  handleCopy(e) {
    this.lastActivity = Date.now();
    this.logEvent("copy", { targetTagName: e.target?.tagName }, "medium");
    if (this.onViolation) this.onViolation("copy", e);
  }

  handleCut(e) {
    this.lastActivity = Date.now();
    this.logEvent("cut", { targetTagName: e.target?.tagName }, "medium");
    if (this.onViolation) this.onViolation("cut", e);
  }

  handlePaste(e) {
    this.lastActivity = Date.now();
    this.logEvent("paste", { targetTagName: e.target?.tagName }, "medium");
    if (this.onViolation) this.onViolation("paste", e);
  }

  handleContextMenu(e) {
    this.lastActivity = Date.now();
    this.logEvent(
      "context_menu",
      { clientX: e.clientX, clientY: e.clientY },
      "low",
    );
    if (this.onViolation) this.onViolation("context_menu", e);
  }

  handleOnline() {
    this.lastActivity = Date.now();
    this.logEvent("online", {}, "low");
    this.flushOfflineEvents();
  }

  handleOffline() {
    this.lastActivity = Date.now();
    this.logEvent("offline", {}, "medium");
  }

  handleBeforeUnload() {
    this.flushSync();
  }
}

export default new TelemetryService();
