"use client";

import { apiFetch } from "@/api";

import { FormEvent, useEffect, useState } from "react";
import BuscadorArticulo, { ArticuloBuscado } from "@/components/BuscadorArticulo";
import { cantidadParaEntrada, formatearMoneda } from "@/formato";
import TablaOrdenable from "@/components/TablaOrdenable";
import RotacionCompras from "@/components/RotacionCompras";
import { DetalleLineasComprobante, FilaComprobanteExpandible } from "@/components/ComprobanteExpandible";
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Socio = { id: string; razon_social: string };
type Almacen = {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
};
type Linea = {
  articulo_id: string;
  codigo: string;
  descripcion: string;
  cantidad: string;
  costo: string;
  politica: string;
};
type Documento = {
  id: string;
  numero: number;
  tipo: string;
  proveedor_id: string;
  proveedor_nombre: string;
  almacen_id: string;
  almacen_codigo: string;
  estado: string;
  fecha_realizacion: string;
  total_bruto: string | null;
  letra: string | null;
  punto_emision: string | null;
  numero_factura: string | null;
  comprobante_proveedor: string | null;
  lineas: {
    articulo_id: string;
    articulo_codigo: string;
    articulo_descripcion: string;
    cantidad_base: string;
    costo_bruto_unitario: string | null;
    total_bruto: string | null;
    politica_costo: string | null;
    advertencia: string | null;
  }[];
};

export default function Compras() {
  const [seccion, setSeccion] = useState<"INGRESO" | "FACTURA">("INGRESO"),
    [socios, setSocios] = useState<Socio[]>([]),
    [almacenes, setAlmacenes] = useState<Almacen[]>([]),
    [ingresos, setIngresos] = useState<Documento[]>([]),
    [facturas, setFacturas] = useState<Documento[]>([]);
  const [proveedor, setProveedor] = useState(""),
    [almacen, setAlmacen] = useState(""),
    [lineas, setLineas] = useState<Linea[]>([]),
    [articulo, setArticulo] = useState<ArticuloBuscado | null>(null),
    [cantidad, setCantidad] = useState("1"),
    [ingreso, setIngreso] = useState(""),
    [letraFactura, setLetraFactura] = useState("A"),
    [puntoEmision, setPuntoEmision] = useState(""),
    [numeroFactura, setNumeroFactura] = useState(""),
    [politica, setPolitica] = useState("REEMPLAZAR"),
    [mensaje, setMensaje] = useState(""),
    [nuevo, setNuevo] = useState(false),
    [rotacion, setRotacion] = useState(false);
  async function cargar() {
    const [rs, ra, ri, rf] = await Promise.all([
      apiFetch(`${apiUrl}/articulos/socios?rol=proveedor`, {
        credentials: "include",
      }),
      apiFetch(`${apiUrl}/articulos/almacenes`, { credentials: "include" }),
      apiFetch(`${apiUrl}/articulos/compras/ingresos?pendientes=true`, {
        credentials: "include",
      }),
      apiFetch(`${apiUrl}/articulos/compras/facturas`, { credentials: "include" }),
    ]);
    if (rs.ok) setSocios(await rs.json());
    if (ra.ok) setAlmacenes(await ra.json());
    if (ri.ok) setIngresos(await ri.json());
    if (rf.ok) setFacturas(await rf.json());
  }
  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, []);
  function agregar() {
    const a = articulo;
    if (!a || Number(cantidad) <= 0) return;
    setLineas((actual) =>
      actual.some((x) => x.articulo_id === a.id)
        ? actual.map((x) =>
            x.articulo_id === a.id
              ? {
                  ...x,
                  cantidad: cantidadParaEntrada(Number(x.cantidad) + Number(cantidad)),
                }
              : x,
          )
        : [
            ...actual,
            {
              articulo_id: a.id,
              codigo: a.codigo,
              descripcion: a.descripcion,
              cantidad,
              costo: "0",
              politica: "",
            },
          ],
    );
    setArticulo(null);
    setCantidad("1");
  }
  function elegirIngreso(id: string) {
    setIngreso(id);
    const doc = ingresos.find((x) => x.id === id);
    if (!doc) return;
    setProveedor(doc.proveedor_id);
    setAlmacen(doc.almacen_id);
    setLineas(
      doc.lineas.map((x) => ({
        articulo_id: x.articulo_id,
        codigo: x.articulo_codigo,
        descripcion: x.articulo_descripcion,
        cantidad: cantidadParaEntrada(x.cantidad_base),
        costo: "0",
        politica: "",
      })),
    );
  }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    setMensaje("");
    const esFactura = seccion === "FACTURA";
    const body = esFactura
      ? {
          proveedor_id: proveedor,
          almacen_id: almacen,
          letra: letraFactura,
          punto_emision: puntoEmision,
          numero_factura: numeroFactura,
          ingreso_id: ingreso || null,
          politica_costo: politica,
          lineas: lineas.map((x) => ({
            articulo_id: x.articulo_id,
            cantidad_base: x.cantidad,
            costo_bruto_unitario: x.costo,
            politica_costo: x.politica || null,
          })),
        }
      : {
          proveedor_id: proveedor,
          almacen_id: almacen,
          observacion: null,
          lineas: lineas.map((x) => ({
            articulo_id: x.articulo_id,
            cantidad_base: x.cantidad,
          })),
        };
    try {
      const r = await apiFetch(
        `${apiUrl}/articulos/compras/${esFactura ? "facturas" : "ingresos"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const d = await r.json();
      if (!r.ok) {
        setMensaje(d.detail ?? "No se pudo confirmar");
        return;
      }
      const avisos = d.lineas
        .filter((x: { advertencia: string | null }) => x.advertencia)
        .map(
          (x: { articulo_codigo: string; advertencia: string }) =>
            `${x.articulo_codigo}: ${x.advertencia}`,
        );
      setMensaje(
        `${esFactura ? `Factura ${d.comprobante_proveedor}` : `Ingreso #${d.numero}`} confirmado${avisos.length ? `. AVISO: ${avisos.join(" · ")}` : ""}`,
      );
      setLineas([]);
      setIngreso("");
      setLetraFactura("A");
      setPuntoEmision("");
      setNumeroFactura("");
      setNuevo(false);
      await cargar();
    } catch {
      setMensaje("No se pudo conectar con el servidor");
    }
  }
  return (
    <main className="p-6 sm:p-9">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
            Compras
          </p>
          <h1 className="text-3xl font-semibold">Compras</h1>
          <p className="text-sm text-[var(--texto-suave)]">
            Ingresos de mercaderia y facturas. Todos los costos son brutos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setNuevo(false);
              setRotacion((actual) => !actual);
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${rotacion ? "bg-[var(--marca)] text-white" : "text-[var(--marca)]"}`}
          >
            Rotación y reposición
          </button>
          <a href="/notas-credito?tipo=PROVEEDOR" className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)]">Notas de credito</a>
          <button
            onClick={() => {
              setSeccion("INGRESO");
              setLineas([]);
              setRotacion(false);
              setNuevo(true);
            }}
            className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)]"
          >
            Nuevo ingreso
          </button>
          <button
            onClick={() => {
              setSeccion("FACTURA");
              setLineas([]);
              setRotacion(false);
              setNuevo(true);
            }}
            className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
          >
            Nueva factura
          </button>
        </div>
      </header>
      {mensaje && (
        <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm font-semibold">
          {mensaje}
        </p>
      )}
      {rotacion && <RotacionCompras almacenes={almacenes} />}
      {nuevo && <form onSubmit={guardar} className="mt-5 rounded-2xl border bg-white p-5">
        <div className="mb-5 flex items-start justify-between border-b pb-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Compras</p><h2 className="text-xl font-semibold">{seccion === "FACTURA" ? "Nueva factura de compra" : "Nuevo ingreso de mercaderia"}</h2></div>
          <button type="button" onClick={()=>setNuevo(false)} className="rounded-lg border px-3 py-2 font-semibold">Cerrar</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            Proveedor
            <select
              required
              value={proveedor}
              onChange={(e) => {
                setProveedor(e.target.value);
                setArticulo(null);
                setLineas([]);
                setIngreso("");
              }}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Seleccionar</option>
              {socios
                .filter((x) => x.id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.razon_social}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Almacen
            <select
              required
              value={almacen}
              onChange={(e) => setAlmacen(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="">Seleccionar</option>
              {almacenes
                .filter((x) => x.activo)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo} - {x.descripcion}
                  </option>
                ))}
            </select>
          </label>
          {seccion === "FACTURA" && (
            <>
              <label>
                Ingreso previo (opcional)
                <select
                  value={ingreso}
                  onChange={(e) => elegirIngreso(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="">Factura con ingreso directo de stock</option>
                  {ingresos.map((x) => (
                    <option key={x.id} value={x.id}>
                      Ingreso #{x.numero} · {x.proveedor_nombre}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="md:col-span-2">
                <legend className="font-medium">Comprobante del proveedor</legend>
                <p className="mb-2 text-xs text-[var(--texto-suave)]">
                  Ingrese la letra, el POI (punto de emisión) y el número impresos en la factura.
                </p>
                <div className="grid gap-3 sm:grid-cols-[100px_160px_1fr]">
                  <label>
                    Letra
                    <select
                      required
                      value={letraFactura}
                      onChange={(e) => setLetraFactura(e.target.value)}
                      className="mt-1 w-full rounded-xl border p-3"
                    >
                      {["A", "B", "C", "M", "X"].map((letra) => (
                        <option key={letra}>{letra}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    POI / Emisión
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{1,5}"
                      maxLength={5}
                      placeholder="00001"
                      value={puntoEmision}
                      onChange={(e) => setPuntoEmision(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                  <label>
                    Número de factura
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{1,20}"
                      maxLength={20}
                      placeholder="00000001"
                      value={numeroFactura}
                      onChange={(e) => setNumeroFactura(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                </div>
              </fieldset>
              <label>
                Politica general de costo
                <select
                  value={politica}
                  onChange={(e) => setPolitica(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-3"
                >
                  <option value="REEMPLAZAR">Cambiar al costo nuevo</option>
                  <option value="PROMEDIO">Promedio ponderado</option>
                  <option value="NO_MODIFICAR">No modificar costo</option>
                </select>
              </label>
            </>
          )}
        </div>
        {!ingreso && (
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
            <label key={proveedor}>
              Articulo del proveedor
              <div className="mt-1">
                <BuscadorArticulo
                  seleccionar={setArticulo}
                  proveedorId={proveedor}
                  deshabilitado={!proveedor}
                  limpiarAlSeleccionar
                />
              </div>
              <small className="text-[var(--texto-suave)]">
                Codigo interno, descripcion por palabras, codigo de proveedor o codigo de barra.
              </small>
              {articulo && (
                <span className="mt-1 block rounded-lg bg-[var(--marca-clara)] px-3 py-2 text-sm font-semibold text-[var(--marca)]">
                  Seleccionado: {articulo.codigo} - {articulo.descripcion}
                </span>
              )}
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button
              type="button"
              onClick={agregar}
              className="self-end rounded-xl border px-4 py-3 font-semibold text-[var(--marca)]"
            >
              Agregar
            </button>
          </div>
        )}
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Articulo</th>
                <th>Cantidad</th>
                {seccion === "FACTURA" && (
                  <>
                    <th>Costo bruto unitario</th>
                    <th>Politica particular</th>
                  </>
                )}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((x, i) => (
                <tr key={x.articulo_id} className="border-t">
                  <td className="p-3">
                    <b>{x.codigo}</b> {x.descripcion}
                  </td>
                  <td>
                    <input
                      className="w-32 rounded-lg border p-2"
                      type="number"
                      disabled={!!ingreso}
                      step="0.001"
                      value={x.cantidad}
                      onChange={(e) =>
                        setLineas(
                          lineas.map((l, j) =>
                            j === i ? { ...l, cantidad: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </td>
                  {seccion === "FACTURA" && (
                    <>
                      <td>
                        <input
                          required
                          className="w-40 rounded-lg border p-2"
                          type="number"
                          min="0"
                          step="0.000001"
                          value={x.costo}
                          onChange={(e) =>
                            setLineas(
                              lineas.map((l, j) =>
                                j === i ? { ...l, costo: e.target.value } : l,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="rounded-lg border p-2"
                          value={x.politica}
                          onChange={(e) =>
                            setLineas(
                              lineas.map((l, j) =>
                                j === i
                                  ? { ...l, politica: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        >
                          <option value="">Usar general</option>
                          <option value="REEMPLAZAR">Cambiar costo</option>
                          <option value="PROMEDIO">Promedio</option>
                          <option value="NO_MODIFICAR">No modificar</option>
                        </select>
                      </td>
                    </>
                  )}
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setLineas(lineas.filter((_, j) => j !== i))
                      }
                      className="text-red-700"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lineas.length && (
            <p className="p-6 text-center text-sm text-[var(--texto-suave)]">
              Seleccione proveedor y agregue productos.
            </p>
          )}
        </div>
        <button
          disabled={!lineas.length}
          className="mt-5 rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40"
        >
          Confirmar {seccion === "FACTURA" ? "factura" : "ingreso"}
        </button>
      </form>}
      {!rotacion && <section className="mt-5 rounded-2xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Ultimos documentos</h2>
        <div className="mt-3 overflow-x-auto">
          <TablaOrdenable data-exportar-excel="true" className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Numero</th>
                <th>Proveedor</th>
                <th>Almacen</th>
                <th>Total bruto</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {[...facturas, ...ingresos]
                .sort((a, b) =>
                  b.fecha_realizacion.localeCompare(a.fecha_realizacion),
                )
                .slice(0, 30)
                .map((x) => (
                  <FilaComprobanteExpandible key={`${x.tipo}-${x.id}`} columnas={6} etiqueta={`${x.tipo === "FACTURA" ? "factura" : "ingreso"} ${x.tipo === "FACTURA" ? x.comprobante_proveedor : `#${x.numero}`}`} valoresOrden={[x.tipo,x.tipo === "FACTURA" ? x.comprobante_proveedor??"" : x.numero,x.proveedor_nombre,x.almacen_codigo,x.total_bruto??"",x.fecha_realizacion]} detalle={<DetalleLineasComprobante datos={[{titulo:"Proveedor",valor:x.proveedor_nombre},{titulo:"Almacén",valor:x.almacen_codigo},{titulo:"Estado",valor:x.estado}]} lineas={x.lineas.map(linea=>({id:linea.articulo_id,codigo:linea.articulo_codigo,descripcion:linea.articulo_descripcion,cantidad:linea.cantidad_base,precioUnitario:linea.costo_bruto_unitario,total:linea.total_bruto,detalle:linea.politica_costo?`Política de costo: ${linea.politica_costo}`:linea.advertencia}))} totales={x.total_bruto?[{titulo:"Total bruto",valor:formatearMoneda(x.total_bruto)}]:[]}/>}>
                    <td className="py-3">{x.tipo}</td>
                    <td><span className="mr-2 text-[var(--marca)]" aria-hidden>▸</span><b className="font-mono text-[var(--marca)]">{x.tipo === "FACTURA" ? x.comprobante_proveedor : `#${x.numero}`}</b><small className="block text-[var(--texto-suave)]">Clic para ver las líneas</small></td>
                    <td>{x.proveedor_nombre}</td>
                    <td>{x.almacen_codigo}</td>
                    <td>
                      {x.total_bruto
                        ? formatearMoneda(x.total_bruto)
                        : "—"}
                    </td>
                    <td>
                      {new Date(x.fecha_realizacion).toLocaleString("es-AR")}
                    </td>
                  </FilaComprobanteExpandible>
                ))}
            </tbody>
          </TablaOrdenable>
        </div>
      </section>}
    </main>
  );
}
