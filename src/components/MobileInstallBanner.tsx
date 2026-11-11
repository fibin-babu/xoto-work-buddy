import { useEffect, useState } from "react";
import { Share, SquarePlus, X, Download, MoreVertical } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import logo from "@/assets/xoto-logo.png";

const DISMISS_KEY = "xoto-install-banner-dismissed";

type Platform = "ios" | "android" | "other";

type InstallPrompt = Event & { prompt: () => void; userChoice: Promise<unknown> };

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * On a phone, invites the person to install the app to their home screen, with the
 * right steps for iPhone (Safari Share → Add to Home Screen) and Android (native
 * install prompt, or the browser menu). Hidden once installed or dismissed.
 */
export function MobileInstallBanner() {
  const isMobile = useIsMobile();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* ignore */ }
    if (dismissed) return;

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    setPlatform(ios ? "ios" : android ? "android" : "other");
    setShow(true);

    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => { setShow(false); try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!isMobile || !show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img src={logo} alt="" className="h-9 w-auto shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Install the Xoto app</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Add it to your home screen to clock in faster, like a normal app.</p>
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {prompt ? (
          <Button variant="brand" className="mt-3 w-full" onClick={install}>
            <Download /> Install app
          </Button>
        ) : platform === "ios" ? (
          <ol className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Step n={1} />
              <span className="flex flex-wrap items-center gap-1">Tap the Share button <Share className="inline h-4 w-4 text-primary" /> in Safari’s toolbar.</span>
            </li>
            <li className="flex items-center gap-2">
              <Step n={2} />
              <span className="flex flex-wrap items-center gap-1">Choose <strong>Add to Home Screen</strong> <SquarePlus className="inline h-4 w-4 text-primary" />.</span>
            </li>
            <li className="flex items-center gap-2">
              <Step n={3} />
              <span>Tap <strong>Add</strong>. Open Xoto from your home screen.</span>
            </li>
          </ol>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Step n={1} />
              <span className="flex flex-wrap items-center gap-1">Open the browser menu <MoreVertical className="inline h-4 w-4 text-primary" /> (top-right).</span>
            </li>
            <li className="flex items-center gap-2">
              <Step n={2} />
              <span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>;
}
