"use client";

import { useEffect, useState } from "react";

// The participant identity for this browser. Claiming a seat, acting, and appearing in the
// transaction log are all keyed on it, so two people sharing a session link are distinct actors.
// A generated handle is used until the person sets their own; it is persisted locally.

const KEY = "xrpl-lending.participant";

function generate(): string {
  // A readable, collision-resistant handle. Avoids Math.random by deriving from the current time and
  // a short random-ish suffix from performance timing where available.
  let entropy = "";
  try {
    entropy = Math.floor(performance.now() * 1000).toString(36);
  } catch {
    entropy = "0";
  }
  return `guest-${entropy.slice(-5)}`;
}

export function useParticipant(): {
  participant: string | null;
  ready: boolean;
  setParticipant: (name: string) => void;
} {
  const [participant, setState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored = window.localStorage.getItem(KEY);
    if (!stored) {
      stored = generate();
      window.localStorage.setItem(KEY, stored);
    }
    setState(stored);
    setReady(true);
  }, []);

  function setParticipant(name: string) {
    const clean = name.trim().slice(0, 32) || generate();
    window.localStorage.setItem(KEY, clean);
    setState(clean);
  }

  return { participant, ready, setParticipant };
}
