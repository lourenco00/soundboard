import "../styles/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Soundboard Lab — The studio that fits in your browser",
  description: "Pads, sequencer, piano, multitrack DAW, and AI-generated samples — the full production suite, in your browser. No installs. No friction.",
  openGraph: {
    title: "Soundboard Lab — The studio that fits in your browser",
    description: "Pads, sequencer, piano, multitrack DAW, and AI-generated samples — all in your browser.",
    images: ["/soundboardlab.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/soundboardlab.png" />
        <title>Soundboard Lab</title>
      </head>

      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
