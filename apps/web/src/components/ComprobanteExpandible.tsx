"use client";

import { KeyboardEvent, ReactNode, useEffect, useState } from "react";
import { apiFetch } from "@/api";
import { formatearCantidad, formatearMoneda } from "@/formato";

export type LineaComprobante = {
  id?: string;
  codigo?: string;
  descripcion: string;
  cantidad?: string | number | null;
  precioUnitario?: string | number | null;
  descuento?: string | number | null;
  total?: string | number | null;
  detalle?: string | null;
};

export type DatoComprobante = { titulo: string; valor: ReactNode };

export function DetalleLineasComprobante({
  lineas,
  datos = [],
  totales = [],
  mensajeSinLineas = "El comprobante no posee líneas de artículos.",
}: {
  lineas: LineaComprobante[];
  datos?: DatoComprobante[];
  totales?: DatoComprobante[];
  mensajeSinLineas?: string;
}) {
  const mostrarPrecio = lineas.some((linea) => linea.precioUnitario !== null && linea.precioUnitario !== undefined);
  const mostrarDescuento = lineas.some((linea) => linea.descuento !== null && linea.descuento !== undefined);
  const mostrarTotal = lineas.some((linea) => linea.total !== null && linea.total !== undefined);
  return <div className="rounded-xl border border-[var(--borde)] bg-[var(--fondo)] p-4">
    {datos.length > 0 && <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{datos.map((dato) => <div key={dato.titulo} className="rounded-lg bg-white p-3"><small className="text-[var(--texto-suave)]">{dato.titulo}</small><b className="block">{dato.valor}</b></div>)}</div>}
    {lineas.length > 0 ? <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr><th className="p-3">Artículo / concepto</th><th className="text-right">Cantidad</th>{mostrarPrecio&&<th className="text-right">Precio unitario</th>}{mostrarDescuento&&<th className="text-right">Desc.</th>}{mostrarTotal&&<th className="p-3 text-right">Total</th>}</tr></thead><tbody>{lineas.map((linea, indice) => <tr key={linea.id??`${linea.codigo??"linea"}-${indice}`} className="border-t"><td className="p-3"><b className="font-mono">{linea.codigo}</b>{linea.codigo&&" · "}<span>{linea.descripcion}</span>{linea.detalle&&<small className="block text-[var(--texto-suave)]">{linea.detalle}</small>}</td><td className="text-right">{linea.cantidad === null || linea.cantidad === undefined ? "—" : formatearCantidad(linea.cantidad)}</td>{mostrarPrecio&&<td className="text-right">{linea.precioUnitario === null || linea.precioUnitario === undefined ? "—" : formatearMoneda(linea.precioUnitario)}</td>}{mostrarDescuento&&<td className="text-right">{linea.descuento === null || linea.descuento === undefined ? "—" : `${Number(linea.descuento).toLocaleString("es-AR",{maximumFractionDigits:2})}%`}</td>}{mostrarTotal&&<td className="p-3 text-right font-semibold">{linea.total === null || linea.total === undefined ? "—" : formatearMoneda(linea.total)}</td>}</tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed bg-white p-5 text-center text-sm text-[var(--texto-suave)]">{mensajeSinLineas}</p>}
    {totales.length > 0 && <div className="ml-auto mt-4 grid max-w-sm grid-cols-2 gap-x-5 gap-y-2 rounded-xl bg-white p-4 text-right">{totales.map((dato) => <span className="contents" key={dato.titulo}><span>{dato.titulo}</span><b>{dato.valor}</b></span>)}</div>}
  </div>;
}

export function FilaComprobanteExpandible({
  children,
  columnas,
  detalle,
  className = "border-t",
  etiqueta,
  valoresOrden,
}: {
  children: ReactNode;
  columnas: number;
  detalle: ReactNode;
  className?: string;
  etiqueta: string;
  valoresOrden?: (string | number)[];
}) {
  const [abierto, setAbierto] = useState(false);
  function alternar() { setAbierto((actual) => !actual); }
  function teclado(evento: KeyboardEvent<HTMLTableRowElement>) {
    if ((evento.target as HTMLElement).closest("button,a,input,select,textarea,label")) return;
    if (evento.key === "Enter" || evento.key === " ") { evento.preventDefault(); alternar(); }
  }
  return <>
    <tr
      className={`${className} cursor-pointer hover:bg-[var(--marca-clara)]`}
      onClick={(evento) => {
        if ((evento.target as HTMLElement).closest("button,a,input,select,textarea,label")) return;
        alternar();
      }}
      onKeyDown={teclado}
      tabIndex={0}
      aria-expanded={abierto}
      aria-label={`${abierto?"Cerrar":"Abrir"} ${etiqueta}`}
      title={`${abierto?"Cerrar":"Ver"} líneas de ${etiqueta}`}
      data-valores-orden={JSON.stringify(valoresOrden??[])}
    >{children}</tr>
    {abierto&&<tr data-exportar-ignorar="true"><td colSpan={columnas} className="p-3">{detalle}</td></tr>}
  </>;
}

type VentaRemota = {
  cliente_nombre:string; punto_venta_codigo:string|null; caja_codigo:string|null; estado:string;
  subtotal_neto:string; total_iva:string; total_bruto:string; saldo_pendiente:string;
  lineas:{articulo_id:string;articulo_codigo:string;articulo_descripcion:string;lista_nombre:string;cantidad_base:string;precio_unitario_bruto:string;descuento_porcentual:string;total_bruto:string}[];
};

export function DetalleVentaRemoto({ ventaId }: { ventaId: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
  const [venta, setVenta] = useState<VentaRemota|null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch(`${apiUrl}/articulos/pos/ventas/${ventaId}`).then(async (respuesta) => {
    const datos = await respuesta.json().catch(()=>null);
    if (!respuesta.ok) { setError(datos?.detail??"No se pudo cargar el comprobante"); return; }
    setVenta(datos);
  }).catch(()=>setError("No se pudo conectar con el servidor")); }, [apiUrl, ventaId]);
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!venta) return <p className="rounded-xl bg-[var(--fondo)] p-4 text-sm">Cargando líneas del comprobante…</p>;
  return <DetalleLineasComprobante
    datos={[{titulo:"Cliente",valor:venta.cliente_nombre},{titulo:"Punto de venta",valor:venta.punto_venta_codigo??"—"},{titulo:"Caja",valor:venta.caja_codigo??"—"},{titulo:"Estado",valor:venta.estado}]}
    lineas={venta.lineas.map((linea)=>({id:linea.articulo_id,codigo:linea.articulo_codigo,descripcion:linea.articulo_descripcion,detalle:`Lista: ${linea.lista_nombre}`,cantidad:linea.cantidad_base,precioUnitario:linea.precio_unitario_bruto,descuento:linea.descuento_porcentual,total:linea.total_bruto}))}
    totales={[{titulo:"Subtotal neto",valor:formatearMoneda(venta.subtotal_neto)},{titulo:"IVA",valor:formatearMoneda(venta.total_iva)},{titulo:"Total",valor:formatearMoneda(venta.total_bruto)},{titulo:"Saldo pendiente",valor:formatearMoneda(venta.saldo_pendiente)}]}
  />;
}

type CompraRemota = {
  proveedor_nombre:string; almacen_codigo:string; estado:string; total_bruto:string|null;
  lineas:{id:string;articulo_id:string;articulo_codigo:string;articulo_descripcion:string;cantidad_base:string;costo_bruto_unitario:string|null;total_bruto:string|null;politica_costo:string|null;advertencia:string|null}[];
};

export function DetalleCompraRemoto({ documentoId, tipo = "facturas" }: { documentoId: string; tipo?: "facturas"|"ingresos" }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
  const [documento, setDocumento] = useState<CompraRemota|null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch(`${apiUrl}/articulos/compras/${tipo}/${documentoId}`).then(async (respuesta) => {
    const datos = await respuesta.json().catch(()=>null);
    if (!respuesta.ok) { setError(datos?.detail??"No se pudo cargar el comprobante"); return; }
    setDocumento(datos);
  }).catch(()=>setError("No se pudo conectar con el servidor")); }, [apiUrl, documentoId, tipo]);
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!documento) return <p className="rounded-xl bg-[var(--fondo)] p-4 text-sm">Cargando líneas del comprobante…</p>;
  return <DetalleLineasComprobante datos={[{titulo:"Proveedor",valor:documento.proveedor_nombre},{titulo:"Almacén",valor:documento.almacen_codigo},{titulo:"Estado",valor:documento.estado}]} lineas={documento.lineas.map((linea)=>({id:linea.id,codigo:linea.articulo_codigo,descripcion:linea.articulo_descripcion,cantidad:linea.cantidad_base,precioUnitario:linea.costo_bruto_unitario,total:linea.total_bruto,detalle:linea.advertencia??(linea.politica_costo?`Política de costo: ${linea.politica_costo}`:null)}))} totales={documento.total_bruto?[{titulo:"Total bruto",valor:formatearMoneda(documento.total_bruto)}]:[]}/>;
}

type NotaRemota = {
  socio_nombre:string; documento_origen:string; almacen_codigo:string; estado:string; modalidad:string; motivo:string; total_bruto:string;
  lineas:{articulo_id:string;articulo_codigo:string;articulo_descripcion:string;cantidad_base:string;importe_unitario_bruto:string;total_bruto:string}[];
};

export function DetalleNotaRemoto({ notaId }: { notaId: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
  const [nota, setNota] = useState<NotaRemota|null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void apiFetch(`${apiUrl}/notas-credito/${notaId}`).then(async (respuesta) => {
    const datos = await respuesta.json().catch(()=>null);
    if (!respuesta.ok) { setError(datos?.detail??"No se pudo cargar el comprobante"); return; }
    setNota(datos);
  }).catch(()=>setError("No se pudo conectar con el servidor")); }, [apiUrl, notaId]);
  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!nota) return <p className="rounded-xl bg-[var(--fondo)] p-4 text-sm">Cargando líneas del comprobante…</p>;
  return <DetalleLineasComprobante datos={[{titulo:"Socio",valor:nota.socio_nombre},{titulo:"Comprobante original",valor:nota.documento_origen},{titulo:"Almacén",valor:nota.almacen_codigo},{titulo:"Estado",valor:nota.estado}]} lineas={nota.lineas.map((linea)=>({id:linea.articulo_id,codigo:linea.articulo_codigo,descripcion:linea.articulo_descripcion,cantidad:linea.cantidad_base,precioUnitario:linea.importe_unitario_bruto,total:linea.total_bruto}))} totales={[{titulo:"Total nota de crédito",valor:formatearMoneda(nota.total_bruto)}]} mensajeSinLineas={nota.modalidad==="NARRATIVA"?`Nota narrativa: ${nota.motivo}`:undefined}/>;
}
