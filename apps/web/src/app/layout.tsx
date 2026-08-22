import type { Metadata } from "next";

import "./globals.css";
import NavegacionPrincipal from "@/components/NavegacionPrincipal";

export const metadata: Metadata = {
  title: "Morita",
  description: "Sistema de gestión de Morita Drugstore, powered by TaiLil ERP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var tema=localStorage.getItem("morita.tema");document.documentElement.dataset.tema=tema==="oscuro"?"oscuro":"claro"}catch(e){document.documentElement.dataset.tema="claro"}`,
          }}
        />
      </head>
      <body><NavegacionPrincipal>{children}</NavegacionPrincipal></body>
    </html>
  );
}
