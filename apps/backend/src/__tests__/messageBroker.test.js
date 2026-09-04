import { jest } from "@jest/globals";
import { messageBroker } from "../infrastructure/events/messageBroker.js";

describe("Event-Driven Message Broker Architecture", () => {
  beforeEach(async () => {
    // Ensure we start fresh for each test
    await messageBroker.close();
  });

  afterEach(async () => {
    await messageBroker.close();
  });

  it("should register subscribers and trigger them on publish", async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    // Subscribe to test event
    messageBroker.subscribe("test.event", handler1);
    messageBroker.subscribe("test.event", handler2);

    const payload = { data: "hello event world" };
    await messageBroker.publish("test.event", payload);

    expect(handler1).toHaveBeenCalledWith(payload, { isExternalSource: false });
    expect(handler2).toHaveBeenCalledWith(payload, { isExternalSource: false });
  });

  it("should support unsubscribing via the returned cleanup function", async () => {
    const handler = jest.fn();
    const unsubscribe = messageBroker.subscribe("another.event", handler);

    const payload = { success: true };
    await messageBroker.publish("another.event", payload);
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();

    await messageBroker.publish("another.event", payload);
    // Should still be 1, because handler was unsubscribed
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should handle subscriber exceptions gracefully without crashing publish flow", async () => {
    const badHandler = jest.fn().mockImplementation(() => {
      throw new Error("Subscriber failed!");
    });
    const goodHandler = jest.fn();

    messageBroker.subscribe("broken.event", badHandler);
    messageBroker.subscribe("broken.event", goodHandler);

    const payload = { testing: true };
    // Should resolve without throwing error
    await expect(
      messageBroker.publish("broken.event", payload),
    ).resolves.not.toThrow();

    expect(badHandler).toHaveBeenCalledWith(payload, {
      isExternalSource: false,
    });
    expect(goodHandler).toHaveBeenCalledWith(payload, {
      isExternalSource: false,
    });
  });
});
