import { useEffect, useRef, useState } from "react";
import xoHead from "@/assets/xo-head.png.asset.json";

// Eye centers as fractions of the cropped head image (measured from the artwork).
const EYES = [
  { x: 0.392, y: 0.824 },
  { x: 0.797, y: 0.723 },
];
const EYE_SIZE = 0.215; // eye diameter as a fraction of image width
const IRIS_RATIO = 0.62; // iris diameter relative to the eye

// Touch and mouse share the same peek: disappear near controls, when typing,
// or after inactivity. Mobile also gets a brief welcome peek.
const IDLE_MS = 3000;

export function XoBotPeek() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let idleTimer: number | undefined;
    const viewport = window.visualViewport;
    const mobile = window.matchMedia("(pointer: coarse)").matches;

    function hide() {
      window.clearTimeout(idleTimer);
      setVisible(false);
    }
    function scheduleHide() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(hide, IDLE_MS);
    }
    function isTyping() {
      const focused = document.activeElement;
      return focused instanceof HTMLElement &&
        (focused.matches("input, textarea, select") || focused.isContentEditable);
    }
    function track(x: number, y: number) {
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const cornerZone = mobile ? 140 : 260;
      if (isTyping() || (width + left - x < cornerZone && height + top - y < cornerZone)) {
        hide();
        return;
      }
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height * 0.62);
        const distance = Math.hypot(dx, dy) || 1;
        const strength = Math.min(1, distance / 300);
        setLook({ x: dx / distance * strength, y: dy / distance * strength });
      }
      setVisible(true);
      scheduleHide();
    }
    function onPointer(event: PointerEvent) { track(event.clientX, event.clientY); }
    function onTouch(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) track(touch.clientX, touch.clientY);
    }
    function onFocus() { if (isTyping()) hide(); }

    if (mobile && !isTyping()) { setVisible(true); scheduleHide(); }
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("touchmove", onTouch, { passive: true });
    // Tuck away while scrolling rather than cover the content being read.
    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("focusin", onFocus);
    viewport?.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("scroll", hide);
      document.removeEventListener("focusin", onFocus);
      viewport?.removeEventListener("resize", hide);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-xo-peek="true"
      data-visible={visible}
      className={`pointer-events-none fixed -bottom-1 -right-2 z-40 w-24 select-none transition-all duration-500 ease-out motion-reduce:transition-none sm:-right-3.5 sm:w-44 ${
        visible ? "translate-x-0 translate-y-0 opacity-100" : "translate-x-24 translate-y-24 opacity-0"
      }`}
      aria-hidden="true"
    >
      <img
        src={xoHead.url}
        alt=""
        className="block h-auto w-full drop-shadow-lg"
        draggable={false}
      />
      {EYES.map((eye, i) => (
        <div
          key={i}
          className="xo-eye absolute rounded-full shadow-inner"
          style={{
            left: `${(eye.x - EYE_SIZE / 2) * 100}%`,
            top: `${(eye.y - EYE_SIZE / 2) * 100}%`,
            width: `${EYE_SIZE * 100}%`,
            aspectRatio: "1",
          }}
        >
          <div
            className="xo-iris absolute rounded-full transition-transform duration-100 ease-out motion-reduce:transition-none"
            style={{
              inset: `${(1 - IRIS_RATIO) * 50}%`,
              transform: `translate(${look.x * 40}%, ${look.y * 40}%)`,
            }}
          >
            <div className="xo-pupil absolute rounded-full" style={{ inset: "22%" }} />
            <div
              className="xo-eye absolute rounded-full"
              style={{ width: "26%", height: "26%", left: "18%", top: "14%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
