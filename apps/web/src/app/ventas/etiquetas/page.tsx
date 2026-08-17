"use client";

import { useEffect, useState } from "react";
import BuscadorArticulo, {
  ArticuloBuscado,
} from "@/components/BuscadorArticulo";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Lista = { id: string; nombre: string; activa: boolean };
type Precio = { precio_base_bruto: string; precio_venta_bruto: string };
type Etiqueta = {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  precioBase: number;
  copias: number;
};
const formatos = {
  "3X7": { nombre: "3 × 7 cm", ancho: 7, alto: 3 },
  "5X5": { nombre: "5 × 5 cm", ancho: 5, alto: 5 },
  "10X10": { nombre: "10 × 10 cm", ancho: 10, alto: 10 },
  "5X10": { nombre: "5 × 10 cm", ancho: 10, alto: 5 },
} as const;
type Formato = keyof typeof formatos;

export default function EtiquetasPrecios() {
  const [general, setGeneral] = useState<Lista | null>(null),
    [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]),
    [formato, setFormato] = useState<Formato>("3X7"),
    [margen, setMargen] = useState(0.5),
    [mensaje, setMensaje] = useState("");
  useEffect(() => {
    void fetch(`${apiUrl}/articulos/precios/listas`, {
      credentials: "include",
    }).then(async (r) => {
      if (r.ok) {
        const listas: Lista[] = await r.json();
        setGeneral(
          listas.find((x) => x.nombre === "GENERAL" && x.activa) ?? null,
        );
      }
    });
  }, []);
  async function agregar(articulo: ArticuloBuscado | null) {
    if (!articulo || !general) return;
    const r = await fetch(
      `${apiUrl}/articulos/precios/listas/${general.id}/articulos?articulo_id=${articulo.id}`,
      { credentials: "include" },
    );
    const d = await r.json();
    if (!r.ok || !d.length) {
      setMensaje("No se pudo obtener el precio GENERAL del articulo");
      return;
    }
    const precio: Precio = d[0];
    setEtiquetas((actual) =>
      actual.some((x) => x.id === articulo.id)
        ? actual.map((x) =>
            x.id === articulo.id ? { ...x, copias: x.copias + 1 } : x,
          )
        : [
            ...actual,
            {
              id: articulo.id,
              codigo: articulo.codigo,
              descripcion: articulo.descripcion,
              precio: Number(precio.precio_venta_bruto),
              precioBase: Number(precio.precio_base_bruto),
              copias: 1,
            },
          ],
    );
    setMensaje("");
  }
  const impresas = etiquetas.flatMap((x) =>
    Array.from({ length: x.copias }, (_, i) => ({
      ...x,
      clave: `${x.id}-${i}`,
    })),
  );
  const medida = formatos[formato];
  const porFila = Math.max(1, Math.floor((21 - margen * 2) / medida.ancho));
  const filasPorHoja = Math.max(
    1,
    Math.floor((29.7 - margen * 2) / medida.alto),
  );
  const porHoja = porFila * filasPorHoja;
  const hojas = impresas.length ? Math.ceil(impresas.length / porHoja) : 0;
  const paginas = Array.from({ length: hojas }, (_, indice) =>
    impresas.slice(indice * porHoja, (indice + 1) * porHoja),
  );
  return (
    <main className="p-6 sm:p-9">
      <section className="no-imprimir">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
              Ventas
            </p>
            <h1 className="text-3xl font-semibold">Etiquetas de precios</h1>
            <p className="text-sm text-[var(--texto-suave)]">
              Descripcion y precio GENERAL. Medidas expresadas como alto ×
              ancho.
            </p>
          </div>
          <button
            disabled={!etiquetas.length}
            onClick={() => window.print()}
            className="rounded-xl bg-[var(--marca)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Imprimir etiquetas
          </button>
        </header>
        {mensaje && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {mensaje}
          </p>
        )}
        <section className="mt-5 rounded-2xl border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <label className="text-sm font-semibold">
              Agregar articulo
              <BuscadorArticulo
                soloInventario={false}
                limpiarAlSeleccionar
                seleccionar={(x) => void agregar(x)}
              />
            </label>
            <label className="text-sm font-semibold">
              Margen por lado
              <select
                value={margen}
                onChange={(e) => setMargen(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border p-3"
              >
                <option value="0">Sin margen</option>
                <option value="0.3">0,3 cm</option>
                <option value="0.5">0,5 cm recomendado</option>
                <option value="1">1 cm</option>
              </select>
              <small className="mt-1 block font-normal text-[var(--texto-suave)]">
                Use un valor igual o mayor al margen minimo de la impresora.
              </small>
            </label>
            <label className="text-sm font-semibold">
              Tamaño de etiqueta
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value as Formato)}
                className="mt-1 w-full rounded-xl border p-3"
              >
                {Object.entries(formatos).map(([id, x]) => (
                  <option key={id} value={id}>
                    {x.nombre}
                  </option>
                ))}
              </select>
              <small className="mt-1 block font-normal text-[var(--texto-suave)]">
                En hoja A4 entran {porHoja} etiquetas ({porFila} por fila ×{" "}
                {filasPorHoja} filas).
              </small>
            </label>
          </div>
        </section>
        <section className="mt-5 rounded-2xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Etiquetas preparadas</h2>
            <span className="text-sm text-[var(--texto-suave)]">
              {impresas.length} a imprimir · {porHoja} por hoja A4 · {hojas}{" "}
              {hojas === 1 ? "hoja" : "hojas"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Articulo</th>
                  <th>Precio GENERAL</th>
                  <th>Precio base</th>
                  <th>Copias</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                {etiquetas.map((x) => (
                  <tr key={x.id} className="border-t">
                    <td className="p-3">
                      <b>{x.codigo}</b>
                      <small className="block">{x.descripcion}</small>
                    </td>
                    <td className="font-semibold">${x.precio.toFixed(2)}</td>
                    <td>
                      {x.precio !== x.precioBase
                        ? `$${x.precioBase.toFixed(2)}`
                        : "—"}
                    </td>
                    <td>
                      <input
                        className="w-24 rounded-lg border p-2"
                        type="number"
                        min="1"
                        step="1"
                        value={x.copias}
                        onChange={(e) =>
                          setEtiquetas(
                            etiquetas.map((a) =>
                              a.id === x.id
                                ? {
                                    ...a,
                                    copias: Math.max(1, Number(e.target.value)),
                                  }
                                : a,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          setEtiquetas(etiquetas.filter((a) => a.id !== x.id))
                        }
                        className="rounded-lg border border-red-200 px-3 py-2 text-red-700"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!etiquetas.length && (
              <p className="p-8 text-center text-sm text-[var(--texto-suave)]">
                Agregue productos para preparar la impresion.
              </p>
            )}
          </div>
        </section>
        <section className="mt-5 rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Vista previa</h2>
          <div className="flex flex-wrap gap-3">
            {impresas.slice(0, 12).map((x) => (
              <EtiquetaVisual
                key={x.clave}
                etiqueta={x}
                ancho={medida.ancho}
                alto={medida.alto}
              />
            ))}
          </div>
        </section>
      </section>
      <section className="etiquetas-impresion">
        {paginas.map((pagina, numeroPagina) => (
          <div
            key={numeroPagina}
            className="hoja-etiquetas"
            style={{ padding: `${margen}cm` }}
          >
            {pagina.map((x) => (
              <EtiquetaVisual
                key={x.clave}
                etiqueta={x}
                ancho={medida.ancho}
                alto={medida.alto}
              />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}

function EtiquetaVisual({
  etiqueta,
  ancho,
  alto,
}: {
  etiqueta: Etiqueta;
  ancho: number;
  alto: number;
}) {
  const cambio = etiqueta.precio !== etiqueta.precioBase;
  return (
    <article
      className="etiqueta-precio"
      style={{ width: `${ancho}cm`, height: `${alto}cm` }}
    >
      <p className="etiqueta-descripcion">{etiqueta.descripcion}</p>
      <strong className="etiqueta-importe">
        $
        {etiqueta.precio.toLocaleString("es-AR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </strong>
      {cambio && (
        <p className="etiqueta-base">
          BASE $
          {etiqueta.precioBase.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      )}
      <small>{etiqueta.codigo}</small>
    </article>
  );
}
