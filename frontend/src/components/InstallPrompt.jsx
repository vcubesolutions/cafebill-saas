import React, { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [prompt, setPrompt]       = useState(null);   // Android/Chrome deferred prompt
  const [showIOS, setShowIOS]     = useState(false);  // iOS instructions banner
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    // Don't show if user dismissed before
    if (localStorage.getItem("pwa_prompt_dismissed")) return;

    // Android/Chrome — capture the beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection (no beforeinstallprompt on iOS)
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    if (isIOS && isSafari) setShowIOS(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem("pwa_prompt_dismissed", "1");
    setDismissed(true);
    setShowIOS(false);
    setPrompt(null);
  };

  if (dismissed || installed) return null;

  // ── Android / Chrome install banner ────────────────────────
  if (prompt) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pb-safe">
        <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 p-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-2xl">☕</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">Install CafeBill App</p>
            <p className="text-xs text-gray-500">Add to home screen for quick access</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={dismiss}
              className="text-xs text-gray-400 px-3 py-2 rounded-xl hover:bg-gray-100">
              Not now
            </button>
            <button onClick={handleInstall}
              className="bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-orange-700">
              Install
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS "Add to Home Screen" instructions ─────────────────
  if (showIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3">
        <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📲</span>
              <p className="font-bold text-sm">Install CafeBill on your iPhone</p>
            </div>
            <button onClick={dismiss} className="text-gray-400 text-lg leading-none px-1">✕</button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <span className="text-lg shrink-0">1️⃣</span>
              <p className="text-xs text-gray-300">
                Tap the <span className="font-bold text-white">Share</span> button{" "}
                <span className="inline-block bg-gray-700 px-2 py-0.5 rounded text-xs">⬆</span>{" "}
                at the bottom of Safari
              </p>
            </div>
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <span className="text-lg shrink-0">2️⃣</span>
              <p className="text-xs text-gray-300">
                Scroll down and tap{" "}
                <span className="font-bold text-white">"Add to Home Screen"</span>
              </p>
            </div>
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <span className="text-lg shrink-0">3️⃣</span>
              <p className="text-xs text-gray-300">
                Tap <span className="font-bold text-white">"Add"</span> — CafeBill opens like a native app!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
