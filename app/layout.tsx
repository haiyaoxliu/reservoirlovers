import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservoir Lovers",
  description: "How many times has the club run the Central Park Reservoir loop?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
