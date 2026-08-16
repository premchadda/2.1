import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import Telemetry from '../src/shared/lib/telemetry/TelemetryService';
import OfflineQueue from '../src/shared/lib/telemetry/OfflineQueue';
import { apiClient } from '../src/shared/lib/apiClient';

describe('Telemetry SDK Suite', () => {
  let postSpy;
  let _getSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    
    // Stub network-bound telemetry calls to prevent actual XHR / Beacon requests in tests
    vi.spyOn(Telemetry, 'syncServerTime').mockImplementation(() => Promise.resolve());
    vi.spyOn(Telemetry, 'flushSync').mockImplementation(() => {});
    
    // Use vi.spyOn to mock the actual shared axios instance methods
    postSpy = vi.spyOn(apiClient, 'post').mockImplementation(() => Promise.resolve({ data: { success: true } }));
    _getSpy = vi.spyOn(apiClient, 'get').mockImplementation(() => Promise.resolve({ data: { timestamp: new Date().toISOString() } }));
  });

  afterEach(() => {
    Telemetry.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('OfflineQueue', () => {
    test('should save and clear offline events in localStorage', () => {
      const q = new OfflineQueue('attempt_123');
      const testEvent = { id: 'evt-1', eventType: 'tab_switch', clientTime: new Date().toISOString() };
      
      q.enqueue(testEvent);
      expect(q.length()).toBe(1);
      
      const stored = q.getAll();
      expect(stored[0].id).toBe('evt-1');
      
      const dequeued = q.dequeueAll();
      expect(dequeued.length).toBe(1);
      expect(q.length()).toBe(0);
      expect(localStorage.getItem('trstprep_telemetry_offline_attempt_123')).toBeNull();
    });

    test('should cap queue length at 1000 and evict oldest and track drops', () => {
      const q = new OfflineQueue('attempt_123');
      
      for (let i = 0; i < 1005; i++) {
        q.enqueue({ id: `evt-${i}`, index: i });
      }
      
      expect(q.length()).toBe(1000);
      const all = q.getAll();
      // Oldest 5 (index 0 to 4) should be evicted
      expect(all[0].index).toBe(5);
      expect(all[999].index).toBe(1004);
      expect(q.getDroppedCount()).toBe(5);
    });
  });

  describe('TelemetryService Lifecycle', () => {
    test('should initialize listeners and intervals on start()', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const winAddSpy = vi.spyOn(window, 'addEventListener');
      
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });

      expect(Telemetry.isRunning).toBe(true);
      expect(Telemetry.attemptId).toBe('att_123');
      
      expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(winAddSpy).toHaveBeenCalledWith('blur', expect.any(Function));
      
      addSpy.mockRestore();
      winAddSpy.mockRestore();
    });

    test('should clean up listeners and intervals on stop()', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const winRemoveSpy = vi.spyOn(window, 'removeEventListener');
      
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });

      Telemetry.stop();

      expect(Telemetry.isRunning).toBe(false);
      expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(winRemoveSpy).toHaveBeenCalledWith('blur', expect.any(Function));

      removeSpy.mockRestore();
      winRemoveSpy.mockRestore();
    });
  });

  describe('Event Batching & Heartbeat', () => {
    test('should flush events on 8 second interval', async () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });

      Telemetry.queue = []; // Clear auto-generated 'start' event to isolate test case
      Telemetry.logEvent('tab_switch', { count: 1 });
      expect(Telemetry.queue.length).toBe(1);
      expect(postSpy).not.toHaveBeenCalled();

      // Fast-forward 8 seconds
      await vi.advanceTimersByTimeAsync(8000);

      expect(postSpy).toHaveBeenCalledWith('/api/attempt/att_123/events', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ eventType: 'tab_switch' })
        ])
      }));
      expect(Telemetry.queue.length).toBe(0);
    });

    test('should flush instantly if queue has 10 events', () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });

      Telemetry.queue = []; // Clear auto-generated 'start' event to isolate test case
      for (let i = 0; i < 9; i++) {
        Telemetry.logEvent('tab_switch', { count: i });
      }
      expect(postSpy).not.toHaveBeenCalled();

      // Tenth event triggers immediate flush
      Telemetry.logEvent('tab_switch', { count: 9 });
      expect(postSpy).toHaveBeenCalledWith('/api/attempt/att_123/events', expect.any(Object));
      expect(Telemetry.queue.length).toBe(0);
    });

    test('should send heartbeat ping every 30 seconds', async () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });

      expect(postSpy).not.toHaveBeenCalledWith('/api/attempt/att_123/heartbeat', expect.any(Object));

      // Fast forward 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      expect(postSpy).toHaveBeenCalledWith('/api/attempt/att_123/heartbeat', expect.any(Object));
    });

    test('should include sdkVersion, batchUuid, and sessionId in event payloads during flush', async () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });
      Telemetry.queue = [];
      Telemetry.logEvent('tab_switch', { count: 1 });
      
      await vi.advanceTimersByTimeAsync(8000);

      expect(postSpy).toHaveBeenCalledWith('/api/attempt/att_123/events', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'tab_switch',
            sdkVersion: '2.1.0',
            batchUuid: expect.any(String),
            sessionId: expect.any(String)
          })
        ])
      }));
    });

    test('should return debugging metrics via getMetrics()', () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });
      Telemetry.queue = [];
      Telemetry.logEvent('tab_switch', { count: 1 });

      const metrics = Telemetry.getMetrics();
      expect(metrics.queueDepth).toBe(1);
      expect(metrics.droppedEventsCount).toBe(0);
      expect(metrics.batchCount).toBe(0);
    });

    test('should stop telemetry session if heartbeat response contains attemptStatus !== active', async () => {
      const violationMock = vi.fn();
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: violationMock
      });

      // Mock heartbeat response to return revoked
      postSpy.mockImplementation((url) => {
        if (url.endsWith('/heartbeat')) {
          return Promise.resolve({ data: { success: true, attemptStatus: 'revoked', serverTime: new Date().toISOString() } });
        }
        return Promise.resolve({ data: { success: true } });
      });

      await vi.advanceTimersByTimeAsync(30000);

      expect(Telemetry.isRunning).toBe(false);
      expect(violationMock).toHaveBeenCalledWith('attempt_revoked', { status: 'revoked' });
    });

    test('should execute retry backoff on flush failure', async () => {
      Telemetry.start({
        attemptId: 'att_123',
        testId: 'test_456',
        getCurrentQuestion: () => 'q_789',
        getTimeLeft: () => 1800,
        onViolation: vi.fn()
      });
      Telemetry.queue = [];
      Telemetry.logEvent('tab_switch', { count: 1 });

      // Make first post request fail
      postSpy.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      // Fast-forward 8 seconds to trigger flush
      await vi.advanceTimersByTimeAsync(8000);

      expect(Telemetry.queue.length).toBe(1); // event is put back in queue
      expect(Telemetry.retryCount).toBe(1);

      // Reset mock to succeed on next retry
      postSpy.mockImplementation(() => Promise.resolve({ data: { success: true } }));

      // Advance timers by backoff delay (~4-5 seconds)
      await vi.advanceTimersByTimeAsync(6000);

      expect(Telemetry.queue.length).toBe(0); // successfully flushed
      expect(Telemetry.retryCount).toBe(0); // reset retry count
    });
  });
});
