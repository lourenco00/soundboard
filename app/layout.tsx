import "../styles/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Soundboard Lab",
  description: "Charge-worthy, clean soundboard with Pro features.",
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
