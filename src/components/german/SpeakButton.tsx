'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Web Speech API playback — Section 11.1.
 *
 * Free and offline-capable, with no audio to host. A German voice is not
 * guaranteed to be installed, so the button reports that plainly rather than
 * staying enabled and silently doing nothing.
 */
export function SpeakButton({
  text,
  lang = 'de-DE',
  className,
}: {
  text: string;
  lang?: string;
  className?: string;
}) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setReady(true);
      return;
    }

    const pick = () => {
      const target = lang.slice(0, 2).toLowerCase();
      const match = window.speechSynthesis
        .getVoices()
        .find((candidate) => candidate.lang.toLowerCase().startsWith(target));
      setVoice(match ?? null);
      setReady(true);
    };

    pick();
    // Voices load asynchronously in most browsers, so the first call often
    // returns an empty list.
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pick);
  }, [lang]);

  const speak = () => {
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const unavailable = ready && !voice;

  return (
    <button
      type="button"
      onClick={speak}
      disabled={!ready || unavailable}
      title={
        unavailable ? 'No German voice is installed on this device' : `Listen: ${text}`
      }
      aria-label={
        unavailable ? 'Audio unavailable, no German voice installed' : `Listen: ${text}`
      }
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-sm',
        'text-ink-muted transition-colors hover:bg-accent-soft hover:text-accent',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
        speaking && 'bg-accent-soft text-accent',
        className,
      )}
    >
      <Volume2 aria-hidden className="size-4" />
    </button>
  );
}
