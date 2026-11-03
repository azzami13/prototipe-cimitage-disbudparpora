'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || iosNavigator.standalone === true;
}

function isIosSafari() {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  return ios && safari;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIosSafari(isIosSafari());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstalled(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosGuide(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      return;
    }
    if (iosSafari) setShowIosGuide(true);
  }, [installPrompt, iosSafari]);

  return {
    canInstall: !installed && (Boolean(installPrompt) || iosSafari),
    install,
    showIosGuide,
    closeIosGuide: () => setShowIosGuide(false),
  };
}
