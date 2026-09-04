import {
  ATTEMPT_STATES,
  isValidAttemptTransition,
} from "../constants/lifecycle.constants.js";

describe("Attempt State Machine & Lifecycle Transitions", () => {
  describe("Valid State Transitions", () => {
    test("CREATED can transition to IN_PROGRESS and CANCELLED", () => {
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.CREATED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.CREATED,
          ATTEMPT_STATES.CANCELLED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.CREATED,
          ATTEMPT_STATES.COMPLETED,
        ),
      ).toBe(false);
    });

    test("IN_PROGRESS can transition to PAUSED, SUBMITTING, COMPLETED, AUTO_SUBMITTED, EXPIRED", () => {
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.PAUSED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.SUBMITTING,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.COMPLETED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.AUTO_SUBMITTED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.EXPIRED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.IN_PROGRESS,
          ATTEMPT_STATES.CREATED,
        ),
      ).toBe(false);
    });

    test("PAUSED can resume to IN_PROGRESS or submit directly", () => {
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.PAUSED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.PAUSED,
          ATTEMPT_STATES.COMPLETED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.PAUSED,
          ATTEMPT_STATES.AUTO_SUBMITTED,
        ),
      ).toBe(true);
    });

    test("SUBMITTING can complete, auto-submit, or fall back to in_progress on retry", () => {
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.SUBMITTING,
          ATTEMPT_STATES.COMPLETED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.SUBMITTING,
          ATTEMPT_STATES.AUTO_SUBMITTED,
        ),
      ).toBe(true);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.SUBMITTING,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(true);
    });

    test("Terminal states (COMPLETED, AUTO_SUBMITTED, EXPIRED, CANCELLED) cannot transition anywhere", () => {
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.COMPLETED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(false);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.COMPLETED,
          ATTEMPT_STATES.SUBMITTING,
        ),
      ).toBe(false);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.COMPLETED,
          ATTEMPT_STATES.COMPLETED,
        ),
      ).toBe(false);

      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.AUTO_SUBMITTED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(false);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.EXPIRED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(false);
      expect(
        isValidAttemptTransition(
          ATTEMPT_STATES.CANCELLED,
          ATTEMPT_STATES.IN_PROGRESS,
        ),
      ).toBe(false);
    });
  });
});
