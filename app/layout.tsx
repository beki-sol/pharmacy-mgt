import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/Providers"
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip"; // <-- Add this import

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pharmacy Inventory System",
  description: "Comprehensive pharmacy management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <TooltipProvider> {/* <-- Wrap everything with TooltipProvider */}
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: "#363636",
                  color: "#fff",
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: "#10b981",
                    secondary: "#fff",
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#fff",
                  },
                },
              }}
            />
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}