"use client";

import { apiFetch } from "@/api";
import { formatearCantidad } from "@/formato";
import TablaOrdenable from "@/components/TablaOrdenable";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type Almacen = { id: string; codigo: string; descripcion: string; activo: boolean };
type ItemRotacion = {
  articulo_id: string;
  codigo: string;
  descripcion: string;
  es_pesable: boolean;
  dias_con_stock: number;
  cantidad_vendida: string | number;
  promedio_diario: string | number;
  disponible: string | number;
  cantidad_pedida: string | number;
  necesidad_proyectada: string | number;
  sugerencia_compra: string | number;
};
type AnalisisRotacion = {
  fecha_desde: string;
  fecha_hasta: string;
  dias_analisis: number;
  dias_proyeccion: number;
  dias_trabajados: number;
  almacen_id: string | null;
  articulos: ItemRotacion[];
};

export default function RotacionCompras({ almacenes }: { almacenes: Almacen[] }) {
  const [diasAnalisis, setDiasAnalisis] = useState("30");
  const [diasProyeccion, setDiasProyeccion] = useState("15");
  const [almacen, setAlmacen] = useState("");
  const [buscar, setBuscar] = useState("");
  const [soloSugeridos, setSoloSugeridos] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [analisis, setAnalisis] = useState<AnalisisRotacion | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const parametros = new URLSearchParams({
      dias_analisis: diasAnalisis || "30",
      dias_proyeccion: diasProyeccion || "15",
    });
    if (almacen) parametros.set("almacen_id", almacen);
    try {
      const respuesta = await apiFetch(
        `${apiUrl}/articulos/compras/rotacion?${parametros.toString()}`,
        { credentials: "include" },
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.detail ?? "No se pudo calcular la rotación");
        return;
      }
      setAnalisis(datos);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  }, [almacen, diasAnalisis, diasProyeccion]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 250);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  const items = useMemo(() => {
    const terminos = buscar.toLocaleLowerCase("es").trim().split(/\s+/).filter(Boolean);
    return (analisis?.articulos ?? []).filter((item) => {
      const texto = `${item.codigo} ${item.descripcion}`.toLocaleLowerCase("es");
      return terminos.every((termino) => texto.includes(termino))
        && (!soloSugeridos || Number(item.sugerencia_compra) > 0);
    });
  }, [analisis, buscar, soloSugeridos]);

  const principal = analisis?.articulos.find((item) => Number(item.promedio_diario) > 0);
  const sugerenciaTotal = items.reduce(
    (total, item) => total + Number(item.sugerencia_compra),
    0,
  );

  return (
    <section className="mt-5 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Rotación y reposición</h2>
            <button
              type="button"
              aria-label="Explicar el cálculo de rotación y reposición"
              title="¿Cómo se calcula?"
              onClick={() => setAyuda(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold text-[var(--marca)]"
            >
              ?
            </button>
          </div>
          <p className="text-sm text-[var(--texto-suave)]">
            Demanda diaria real, disponibilidad y compra sugerida por producto.
          </p>
        </div>
        {analisis && (
          <p className="text-sm text-[var(--texto-suave)]">
            Período: {new Date(`${analisis.fecha_desde}T00:00:00`).toLocaleDateString("es-AR")}
            {" a "}
            {new Date(`${analisis.fecha_hasta}T00:00:00`).toLocaleDateString("es-AR")}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[180px_180px_minmax(240px,1fr)_auto]">
        <label className="text-sm font-semibold">
          Días de análisis
          <input
            type="number"
            min="1"
            max="365"
            value={diasAnalisis}
            onChange={(evento) => setDiasAnalisis(evento.target.value)}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="text-sm font-semibold">
          Proyección (días)
          <input
            type="number"
            min="1"
            max="365"
            value={diasProyeccion}
            onChange={(evento) => setDiasProyeccion(evento.target.value)}
            className="mt-1 w-full rounded-xl border p-3"
          />
        </label>
        <label className="text-sm font-semibold">
          Almacén
          <select
            value={almacen}
            onChange={(evento) => setAlmacen(evento.target.value)}
            className="mt-1 w-full rounded-xl border p-3"
          >
            <option value="">Todos los almacenes</option>
            {almacenes.filter((item) => item.activo).map((item) => (
              <option key={item.id} value={item.id}>
                {item.codigo} - {item.descripcion}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={cargando || !diasAnalisis || !diasProyeccion}
          onClick={() => void cargar()}
          className="self-end rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40"
        >
          {cargando ? "Calculando…" : "Calcular"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border p-4">
          <p className="text-xs uppercase text-[var(--texto-suave)]">Días trabajados</p>
          <strong className="text-2xl">{analisis?.dias_trabajados ?? "—"}</strong>
        </article>
        <article className="rounded-xl border p-4 sm:col-span-2">
          <p className="text-xs uppercase text-[var(--texto-suave)]">Mayor rotación</p>
          <strong className="block truncate text-lg">
            {principal ? `${principal.codigo} - ${principal.descripcion}` : "Sin ventas en el período"}
          </strong>
          {principal && <span className="text-sm text-[var(--texto-suave)]">{formatearCantidad(principal.promedio_diario)} por día con stock</span>}
        </article>
        <article className="rounded-xl border p-4">
          <p className="text-xs uppercase text-[var(--texto-suave)]">Compra sugerida visible</p>
          <strong className="text-2xl text-[var(--marca)]">{formatearCantidad(sugerenciaTotal)}</strong>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={buscar}
          onChange={(evento) => setBuscar(evento.target.value)}
          placeholder="Buscar por código o descripción, palabras en cualquier orden"
          className="min-w-[280px] flex-1 rounded-xl border p-3"
        />
        <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={soloSugeridos}
            onChange={(evento) => setSoloSugeridos(evento.target.checked)}
          />
          Solo con compra sugerida
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <TablaOrdenable data-exportar-excel="true" className="w-full min-w-[1250px] text-left text-sm">
          <thead>
            <tr>
              <th className="p-3">Posición</th>
              <th>Producto</th>
              <th>Días con stock</th>
              <th>Vendido</th>
              <th>Rotación diaria</th>
              <th>Disponible</th>
              <th>En pedido</th>
              <th>Necesidad proyectada</th>
              <th>Compra sugerida</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.articulo_id} className="border-t">
                <td className="p-3 font-semibold">#{(analisis?.articulos.indexOf(item) ?? 0) + 1}</td>
                <td><b>{item.codigo}</b><span className="ml-2">{item.descripcion}</span></td>
                <td>{item.dias_con_stock}</td>
                <td>{formatearCantidad(item.cantidad_vendida)}</td>
                <td className="font-semibold text-[var(--marca)]">{formatearCantidad(item.promedio_diario)}</td>
                <td>{formatearCantidad(item.disponible)}</td>
                <td>{formatearCantidad(item.cantidad_pedida)}</td>
                <td>{formatearCantidad(item.necesidad_proyectada)}</td>
                <td className="font-bold">{formatearCantidad(item.sugerencia_compra)}</td>
              </tr>
            ))}
          </tbody>
        </TablaOrdenable>
        {!cargando && !items.length && (
          <p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay productos para los filtros seleccionados.</p>
        )}
      </div>

      {ayuda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={() => setAyuda(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ayuda-mrp" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-white p-6 shadow-2xl" onMouseDown={(evento) => evento.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div><h3 id="ayuda-mrp" className="text-xl font-semibold">¿Cómo funciona este MRP simple?</h3><p className="text-sm text-[var(--texto-suave)]">La sugerencia se calcula con movimientos reales; no modifica stock ni genera una orden automáticamente.</p></div>
              <button type="button" onClick={() => setAyuda(false)} className="rounded-lg border px-3 py-2 font-semibold">Cerrar</button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <p><b>1. Días trabajados:</b> jornadas del período en las que hubo al menos una venta confirmada.</p>
              <p><b>2. Días con stock:</b> para cada producto se cuentan solamente jornadas trabajadas en las que tuvo existencia. Los días sin mercadería no reducen artificialmente su rotación.</p>
              <p><b>3. Rotación diaria:</b> cantidad vendida ÷ días trabajados con stock para ese producto.</p>
              <p><b>4. Necesidad proyectada:</b> rotación diaria × días de proyección elegidos.</p>
              <p><b>5. Compra sugerida:</b> necesidad proyectada − disponible − cantidad ya pedida. Si el resultado es negativo, se muestra cero.</p>
              <p>Los productos no pesables se redondean hacia arriba a unidades enteras; los pesables conservan hasta tres decimales. Puede analizar todos los almacenes juntos o uno en particular.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
