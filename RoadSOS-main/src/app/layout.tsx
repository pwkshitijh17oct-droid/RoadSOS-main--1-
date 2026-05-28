import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RoadSOS — Emergency Road Assistance",
  description: "Location-based access to nearby trauma centres, ambulance services, vehicle rescue services, police stations and emergency contacts during road accidents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} h-full`}>
      <body className="h-full w-full overflow-auto bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
