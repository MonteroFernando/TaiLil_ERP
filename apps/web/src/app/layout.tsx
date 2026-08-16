import type { Metadata } from "next";

import "./globals.css";
import NavegacionPrincipal from "@/components/NavegacionPrincipal";

export const metadata: Metadata = {
  title: "TaiLil ERP",
  description: "Gestion integral para TaiLil",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><NavegacionPrincipal>{children}</NavegacionPrincipal></body>
    </html>
  );
}
