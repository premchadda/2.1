import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom React Hook for Bilingual Solution Audio Narration via Web Speech API
 */
export function useAudioExplainer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const utteranceRef = useRef(null);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!isSupported) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices() || [];
      setVoices(available);
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported || !isPlaying || isPaused) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported, isPlaying, isPaused]);

  const resume = useCallback(() => {
    if (!isSupported || !isPlaying || !isPaused) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported, isPlaying, isPaused]);

  const play = useCallback(
    (script = "", language = "en") => {
      if (!isSupported || !script) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(script);
      utterance.rate = speed;
      utterance.lang = language === "hi" ? "hi-IN" : "en-IN";

      // Pick matching voice if found
      if (voices.length > 0) {
        const langPrefix = language === "hi" ? "hi" : "en";
        const matchedVoice = voices.find(
          (v) => v.lang && v.lang.toLowerCase().startsWith(langPrefix),
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        }
      }

      utterance.onstart = () => {
        setIsPlaying(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      utterance.onerror = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, speed, voices],
  );

  return {
    isSupported,
    isPlaying,
    isPaused,
    speed,
    setSpeed,
    play,
    pause,
    resume,
    stop,
  };
}

export default useAudioExplainer;
