"use client";
import { useEffect, useRef } from "react";

export default function Visualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!analyser || !ref.current) return;
    const canvas = ref.current;
    const c = canvas.getContext("2d")!;
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.frequencyBinCount);

    let raf = 0;
    const draw = () => {
      analyser.getByteTimeDomainData(data);
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = "rgba(255,255,255,.65)";
      c.lineWidth = 1.5;
      c.beginPath();
      const slice = canvas.width / data.length;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        const x = i * slice;
        const y = canvas.height / 2 + v * (canvas.height / 2 - 2);
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return <canvas ref={ref} width={700} height={72} className="w-full h-16 opacity-80" />;
}