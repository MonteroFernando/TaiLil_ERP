"use client";

import { apiFetch } from "@/api";

import { KeyboardEvent, RefObject, useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
export type ArticuloBuscado = {
  id: string;
  codigo: string;
  descripcion: string;
  habilitado_inventario: boolean;
  es_pesable: boolean;
};

export default function BuscadorArticulo({
  seleccionar,
  seleccionarConCantidad,
  cambiarTexto,
  soloInventario = true,
  requerido = false,
  referenciaEntrada,
  limpiarAlSeleccionar = false,
  proveedorId,
  deshabilitado = false,
  seleccionarDirectoConEnter = false,
}: {
  seleccionar: (articulo: ArticuloBuscado | null) => void;
  seleccionarConCantidad?: (articulo: ArticuloBuscado, cantidad: number) => void;
  cambiarTexto?: (texto: string) => void;
  soloInventario?: boolean;
  requerido?: boolean;
  referenciaEntrada?: RefObject<HTMLInputElement | null>;
  limpiarAlSeleccionar?: boolean;
  proveedorId?: string;
  deshabilitado?: boolean;
  seleccionarDirectoConEnter?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ArticuloBuscado[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(-1);
  const contenedor = useRef<HTMLDivElement>(null);
  const omitirBusquedaSeleccion = useRef(false);
  const versionBusqueda = useRef(0);

  useEffect(() => {
    if (omitirBusquedaSeleccion.current) {
      omitirBusquedaSeleccion.current = false;
      return;
    }
    const coincidenciaMultiplicador = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
    const textoBusqueda = coincidenciaMultiplicador?.[2] ?? texto;
    if (!textoBusqueda.trim()) {
      return;
    }
    const version = ++versionBusqueda.current;
    const temporizador = window.setTimeout(async () => {
      const parametros = new URLSearchParams({ buscar: textoBusqueda });
      if (proveedorId) parametros.set("proveedor_id", proveedorId);
      const r = await apiFetch(`${apiUrl}/articulos?${parametros}`, {
        credentials: "include",
      });
      if (!r.ok) return;
      const datos: ArticuloBuscado[] = await r.json();
      if (version !== versionBusqueda.current) return;
      const filtrados = soloInventario ? datos.filter((x) => x.habilitado_inventario) : datos;
      setResultados(filtrados.slice(0, 12));
      setAbierto(true);
      setIndice(filtrados.length ? 0 : -1);
    }, 180);
    return () => window.clearTimeout(temporizador);
  }, [texto, soloInventario, proveedorId]);

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  function elegir(articulo: ArticuloBuscado) {
    const coincidenciaMultiplicador = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
    const cantidad = coincidenciaMultiplicador
      ? Number(coincidenciaMultiplicador[1].replace(",", "."))
      : 1;
    versionBusqueda.current += 1;
    omitirBusquedaSeleccion.current = true;
    setTexto(limpiarAlSeleccionar ? "" : `${articulo.codigo} - ${articulo.descripcion}`);
    setResultados([]);
    setIndice(-1);
    setAbierto(false);
    if (seleccionarConCantidad) seleccionarConCantidad(articulo, cantidad);
    else seleccionar(articulo);
    cambiarTexto?.("");
    window.setTimeout(() => referenciaEntrada?.current?.focus(), 0);
  }

  function manejarTeclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && abierto && resultados.length && indice >= 0) {
      e.preventDefault();
      elegir(resultados[indice]);
      return;
    }
    if (e.key === "Enter" && seleccionarDirectoConEnter) {
      const coincidenciaMultiplicador = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*\*\s*(.+)$/);
      const textoBusqueda = (coincidenciaMultiplicador?.[2] ?? texto).trim();
      if (!textoBusqueda) return;
      e.preventDefault();
      const version = ++versionBusqueda.current;
      const parametros = new URLSearchParams({ buscar: textoBusqueda });
      if (proveedorId) parametros.set("proveedor_id", proveedorId);
      void apiFetch(`${apiUrl}/articulos?${parametros}`, { credentials: "include" })
        .then(async (respuesta) => {
          if (!respuesta.ok || version !== versionBusqueda.current) return;
          const datos: ArticuloBuscado[] = await respuesta.json();
          if (version !== versionBusqueda.current) return;
          const filtrados = (soloInventario ? datos.filter((x) => x.habilitado_inventario) : datos).slice(0, 12);
          if (filtrados.length === 1) {
            elegir(filtrados[0]);
            return;
          }
          setResultados(filtrados);
          setIndice(filtrados.length ? 0 : -1);
          setAbierto(true);
        });
      return;
    }
    if (!abierto || !resultados.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((actual) => Math.min(actual + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((actual) => Math.max(actual - 1, 0));
    } else if (e.key === "Escape") setAbierto(false);
  }

  return (
    <div ref={contenedor} className="relative">
      <input
        ref={referenciaEntrada}
        className="w-full rounded-xl border p-3"
        value={texto}
        placeholder="Codigo, descripcion, barra o codigo de proveedor"
        required={requerido}
        autoComplete="off"
        disabled={deshabilitado}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        onKeyDown={manejarTeclado}
        onChange={(e) => {
          versionBusqueda.current += 1;
          omitirBusquedaSeleccion.current = false;
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
