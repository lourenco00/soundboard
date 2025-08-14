import React, { useEffect } from "react";

type Props = {
  refDiv: React.MutableRefObject<HTMLDivElement | null>;
  pxPerSec: number;
  gridStepSec: number;
};

export default function Timeline({ refDiv, pxPerSec, gridStepSec }: Props) {
  useEffect(() => {
    const el = refDiv.current;
    if (!el) return;

    const width = el.clientWidth;
    const height = 36;
    el.innerHTML = "";
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    el.appendChild(c);

    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(0, 0, width, height);

    // vertical lines at chosen subdivision
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    const pxPerStep = gridStepSec * pxPerSec;
    for (let x = 0; x < width; x += pxPerStep) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, height);
    }
    ctx.stroke();

    // labels every 1 second
    ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI";
    for (let s = 0; s < width / pxPerSec; s++) {
      const x = s * pxPerSec;
      ctx.fillText(`${s}s`, x + 4, 22);
    }
  }, [pxPerSec, gridStepSec, refDiv.current?.clientWidth]);

  return <div ref={refDiv} className="rounded-lg overflow-hidden border border-white/10" />;
}
