import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useAudioExplainer from "../shared/hooks/useAudioExplainer.js";

describe("useAudioExplainer hook", () => {
  let mockSpeak;
  let mockCancel;
  let mockPause;
  let mockResume;
  let mockGetVoices;

  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockPause = vi.fn();
    mockResume = vi.fn();
    mockGetVoices = vi.fn().mockReturnValue([
      { name: "Google English", lang: "en-IN" },
      { name: "Google Hindi", lang: "hi-IN" },
    ]);

    // Mock window.speechSynthesis
    window.speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      getVoices: mockGetVoices,
      onvoiceschanged: null,
    };

    // Mock SpeechSynthesisUtterance
    global.SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      constructor(text) {
        this.text = text;
        this.rate = 1.0;
        this.lang = "en-IN";
        this.voice = null;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    };
  });

  it("initializes with default state and detects browser support", () => {
    const { result } = renderHook(() => useAudioExplainer());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.speed).toBe(1.0);
  });

  it("plays audio script with appropriate language and speech rate", () => {
    const { result } = renderHook(() => useAudioExplainer());

    act(() => {
      result.current.setSpeed(1.25);
    });

    act(() => {
      result.current.play("Let us understand the solution", "en");
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe("Let us understand the solution");
    expect(utterance.rate).toBe(1.25);
  });

  it("selects Hindi voice when language is hi", () => {
    const { result } = renderHook(() => useAudioExplainer());

    act(() => {
      result.current.play("यह एक हिंदी विवरण है", "hi");
    });

    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.lang).toBe("hi-IN");
    expect(utterance.voice?.lang).toBe("hi-IN");
  });

  it("handles pause, resume, and stop controls correctly", () => {
    const { result } = renderHook(() => useAudioExplainer());

    act(() => {
      result.current.play("Testing audio controls");
    });

    // Simulate start callback
    const utterance = mockSpeak.mock.calls[0][0];
    act(() => {
      if (utterance.onstart) utterance.onstart();
    });
    expect(result.current.isPlaying).toBe(true);

    // Pause
    act(() => {
      result.current.pause();
    });
    expect(mockPause).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);

    // Resume
    act(() => {
      result.current.resume();
    });
    expect(mockResume).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);

    // Stop
    act(() => {
      result.current.stop();
    });
    expect(mockCancel).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });
});
