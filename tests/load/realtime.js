import ws from "k6/ws";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { config } from "./k6.config.js";

const BASE_URL = config.baseUrl.replace("http", "ws");

const wsSuccessRate = new Rate("ws_success_rate");
const wsConnectionDuration = new Trend("ws_connection_duration", true);
const wsMessagesSent = new Counter("ws_messages_sent");
const wsMessagesReceived = new Counter("ws_messages_received");

export const options = {
  stages: [
    { duration: "1m", target: 5 },
    { duration: "2m", target: 20 },
    { duration: "3m", target: 20 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    ws_success_rate: ["rate>0.95"],
    ws_connection_duration: ["p(95)<2000"],
  },
};

function getAuthToken() {
  const password = __ENV.TEST_PASSWORD;
  if (!password) {
    console.warn(
      "TEST_PASSWORD environment variable is not set for load test.",
    );
  }
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "admin@trstprep.com",
    password: password || "",
  });

  const res = __ENV.HTTP
    ? fetch(`${config.baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      })
    : null;

  if (res && res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      return body.token || "";
    } catch (e) {
      return "";
    }
  }
  return "";
}

function testWebSocketConnection(token) {
  const url = `${BASE_URL}/ws${token ? `?token=${token}` : ""}`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    let connected = false;

    socket.on("open", () => {
      connected = true;
      wsSuccessRate.add(true);
      wsConnectionDuration.add(Date.now() - startTime);
      wsMessagesSent.add(1);

      socket.send(
        JSON.stringify({
          type: "ping",
          timestamp: Date.now(),
        }),
      );
    });

    socket.on("message", (msg) => {
      wsMessagesReceived.add(1);

      try {
        const data = JSON.parse(msg);
        check(data, {
          "ws message has type": (d) => d.type !== undefined,
        });
      } catch (e) {
        // ignore parse errors
      }
    });

    socket.on("error", (e) => {
      wsSuccessRate.add(false);
      if (!connected) {
        wsConnectionDuration.add(Date.now() - startTime);
      }
    });

    socket.on("close", () => {
      if (!connected) {
        wsSuccessRate.add(false);
      }
    });

    sleep(5);

    socket.send(
      JSON.stringify({
        type: "subscribe",
        channel: "test-updates",
      }),
    );

    wsMessagesSent.add(1);

    sleep(10);

    socket.close();
  });

  check(res, {
    "ws connection successful": (r) => r && r.status === 101,
  });
}

function testWebSocketWithPing(token) {
  const url = `${BASE_URL}/ws${token ? `?token=${token}` : ""}`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    let pingCount = 0;
    const maxPings = 5;

    socket.on("open", () => {
      wsSuccessRate.add(true);
      wsConnectionDuration.add(Date.now() - startTime);

      function sendPing() {
        if (pingCount >= maxPings) {
          socket.close();
          return;
        }

        socket.send(
          JSON.stringify({
            type: "ping",
            id: pingCount,
            timestamp: Date.now(),
          }),
        );

        wsMessagesSent.add(1);
        pingCount++;

        sleep(2);
        sendPing();
      }

      sendPing();
    });

    socket.on("message", (msg) => {
      wsMessagesReceived.add(1);

      try {
        const data = JSON.parse(msg);
        check(data, {
          "pong received": (d) => d.type === "pong",
        });
      } catch (e) {
        // ignore
      }
    });

    socket.on("error", () => {
      wsSuccessRate.add(false);
    });

    sleep(15);
  });

  check(res, {
    "ws ping connection successful": (r) => r && r.status === 101,
  });
}

function testWebSocketBroadcast(token) {
  const url = `${BASE_URL}/ws${token ? `?token=${token}` : ""}`;

  const startTime = Date.now();

  const res = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      wsSuccessRate.add(true);
      wsConnectionDuration.add(Date.now() - startTime);

      socket.send(
        JSON.stringify({
          type: "subscribe",
          channel: "broadcast",
        }),
      );

      wsMessagesSent.add(1);
    });

    socket.on("message", (msg) => {
      wsMessagesReceived.add(1);
    });

    socket.on("error", () => {
      wsSuccessRate.add(false);
    });

    sleep(10);

    socket.send(
      JSON.stringify({
        type: "broadcast",
        message: "Load test broadcast",
        timestamp: Date.now(),
      }),
    );

    wsMessagesSent.add(1);

    sleep(5);
    socket.close();
  });

  check(res, {
    "ws broadcast connection successful": (r) => r && r.status === 101,
  });
}

export default function () {
  const token = getAuthToken();

  const scenario = Math.random();

  if (scenario < 0.4) {
    testWebSocketConnection(token);
  } else if (scenario < 0.7) {
    testWebSocketWithPing(token);
  } else {
    testWebSocketBroadcast(token);
  }

  sleep(2);
}

export function handleSummary(data) {
  return {
    "tests/load/summary-realtime.json": JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || "";
  let summary = "\n";

  summary += `${indent}========================================\n`;
  summary += `${indent}  WebSocket Load Test Summary\n`;
  summary += `${indent}========================================\n`;
  summary += `${indent}  Connections Attempted: ${data.metrics.ws_messages_sent?.values?.count || 0}\n`;
  summary += `${indent}  Messages Received: ${data.metrics.ws_messages_received?.values?.count || 0}\n`;
  summary += `${indent}  Success Rate: ${(data.metrics.ws_success_rate?.values?.rate * 100 || 0).toFixed(2)}%\n`;
  summary += `${indent}  Avg Connection Duration: ${data.metrics.ws_connection_duration?.values?.avg?.toFixed(2) || 0}ms\n`;
  summary += `${indent}  P95 Connection Duration: ${data.metrics.ws_connection_duration?.values?.["p(95)"]?.toFixed(2) || 0}ms\n`;
  summary += `${indent}========================================\n`;

  return summary;
}
