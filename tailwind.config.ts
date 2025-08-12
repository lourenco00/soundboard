import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#eef2ff",
          200: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          900: "#1e1b4b",
        },
      },
      boxShadow: { glass: "0 10px 30px rgba(0,0,0,0.08)" },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
} satisfies Config;