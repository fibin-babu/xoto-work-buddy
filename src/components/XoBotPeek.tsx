import { useEffect, useRef, useState } from "react";
import xoHead from "@/assets/xo-head.png.asset.json";

// Eye centers as fractions of the cropped head image (measured from the artwork).
const EYES = [
  { x: 0.392, y: 0.824 },
  { x: 0.797, y: 0.723 },
];
const EYE_SIZE = 0.215; // eye diameter as a fraction of image width
const IRIS_RATIO = 0.62; // iris diameter relative to the eye

// XO's head peeks in from the bottom-right corner of the screen and its eyes
// follow the mouse — same trick as the login-screen mascot, just the head.
export function XoBotPeek() {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.62; // roughly the face
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = Math.min(1, dist / 300);
      setLook({ x: (dx / dist) * strength, y: (dy / dist) * strength });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed -bottom-1 -right-3.5 z-40 w-36 select-none sm:w-44"
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
          className="absolute rounded-full bg-white shadow-inner"
          style={{
            left: `${(eye.x - EYE_SIZE / 2) * 100}%`,
            top: `${(eye.y - EYE_SIZE / 2) * 100}%`,
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
              transform: `translate(${look.x * 40}%, ${look.y * 40}%)`,
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
