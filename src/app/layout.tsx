import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KITCHEN NOTE — わたしのレシピ帳",
  description: "お気に入りの味を、ずっと手元に。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
