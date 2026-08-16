"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export type ArticuloBuscado = {
  id: string;
  codigo: string;
  descripcion: string;
  habilitado_inventario: boolean;
};

export default function BuscadorArticulo({
  seleccionar,
  cambiarTexto,
  soloInventario = true,
  requerido = false,
}: {
  seleccionar: (articulo: ArticuloBuscado | null) => void;
  cambiarTexto?: (texto: string) => void;
  soloInventario?: boolean;
  requerido?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ArticuloBuscado[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!texto.trim()) {
      return;
    }
    const temporizador = window.setTimeout(async () => {
      const r = await fetch(`${apiUrl}/articulos?buscar=${encodeURIComponent(texto)}`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const datos: ArticuloBuscado[] = await r.json();
      const filtrados = soloInventario ? datos.filter((x) => x.habilitado_inventario) : datos;
      setResultados(filtrados.slice(0, 12));
      setAbierto(true);
      setIndice(filtrados.length ? 0 : -1);
    }, 180);
    return () => window.clearTimeout(temporizador);
  }, [texto, soloInventario]);

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  function elegir(articulo: ArticuloBuscado) {
    setTexto(`${articulo.codigo} - ${articulo.descripcion}`);
    setAbierto(false);
    seleccionar(articulo);
    cambiarTexto?.("");
  }

  function manejarTeclado(e: KeyboardEvent<HTMLInputElement>) {
    if (!abierto || !resultados.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((actual) => Math.min(actual + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((actual) => Math.max(actual - 1, 0));
    } else if (e.key === "Enter" && indice >= 0) {
      e.preventDefault();
      elegir(resultados[indice]);
    } else if (e.key === "Escape") setAbierto(false);
  }

  return (
    <div ref={contenedor} className="relative">
      <input
        className="w-full rounded-xl border p-3"
        value={texto}
        placeholder="Codigo, descripcion, barra o codigo de proveedor"
        required={requerido}
        autoComplete="off"
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        onKeyDown={manejarTeclado}
        onChange={(e) => {
          setTexto(e.target.value);
          if (!e.target.value.trim()) {
            setResultados([]);
            setAbierto(false);
          }
          seleccionar(null);
          cambiarTexto?.(e.target.value);
        }}
      />
      {abierto && (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-xl">
          {resultados.length ? resultados.map((x, posicion) => (
            <button type="button" key={x.id} onClick={() => elegir(x)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${indice === posicion ? "bg-[var(--marca-clara)]" : "hover:bg-[var(--fondo)]"}`}>
              <b className="font-mono">{x.codigo}</b> · {x.descripcion}
            </button>
          )) : <p className="p-3 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}
        </div>
      )}
    </div>
  );
}
