import type { Metadata } from "next";
import { Inria_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/Providers/theme-provider"
import TanStackProvider from "@/components/Providers/TanStackProvider";

const inriaSans = Inria_Sans({
  display: 'swap',
  subsets: ['latin'],
  weight: ["300", "400", "700"],
  variable: '--font-inria-sans',
})
export const metadata: Metadata = {
  title: "Chatie — conversations, considered",
  description: "A quieter, more thoughtful space for everyday conversations.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inriaSans.variable} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logos/logo.svg" sizes="any" />
      </head>

      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TanStackProvider>
            {children}
          </TanStackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
