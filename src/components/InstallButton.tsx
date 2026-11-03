import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InstallButton() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const h = (e: Event) => { e.preventDefault(); setPrompt(e); };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const inFrame = window.self !== window.top;
    toast.info(
      inFrame
        ? "Open the published site in a new tab to install the app."
        : ios
          ? /crios|fxios|edgios/i.test(ua)
            ? "Tap the Share button, then “Add to Home Screen” (iOS 16.4+), or open in Safari."
            : "Tap the Share button in Safari, then “Add to Home Screen”."
          : /firefox/i.test(ua)
            ? "Firefox desktop can't install apps — use Chrome or Edge. On Android, use menu → “Install”."
            : /safari/i.test(ua) && !/chrome/i.test(ua)
              ? "In Safari on Mac, choose File → “Add to Dock”."
              : "Use your browser menu → “Install app” or “Add to Home screen”.",
      { duration: 8000 },
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={install} aria-label="Install app" title="Install app">
      <Download />
    </Button>
  );
}
