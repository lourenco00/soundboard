import React, { useEffect, useRef } from "react";
import { getPeaks } from "../lib/utils";

export default function Wave({
  buffer,
  color = "#93c5fd",
  width,
  height,
}: {
  buffer: AudioBuffer;
  color?: string;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    // faint vertical grid inside the clip
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.beginPath();
    for (let x = 0; x <= width; x += 40) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    ctx.stroke();

    // waveform
    const peaks = getPeaks(buffer, Math.max(1, Math.floor(width)));
    ctx.fillStyle = color;
    const mid = height / 2;
    for (let x = 0; x < peaks.length; x++) {
      const h = peaks[x] * (height * 0.9);
      ctx.fillRect(x, mid - h / 2, 1, h);
    }
  }, [buffer, color, width, height]);

  return <canvas ref={ref} className="rounded-md" style={{ width, height }} />;
}
