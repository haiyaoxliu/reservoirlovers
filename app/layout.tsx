import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "./Settings";

export const metadata: Metadata = {
  title: "Reservoir Lovers",
  description: "How many times has the club run the Central Park Reservoir loop?",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("rl-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
