import { jest } from '@jest/globals'

describe('WebSocket Active Attempt Registry & Eviction', () => {
  let mockSocket1;
  let mockSocket2;
  let mockIo;
  
  beforeEach(() => {
    mockSocket1 = {
      id: 'socket_111',
      isAuthenticated: true,
      userId: 42,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn()
    };

    mockSocket2 = {
      id: 'socket_222',
      isAuthenticated: true,
      userId: 42,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn()
    };
  });

  test('should register active attempt socket and evict older duplicate tabs', async () => {
    const activeAttemptSockets = new Map();
    const mockSocketsMap = new Map([
      ['socket_111', mockSocket1],
      ['socket_222', mockSocket2]
    ]);

    const handleAttemptJoin = async (socket, data, activeAttemptSocketsInstance) => {
      const { attemptId } = data;
      const newSocketId = socket.id;
      const existingSocketId = activeAttemptSocketsInstance.get(attemptId);
      
      activeAttemptSocketsInstance.set(attemptId, newSocketId);
      socket.attemptId = attemptId;

      if (existingSocketId && existingSocketId !== newSocketId) {
        const oldSocket = mockSocketsMap.get(existingSocketId);
        if (oldSocket) {
          oldSocket.emit('attempt:evicted', {
            attemptId,
            message: 'Evicted'
          });
          oldSocket.leave(`attempt:${attemptId}`);
        }
      }
      socket.join(`attempt:${attemptId}`);
    };

    // 1. First socket joins attempt 99
    await handleAttemptJoin(mockSocket1, { attemptId: 99 }, activeAttemptSockets);
    expect(activeAttemptSockets.get(99)).toBe('socket_111');
    expect(mockSocket1.join).toHaveBeenCalledWith('attempt:99');
    expect(mockSocket1.emit).not.toHaveBeenCalledWith('attempt:evicted', expect.any(Object));

    // 2. Second socket (duplicate tab) joins attempt 99
    await handleAttemptJoin(mockSocket2, { attemptId: 99 }, activeAttemptSockets);
    expect(activeAttemptSockets.get(99)).toBe('socket_222');
    expect(mockSocket2.join).toHaveBeenCalledWith('attempt:99');
    
    // Assert first socket was evicted successfully
    expect(mockSocket1.emit).toHaveBeenCalledWith('attempt:evicted', expect.any(Object));
    expect(mockSocket1.leave).toHaveBeenCalledWith('attempt:99');
  });
});
