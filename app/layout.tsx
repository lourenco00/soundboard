import "../styles/globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Pro Soundboard",
  description: "Charge-worthy, clean soundboard with Pro features.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}