"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import BuscadorArticulo from "@/components/BuscadorArticulo";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Unidad = { id: string; nombre: string; simbolo: string };
type Iva = { id: string; codigo: string; nombre: string; porcentaje: string };
type Clasificador = {
  id: string;
  tipo: string;
  nombre: string;
  padre_id: string | null;
  activo: boolean;
};
type Articulo = {
  id: string;
  codigo: string;
  tipo_articulo: "producto" | "servicio";
  descripcion: string;
  habilitado: boolean;
  habilitado_venta: boolean;
  habilitado_compra: boolean;
  habilitado_inventario: boolean;
  es_pesable: boolean;
  clasificador_ids: string[];
  unidad_base: Unidad;
  alicuota_iva: Iva;
};

async function errorApi(r: Response) {
  try {
    const d = await r.json();
    return d.detail ?? "No se pudo completar la operacion";
  } catch {
    return "No se pudo completar la operacion";
  }
}

export default function MaestroArticulos() {
  const router = useRouter();
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [ivas, setIvas] = useState<Iva[]>([]);
  const [clasificadores, setClasificadores] = useState<Clasificador[]>([]);
  const [nuevo, setNuevo] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [mensaje, setMensaje] = useState("");
  const cargar = useCallback(async () => {
    const [a, u, i, c] = await Promise.all([
      fetch(`${apiUrl}/articulos?incluir_inactivos=true&buscar=${encodeURIComponent(buscar)}`, {
        credentials: "include",
      }),
      fetch(`${apiUrl}/articulos/unidades-medida`, { credentials: "include" }),
      fetch(`${apiUrl}/articulos/alicuotas-iva`, { credentials: "include" }),
      fetch(`${apiUrl}/articulos/clasificadores`, { credentials: "include" }),
    ]);
    if (a.ok) setArticulos(await a.json());
    if (u.ok) setUnidades(await u.json());
    if (i.ok) setIvas(await i.json());
    if (c.ok) setClasificadores(await c.json());
  }, [buscar]);
  useEffect(() => {
    const t = window.setTimeout(() => void cargar(), 200);
    return () => window.clearTimeout(t);
  }, [cargar]);
  return (
    <main className="p-6 sm:p-9">
      <section>
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--borde)] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
              Datos maestros
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Articulos</h1>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              Productos, servicios y sus condiciones operativas.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/clasificadores"
              className="rounded-xl border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold"
            >
              Clasificadores
            </a>
            <button
              onClick={() => setNuevo(true)}
              className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
            >
              Nuevo articulo
            </button>
          </div>
        </header>
        {mensaje && (
          <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm text-[var(--marca)]">
            {mensaje}
          </p>
        )}
        <div className="mt-5 rounded-2xl border border-[var(--borde)] bg-white p-4">
          <div className="max-w-xl">
            <BuscadorArticulo
              soloInventario={false}
              cambiarTexto={setBuscar}
              seleccionar={(articulo) => {
                if (articulo) router.push(`/articulos/${articulo.id}` as Route);
              }}
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[var(--texto-suave)]">
                <tr>
                  <th className="p-3">Codigo</th>
                  <th>Descripcion</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th className="w-48">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articulos.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--borde)]">
                    <td className="p-3 font-mono font-semibold">{a.codigo}</td>
                    <td>{a.descripcion}</td>
                    <td>{a.tipo_articulo}</td>
                    <td>{a.habilitado ? "ACTIVO" : "INACTIVO"}</td>
                    <td className="flex gap-2 py-2">
                      <button
                        title="Ver detalles del articulo"
                        aria-label={`Ver detalles de ${a.descripcion}`}
                        onClick={() =>
                          router.push(`/articulos/${a.id}` as Route)
                        }
                        className="rounded-lg border border-[var(--borde)] px-3 py-2 font-semibold text-[var(--marca)] hover:bg-[var(--marca-clara)]"
                      >
                        ⚙ Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!articulos.length && (
              <p className="p-6 text-center text-sm text-[var(--texto-suave)]">
                No hay articulos para mostrar.
              </p>
            )}
          </div>
        </div>
        {nuevo && (
          <ModalNuevo
            unidades={unidades}
            ivas={ivas}
            clasificadores={clasificadores.filter((c) => c.activo)}
            cerrar={() => setNuevo(false)}
            creado={async (id) => {
              setNuevo(false);
              setMensaje(
                "Articulo creado con stock cero en todos los almacenes activos",
              );
              await cargar();
              router.push(`/articulos/${id}` as Route);
            }}
          />
        )}
      </section>
    </main>
  );
}

function ModalNuevo({
  unidades,
  ivas,
  clasificadores,
  cerrar,
  creado,
}: {
  unidades: Unidad[];
  ivas: Iva[];
  clasificadores: Clasificador[];
  cerrar: () => void;
  creado: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<"producto" | "servicio">("producto");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidad, setUnidad] = useState("");
  const [iva, setIva] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [venta, setVenta] = useState(true);
  const [compra, setCompra] = useState(true);
  const [inventario, setInventario] = useState(true);
  const [pesable, setPesable] = useState(false);
  const [error, setError] = useState("");
  async function guardar(e: FormEvent) {
    e.preventDefault();
    const r = await fetch(`${apiUrl}/articulos`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_articulo: tipo,
        codigo_alternativo: tipo === "servicio" ? codigo : null,
        descripcion,
        descripcion_ampliada: null,
        unidad_base_id: unidad,
        alicuota_iva_id: iva,
        habilitado: true,
        habilitado_venta: venta,
        habilitado_compra: compra,
        habilitado_inventario: tipo === "producto" && inventario,
        es_pesable: tipo === "producto" && pesable,
        clasificador_ids: seleccion,
      }),
    });
    if (!r.ok) {
      setError(await errorApi(r));
      return;
    }
    const d = await r.json();
    creado(d.id);
  }
  function cambiarTipo(v: "producto" | "servicio") {
    setTipo(v);
    if (v === "servicio") {
      setInventario(false);
      setPesable(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <form
        onSubmit={guardar}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Nuevo articulo</h2>
            <p className="text-sm text-[var(--texto-suave)]">
              El producto recibira el proximo codigo numerico.
            </p>
          </div>
          <button type="button" onClick={cerrar} className="text-2xl">
            ×
          </button>
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Tipo
            <select
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={tipo}
              onChange={(e) =>
                cambiarTipo(e.target.value as "producto" | "servicio")
              }
            >
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </label>
          {tipo === "servicio" && (
            <label className="text-sm">
              Codigo del servicio
              <input
                className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
              />
            </label>
          )}
          <label className="text-sm sm:col-span-2">
            Descripcion
            <input
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            Unidad base
            <select
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              required
            >
              <option value="">Seleccionar</option>
              {unidades.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre} ({x.simbolo})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            IVA
            <select
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={iva}
              onChange={(e) => setIva(e.target.value)}
              required
            >
              <option value="">Seleccionar</option>
              {ivas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">
              Clasificacion
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {clasificadores.map((x) => (
                <label
                  key={x.id}
                  className="flex gap-2 rounded-lg bg-[var(--fondo)] p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.includes(x.id)}
                    onChange={(e) =>
                      setSeleccion(
                        e.target.checked
                          ? [...seleccion, x.id]
                          : seleccion.filter((id) => id !== x.id),
                      )
                    }
                  />
                  {x.tipo}: {x.nombre}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">
              Habilitaciones
            </legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {[
                ["Venta", venta, setVenta],
                ["Compra", compra, setCompra],
                ["Inventario", inventario, setInventario],
                ["Pesable", pesable, setPesable],
              ].map(([n, v, s]) => (
                <label className="flex gap-2" key={n as string}>
                  <input
                    type="checkbox"
                    checked={v as boolean}
                    disabled={
                      tipo === "servicio" &&
                      (n === "Inventario" || n === "Pesable")
                    }
                    onChange={(e) =>
                      (s as (v: boolean) => void)(e.target.checked)
                    }
                  />
                  {n as string}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button className="rounded-xl bg-[var(--marca)] px-5 py-2 text-sm font-semibold text-white">
            Crear articulo
          </button>
        </div>
      </form>
    </div>
  );
}
