import { describe, it, expect } from "@jest/globals";
import { isDisposableEmail } from "../src/utils/disposable-emails.js";

describe("Disposable Email Detector", () => {
  it("should detect common throwaway and burner email domains", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
    expect(isDisposableEmail("bot123@temp-mail.org")).toBe(true);
    expect(isDisposableEmail("fake@10minutemail.com")).toBe(true);
    expect(isDisposableEmail("throwaway@guerrillamail.com")).toBe(true);
    expect(isDisposableEmail("user@yopmail.com")).toBe(true);
    expect(isDisposableEmail("burner@trashmail.com")).toBe(true);
    expect(isDisposableEmail("temp@sharklasers.com")).toBe(true);
    expect(isDisposableEmail("spam@inboxkitten.com")).toBe(true);
  });

  it("should detect disposable subdomains", () => {
    expect(isDisposableEmail("user@sub.mailinator.com")).toBe(true);
    expect(isDisposableEmail("user@custom.tempmail.com")).toBe(true);
  });

  it("should allow legitimate permanent email domains", () => {
    expect(isDisposableEmail("student@gmail.com")).toBe(false);
    expect(isDisposableEmail("learner@yahoo.com")).toBe(false);
    expect(isDisposableEmail("candidate@outlook.com")).toBe(false);
    expect(isDisposableEmail("admin@trstprep.com")).toBe(false);
    expect(isDisposableEmail("user@university.ac.in")).toBe(false);
    expect(isDisposableEmail("dev@company.org")).toBe(false);
  });

  it("should handle malformed or empty inputs gracefully", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail(null)).toBe(false);
    expect(isDisposableEmail(undefined)).toBe(false);
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });
});
