import "../styles/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Soundboard Lab",
  description: "Charge-worthy, clean soundboard with Pro features.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
