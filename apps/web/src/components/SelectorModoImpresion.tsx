"use client";

import { useEffect, useState } from "react";

export type ModoImpresion = "VISTA_PREVIA" | "DIRECTA";
const clave = "tailil.modo-impresion";

export function useModoImpresion() {
  const [modo, setModo] = useState<ModoImpresion>("VISTA_PREVIA");
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      if (window.localStorage.getItem(clave) === "DIRECTA") setModo("DIRECTA");
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);
  function cambiar(nuevo: ModoImpresion) {
    window.localStorage.setItem(clave, nuevo);
    setModo(nuevo);
  }
  return { modo, cambiar };
}

export default function SelectorModoImpresion({
  modo,
  cambiar,
}: {
  modo: ModoImpresion;
  cambiar: (modo: ModoImpresion) => void;
}) {
  return (
    <div
      className="rounded-xl border bg-[var(--fondo)] p-1"
      title="La impresión directa requiere abrir el puesto con el PS1 y configurar el corte en el driver"
    >
      <div className="flex" role="group" aria-label="Modo de impresión">
        <button
          type="button"
          aria-pressed={modo === "VISTA_PREVIA"}
          onClick={() => cambiar("VISTA_PREVIA")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${modo === "VISTA_PREVIA" ? "bg-white text-[var(--marca)] shadow-sm" : "text-[var(--texto-suave)]"}`}
        >
          Vista previa
        </button>
        <button
          type="button"
          aria-pressed={modo === "DIRECTA"}
          onClick={() => cambiar("DIRECTA")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${modo === "DIRECTA" ? "bg-green-700 text-white shadow-sm" : "text-[var(--texto-suave)]"}`}
        >
          Impresión directa
        </button>
      </div>
      <small className="block px-2 pb-1 text-[10px] text-[var(--texto-suave)]">
        {modo === "DIRECTA"
          ? "Automática al cobrar · corte configurado en la impresora"
          : "Abre el documento para confirmar"}
      </small>
    </div>
  );
}
