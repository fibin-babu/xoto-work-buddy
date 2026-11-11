import { useEffect, useRef, useState } from "react";
import xoBot from "@/assets/xo-bot.png";

// Eye centers as fractions of the mascot image (measured from the artwork).
const EYES = [
  { x: 0.424, y: 0.375 },
  { x: 0.64, y: 0.35 },
];
const EYE_SIZE = 0.145; // eye diameter as a fraction of image width
const IRIS_RATIO = 0.62; // iris diameter relative to the eye

export function XoBot({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function track(x: number, y: number) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.36; // roughly the face
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // Ease off with distance so the eyes glide instead of snapping.
      const strength = Math.min(1, dist / 300);
      setLook({ x: (dx / dist) * strength, y: (dy / dist) * strength });
    }
    function onMove(e: PointerEvent) { track(e.clientX, e.clientY); }
    function onTouch(e: TouchEvent) {
      const touch = e.touches[0];
      if (touch) track(touch.clientX, touch.clientY);
    }
    function reset() { setLook({ x: 0, y: 0 }); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("pointerup", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("pointerup", reset);
    };
  }, []);

  return (
    <div ref={ref} className={`relative select-none ${className}`}>
      <img src={xoBot} alt="XO, the Xoto bot" className="block h-auto w-full" draggable={false} />
      {EYES.map((eye, i) => (
        <div
          key={i}
          className="xo-eye absolute rounded-full shadow-inner"
          style={{
            left: `${(eye.x - EYE_SIZE / 2) * 100}%`,
            top: `${(eye.y - (EYE_SIZE * 1.0) / 2) * 100}%`,
            width: `${EYE_SIZE * 100}%`,
            aspectRatio: "1",
          }}
        >
          <div
            className="xo-iris absolute rounded-full transition-transform duration-100 ease-out motion-reduce:transition-none"
            style={{
              inset: `${(1 - IRIS_RATIO) * 50}%`,
              transform: `translate(${look.x * 42}%, ${look.y * 42}%)`,
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
