import type { Metadata } from "next";
import { LanguageProvider } from "@/app/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CassavaLink | Fair Price, Better Future",
  description:
    "A clearer marketplace connecting cassava farmers and processing factories in Laos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
