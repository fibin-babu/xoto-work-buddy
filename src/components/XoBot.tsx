import { useEffect, useRef, useState } from "react";
import xoBot from "@/assets/xo-bot.png.asset.json";

// Eye centers as fractions of the mascot image (measured from the artwork).
const EYES = [
  { x: 0.424, y: 0.375 },
  { x: 0.64, y: 0.35 },
];
const EYE_SIZE = 0.145; // eye diameter as a fraction of image width
const IRIS_RATIO = 0.62; // iris diameter relative to the eye
const MAX_TRAVEL = 0.16; // how far the iris can move, relative to eye size

export function XoBot({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.36; // roughly the face
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // Ease off with distance so the eyes glide instead of snapping.
      const strength = Math.min(1, dist / 300);
      setLook({ x: (dx / dist) * strength, y: (dy / dist) * strength });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className={`relative select-none ${className}`}>
      <img src={xoBot.url} alt="XO, the Xoto bot" className="block h-auto w-full" draggable={false} />
      {EYES.map((eye, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white shadow-inner"
          style={{
            left: `${(eye.x - EYE_SIZE / 2) * 100}%`,
            top: `${(eye.y - (EYE_SIZE * 1.0) / 2) * 100}%`,
            width: `${EYE_SIZE * 100}%`,
            aspectRatio: "1",
          }}
        >
          <div
            className="absolute rounded-full transition-transform duration-100 ease-out"
            style={{
              inset: `${(1 - IRIS_RATIO) * 50}%`,
              background:
                "radial-gradient(circle at 35% 30%, #7dd3fc 0%, #38bdf8 35%, #4ade80 75%, #16a34a 100%)",
              transform: `translate(${look.x * EYE_SIZE * MAX_TRAVEL * 100 * 4}%, ${look.y * EYE_SIZE * MAX_TRAVEL * 100 * 4}%)`,
            }}
          >
            <div className="absolute rounded-full bg-black" style={{ inset: "22%" }} />
            <div
              className="absolute rounded-full bg-white"
              style={{ width: "26%", height: "26%", left: "18%", top: "14%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
