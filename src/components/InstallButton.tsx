import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function InstallButton() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const h = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", h);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      ios
        ? "Tap the Share button in Safari, then “Add to Home Screen”."
        : "Use your browser menu → “Install app” or “Add to Home screen”. Works best on the published site.",
    );
  }

  return (
    <Button variant="ghost" size="icon" onClick={install} aria-label="Install app" title="Install app">
      <Download />
    </Button>
  );
}
