import { useState, useEffect, useRef } from "react";
// NOTE: the app's socket singleton lives in shared/lib/websocket.js, which is
// owned by this module's useWebSocket (the one AuthProvider calls directly) —
// NOT the same-named re-export in hooks/index.js, which points at
// @trstprep/shared-hooks and keeps a separate socket. Importing the sibling
// keeps this hook on the same singleton the live-test events are emitted on.
import { useWebSocket } from "./useWebSocket";

/**
 * Hook to monitor live test activity in real-time
 * @param {string} testId - The test ID to monitor
 * @returns {Object} Real-time test data
 */
export function useLiveTestMonitor(testId) {
  const [participants, setParticipants] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const joinedRef = useRef(false);

  // Also makes this component a socket consumer, so the connection exists even
  // if this hook is ever used outside AuthProvider's subtree.
  const { isConnected, on, emit } = useWebSocket(Boolean(testId));

  useEffect(() => {
    if (!testId) return undefined;

    const joinRoom = () => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      emit("live-tests:join", { testId });
    };

    // If the socket is not connected yet, wait for the 'connect' event
    // before joining the room. Previously this returned early immediately,
    // and the effect never retried — leaving the component with 0
    // participants and no leaderboard updates permanently.
    if (isConnected) {
      joinRoom();
    }

    // Listen for live test updates. `on()` queues the registration when the
    // socket does not exist yet, so the child-effect ordering problem (this
    // page's effect flushing before AuthProvider's) can no longer drop the
    // listeners. Each returned unsubscribe also detaches queued entries, so
    // unmount still leaves nothing behind.
    const offConnect = on("connect", joinRoom);

    const handleSubmission = (data) => {
      if (data.testId === testId) {
        setSubmissions((prev) => [
          ...prev.slice(-50),
          { ...data, timestamp: new Date().toISOString() },
        ]);
      }
    };

    const handleLeaderboardUpdate = (data) => {
      if (data.testId === testId) {
        setLeaderboard(data.entries || []);
      }
    };

    const handleParticipantCount = (data) => {
      if (data.testId === testId) {
        setParticipants(data.count || 0);
        setIsLive(data.isLive ?? true);
      }
    };

    const offSubmission = on("live-test:attempt_submitted", handleSubmission);
    const offLeaderboard = on("leaderboard:updated", handleLeaderboardUpdate);
    const offCount = on("live-test:participant_count", handleParticipantCount);

    return () => {
      joinedRef.current = false;
      offConnect();
      offSubmission();
      offLeaderboard();
      offCount();
      emit("live-tests:leave", { testId });
    };
  }, [testId, isConnected, on, emit]);

  return { participants, submissions, leaderboard, isLive };
}
