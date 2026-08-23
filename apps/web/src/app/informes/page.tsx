"use client";

import { apiFetch } from "@/api";
import { descargarLibroExcel, IconoExcel, monedaExcel, porcentajeExcel } from "@/components/ExportarExcel";
import TablaOrdenable from "@/components/TablaOrdenable";
import { DetalleCompraRemoto, DetalleNotaRemoto, DetalleVentaRemoto, FilaComprobanteExpandible } from "@/components/ComprobanteExpandible";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type RelacionMovimiento = { tipo:string;id:string;comprobante:string;importe:string };
type Movimiento = { id:string;fecha:string;sentido:"INGRESO"|"EGRESO";origen:string;tipo_origen:string;medio:string;concepto:string;importe:string;usuario:string;caja:string;punto_venta:string;periodo_operativo:string|null;socio_id:string|null;socio:string|null;categoria:string;referencia:string|null;relaciones:RelacionMovimiento[] };
type Flujo = { ingresos:string;egresos:string;flujo_neto:string;movimientos:Movimiento[] };
type VentaMargen = { id:string;fecha:string;comprobante:string;cliente_id:string;cliente:string;punto_venta:string;caja:string;cantidad_articulos:number;venta_original:string;notas_credito:string;venta_bruta:string;costo_bruto:string;margen_bruto:string;margen_porcentual:string };
type DocumentoRentabilidad = { id:string;tipo:"FACTURA"|"NOTA_CREDITO";fecha:string;comprobante:string;documento_origen:string|null;cliente:string;punto_venta:string;caja:string;modalidad:string;motivo:string|null;importe:string;costo:string;margen:string;margen_porcentual:string };
type Margenes = { venta_bruta:string;notas_credito:string;costo_bruto:string;margen_bruto:string;margen_porcentual:string;ventas:VentaMargen[];documentos:DocumentoRentabilidad[] };
type Socio = { id:string;razon_social:string;codigo:string;numero_documento:string };
type Articulo = { id:string;codigo:string;descripcion:string };

const hoy = new Date().toISOString().slice(0, 10);
const haceTreinta = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
const dinero = (valor:string|number|undefined) => new Intl.NumberFormat("es-AR", { style:"currency", currency:"ARS" }).format(Number(valor ?? 0));
const fecha = (valor:string) => new Intl.DateTimeFormat("es-AR", { dateStyle:"short", timeStyle:"short" }).format(new Date(valor));

export default function Informes() {
  const [vista, setVista] = useState<"flujo"|"margenes">("flujo");
  const [desde, setDesde] = useState(haceTreinta);
  const [hasta, setHasta] = useState(hoy);
  const [flujo, setFlujo] = useState<Flujo|null>(null);
  const [margenes, setMargenes] = useState<Margenes|null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [buscarCliente, setBuscarCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [buscarArticulo, setBuscarArticulo] = useState("");
  const [articuloId, setArticuloId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [detalleMovimiento,setDetalleMovimiento]=useState<Movimiento|null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setMensaje("");
    const rango = `desde=${desde}&hasta=${hasta}`;
    const [respuestaFlujo, respuestaMargenes] = await Promise.all([
      apiFetch(`${apiUrl}/informes/flujo-dinero?${rango}`, { credentials:"include" }),
      apiFetch(`${apiUrl}/informes/ventas-margenes?${rango}${clienteId?`&cliente_id=${clienteId}`:""}${articuloId?`&articulo_id=${articuloId}`:""}`, { credentials:"include" }),
    ]);
    if (respuestaFlujo.ok) setFlujo(await respuestaFlujo.json());
    if (respuestaMargenes.ok) { const datos:Margenes=await respuestaMargenes.json();setMargenes(datos);setSeleccionados(datos.documentos.map(x=>x.id)); }
    if (!respuestaFlujo.ok || !respuestaMargenes.ok) setMensaje("No se pudieron cargar todos los informes");
    setCargando(false);
  }, [desde, hasta, clienteId, articuloId]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);
  useEffect(() => {
    if (!buscarCliente.trim() || clienteId) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => void apiFetch(`${apiUrl}/informes/filtros/clientes?buscar=${encodeURIComponent(buscarCliente)}`, { credentials:"include", signal:controlador.signal }).then(async r => { if (r.ok) setSocios(await r.json()); }).catch(()=>undefined), 180);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [buscarCliente, clienteId]);
  useEffect(() => {
    if (!buscarArticulo.trim() || articuloId) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => void apiFetch(`${apiUrl}/informes/filtros/articulos?buscar=${encodeURIComponent(buscarArticulo)}`, { credentials:"include", signal:controlador.signal }).then(async r => { if (r.ok) setArticulos(await r.json()); }).catch(()=>undefined), 180);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [buscarArticulo, articuloId]);
  const rentabilidadSeleccionada=useMemo(()=>{const documentos=margenes?.documentos.filter(x=>seleccionados.includes(x.id))??[];const importe=documentos.reduce((s,x)=>s+Number(x.importe),0),costo=documentos.reduce((s,x)=>s+Number(x.costo),0),margen=documentos.reduce((s,x)=>s+Number(x.margen),0);return{cantidad:documentos.length,importe,costo,margen,porcentaje:importe?margen/importe*100:0}},[margenes,seleccionados]);

  async function exportarInformeCompleto() {
    if (!flujo || !margenes) return;
    const ventasPeriodo=margenes.documentos.filter(x=>x.tipo==="FACTURA").reduce((s,x)=>s+Number(x.importe),0);
    const notasPeriodo=-margenes.documentos.filter(x=>x.tipo==="NOTA_CREDITO").reduce((s,x)=>s+Number(x.importe),0);
    const importePeriodo=margenes.documentos.reduce((s,x)=>s+Number(x.importe),0);
    const costoPeriodo=margenes.documentos.reduce((s,x)=>s+Number(x.costo),0);
    const margenPeriodo=margenes.documentos.reduce((s,x)=>s+Number(x.margen),0);
    setExportandoExcel(true);
    try {
      await descargarLibroExcel(`Informes-TaiLil-${desde}-${hasta}`, [
        { nombre:"Resumen", titulo:"Informes · Resumen general", subtitulo:`Período ${desde} al ${hasta}`, metadatos:[["Cliente",buscarCliente||"Todos"],["Producto",buscarArticulo||"Todos"]], filas:[
          ["Período", "Indicador", "Valor"],
          [`${desde} al ${hasta}`, "Entradas de dinero", monedaExcel(flujo.ingresos)],
          [`${desde} al ${hasta}`, "Salidas de dinero", monedaExcel(flujo.egresos)],
          [`${desde} al ${hasta}`, "Flujo neto", monedaExcel(flujo.flujo_neto)],
          [`${desde} al ${hasta}`, "Ventas brutas", monedaExcel(ventasPeriodo)],
          [`${desde} al ${hasta}`, "Notas de credito", monedaExcel(notasPeriodo)],
          [`${desde} al ${hasta}`, "Importe neto", monedaExcel(importePeriodo)],
          [`${desde} al ${hasta}`, "Costo histórico", monedaExcel(costoPeriodo)],
          [`${desde} al ${hasta}`, "Margen bruto", monedaExcel(margenPeriodo)],
          [`${desde} al ${hasta}`, "Margen porcentual", porcentajeExcel(importePeriodo?margenPeriodo/importePeriodo*100:0)],
          [`${desde} al ${hasta}`, "Documentos seleccionados", rentabilidadSeleccionada.cantidad],
          [`${desde} al ${hasta}`, "Importe combinado seleccionado", monedaExcel(rentabilidadSeleccionada.importe)],
          [`${desde} al ${hasta}`, "Costo combinado seleccionado", monedaExcel(rentabilidadSeleccionada.costo)],
          [`${desde} al ${hasta}`, "Margen combinado seleccionado", monedaExcel(rentabilidadSeleccionada.margen)],
          [`${desde} al ${hasta}`, "Margen porcentual seleccionado", porcentajeExcel(rentabilidadSeleccionada.porcentaje)],
        ]},
        { nombre:"Flujo de dinero", titulo:"Informes · Flujo de dinero", subtitulo:`Período ${desde} al ${hasta}`, metadatos:[["Cliente",buscarCliente||"Todos"],["Producto",buscarArticulo||"Todos"]], filas:[
          ["Fecha", "Sentido", "Origen", "Usuario", "Caja", "Punto de venta", "Socio", "Medio", "Concepto", "Referencia", "Comprobantes relacionados", "Importe"],
          ...flujo.movimientos.map(x=>[new Date(x.fecha),x.sentido,x.origen,x.usuario,x.caja,x.punto_venta,x.socio??"",x.medio,x.concepto,x.referencia??"",x.relaciones.map(r=>`${r.comprobante} (${dinero(r.importe)})`).join(" · "),monedaExcel(x.importe)]),
        ]},
        { nombre:"Ventas y márgenes", titulo:"Informes · Ventas y márgenes", subtitulo:`Período ${desde} al ${hasta}`, metadatos:[["Cliente",buscarCliente||"Todos"],["Producto",buscarArticulo||"Todos"]], filas:[
          ["Fecha y hora", "Tipo", "Comprobante", "Factura vinculada", "Cliente", "Punto de venta", "Caja", "Modalidad", "Motivo", "Importe", "Costo histórico", "Margen", "Margen %"],
          ...margenes.documentos.map(x=>[new Date(x.fecha),x.tipo,x.comprobante,x.documento_origen??"",x.cliente,x.punto_venta,x.caja,x.modalidad,x.motivo??"",monedaExcel(x.importe),monedaExcel(x.costo),monedaExcel(x.margen),porcentajeExcel(x.margen_porcentual)]),
        ]},
      ]);
    } finally {
      setExportandoExcel(false);
    }
  }

  return <main className="listas-precios-pagina p-6 sm:p-9">
    <header className="flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Control gerencial</p><h1 className="text-3xl font-semibold">Informes</h1><p className="mt-2 text-sm text-[var(--texto-suave)]">Entradas y salidas reales de dinero, ventas históricas, costos y márgenes.</p></div><button type="button" disabled={exportandoExcel||!flujo||!margenes} onClick={()=>void exportarInformeCompleto()} className="erp-exportar-excel-encabezado" title={exportandoExcel?"Generando informe...":"Descargar informe completo en Excel"} aria-label={exportandoExcel?"Generando informe Excel":"Descargar informe completo en Excel"}><IconoExcel/></button></header>
    <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm font-normal"/></label><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm font-normal"/></label><div className="ml-auto flex rounded-xl border bg-[var(--fondo)] p-1"><button onClick={()=>setVista("flujo")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${vista==="flujo"?"bg-white text-[var(--marca)] shadow-sm":""}`}>Flujo de dinero</button><button onClick={()=>setVista("margenes")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${vista==="margenes"?"bg-white text-[var(--marca)] shadow-sm":""}`}>Ventas y márgenes</button></div></section>
    {mensaje&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{mensaje}</p>}{cargando&&<p className="mt-4 text-sm text-[var(--texto-suave)]">Actualizando informe...</p>}
    {vista==="flujo"&&flujo&&<section className="mt-5"><div className="grid gap-4 sm:grid-cols-3"><Tarjeta titulo="Entradas" valor={flujo.ingresos} clase="text-green-700"/><Tarjeta titulo="Salidas" valor={flujo.egresos} clase="text-red-700"/><Tarjeta titulo="Flujo neto" valor={flujo.flujo_neto} clase={Number(flujo.flujo_neto)>=0?"text-green-700":"text-red-700"}/></div><div className="mt-5 overflow-x-auto rounded-2xl border bg-white p-4"><h2 className="font-semibold">Movimiento cronológico del dinero</h2><p className="mt-1 text-xs text-[var(--texto-suave)]">Abra la trazabilidad para ver quién lo registró, desde qué caja y a qué comprobantes quedó aplicado.</p><TablaOrdenable className="mt-3 w-full min-w-[1120px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th>Movimiento</th><th>Usuario</th><th>Caja</th><th>Socio</th><th>Medio</th><th>Concepto</th><th className="text-right">Entrada</th><th className="text-right">Salida</th><th>Detalle</th></tr></thead><tbody>{flujo.movimientos.map((x,i)=><tr key={`${x.id}-${x.medio}-${i}`} className="border-b last:border-0"><td className="p-2 whitespace-nowrap">{fecha(x.fecha)}</td><td className="font-semibold">{x.origen}</td><td>{x.usuario}</td><td>{x.caja}</td><td>{x.socio??"—"}</td><td>{x.medio}</td><td>{x.concepto}</td><td className="text-right font-semibold text-green-700">{x.sentido==="INGRESO"?dinero(x.importe):"—"}</td><td className="text-right font-semibold text-red-700">{x.sentido==="EGRESO"?dinero(x.importe):"—"}</td><td><button type="button" onClick={()=>setDetalleMovimiento(x)} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-xs font-semibold text-[var(--marca)]">Ver trazabilidad</button></td></tr>)}</tbody></TablaOrdenable>{!flujo.movimientos.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hubo movimientos en el período.</p>}</div></section>}
    {vista==="margenes"&&margenes&&<section className="mt-5">
      <div className="mb-5 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
        <div className="relative"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Cliente<input value={buscarCliente} onChange={e=>{setBuscarCliente(e.target.value);setClienteId("");setSocios([])}} placeholder="Nombre, código o documento" className="mt-1 w-full rounded-xl border p-3 text-sm font-normal"/></label>{buscarCliente&&!clienteId&&<div className="absolute z-30 mt-1 w-full rounded-xl border bg-white p-1 shadow-xl">{socios.map(x=><button type="button" key={x.id} onClick={()=>{setClienteId(x.id);setBuscarCliente(x.razon_social);setSocios([])}} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[var(--fondo)]"><b>{x.razon_social}</b><small className="block text-[var(--texto-suave)]">{x.codigo} · {x.numero_documento}</small></button>)}{!socios.length&&<p className="p-3 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}</div>} {clienteId&&<button type="button" onClick={()=>{setClienteId("");setBuscarCliente("");setSocios([])}} className="mt-2 text-xs font-semibold text-[var(--marca)]">Quitar filtro de cliente</button>}</div>
        <div className="relative"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Producto<input value={buscarArticulo} onChange={e=>{setBuscarArticulo(e.target.value);setArticuloId("");setArticulos([])}} placeholder="Código, descripción, barra o código de proveedor" className="mt-1 w-full rounded-xl border p-3 text-sm font-normal"/></label>{buscarArticulo&&!articuloId&&<div className="absolute z-30 mt-1 w-full rounded-xl border bg-white p-1 shadow-xl">{articulos.map(x=><button type="button" key={x.id} onClick={()=>{setArticuloId(x.id);setBuscarArticulo(`${x.codigo} - ${x.descripcion}`);setArticulos([])}} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[var(--fondo)]"><b className="font-mono">{x.codigo}</b><span> · {x.descripcion}</span></button>)}{!articulos.length&&<p className="p-3 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}</div>} {articuloId&&<button type="button" onClick={()=>{setArticuloId("");setBuscarArticulo("");setArticulos([])}} className="mt-2 text-xs font-semibold text-[var(--marca)]">Quitar filtro de producto</button>}</div>
      </div>
      <div className="rounded-2xl border border-[var(--marca)] bg-[var(--marca-clara)] p-4"><div className="mb-3"><h2 className="font-semibold">Rentabilidad combinada de la selección</h2><p className="text-xs text-[var(--texto-suave)]">{rentabilidadSeleccionada.cantidad} documentos seleccionados. Las N/C descuentan importe y costo; una N/C narrativa descuenta solamente importe.</p></div><div className="grid gap-3 sm:grid-cols-4"><Tarjeta titulo="Importe combinado" valor={String(rentabilidadSeleccionada.importe)}/><Tarjeta titulo="Costo combinado" valor={String(rentabilidadSeleccionada.costo)}/><Tarjeta titulo="Margen combinado" valor={String(rentabilidadSeleccionada.margen)} clase="text-[var(--marca)]"/><article className="rounded-2xl border bg-white p-5"><small className="uppercase text-[var(--texto-suave)]">Margen combinado</small><strong className="mt-2 block text-2xl">{rentabilidadSeleccionada.porcentaje.toFixed(2)}%</strong></article></div></div>
      <div className="mt-5 overflow-x-auto rounded-2xl border bg-white p-4"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-semibold">Facturas y notas de crédito</h2><p className="text-xs text-[var(--texto-suave)]">{margenes.documentos.length} documentos · seleccione los que desea comparar</p></div><div className="flex gap-2"><button type="button" onClick={()=>setSeleccionados(margenes.documentos.map(x=>x.id))} className="rounded-lg border px-3 py-2 text-xs font-semibold">Seleccionar todos</button><button type="button" onClick={()=>setSeleccionados([])} className="rounded-lg border px-3 py-2 text-xs font-semibold">Quitar selección</button></div></div><TablaOrdenable className="w-full min-w-[1650px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2"></th><th>Fecha y hora</th><th>Tipo</th><th>Comprobante</th><th>Factura vinculada</th><th>Cliente</th><th>Punto de venta</th><th>Caja</th><th>Modalidad / motivo</th><th className="text-right">Importe</th><th className="text-right">Costo</th><th className="text-right">Margen</th><th className="text-right">Margen %</th></tr></thead><tbody>{margenes.documentos.map(x=><FilaDocumentoInforme key={x.id} documento={x}><td className="p-2"><input type="checkbox" aria-label={`Seleccionar ${x.comprobante}`} checked={seleccionados.includes(x.id)} onChange={e=>setSeleccionados(e.target.checked?[...seleccionados,x.id]:seleccionados.filter(id=>id!==x.id))}/></td><td className="whitespace-nowrap">{fecha(x.fecha)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${x.tipo==="FACTURA"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`}>{x.tipo==="FACTURA"?"FACTURA":"N/C"}</span></td><td className="font-mono">{x.comprobante}</td><td className="font-mono font-semibold">{x.documento_origen??"—"}</td><td>{x.cliente}</td><td>{x.punto_venta}</td><td>{x.caja}</td><td>{x.tipo==="NOTA_CREDITO"?<><b>{x.modalidad==="NARRATIVA"?"NARRATIVA":"PRODUCTOS"}</b><small className="block max-w-64 truncate" title={x.motivo??""}>{x.motivo}</small></>:"Venta"}</td><td className={`text-right font-semibold ${Number(x.importe)<0?"text-red-700":""}`}>{dinero(x.importe)}</td><td className="text-right">{dinero(x.costo)}</td><td className="text-right font-semibold text-[var(--marca)]">{dinero(x.margen)}</td><td className="text-right font-semibold">{Number(x.margen_porcentual).toFixed(2)}%</td></FilaDocumentoInforme>)}</tbody></TablaOrdenable>{!margenes.documentos.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay facturas ni notas de crédito para los filtros seleccionados.</p>}</div>
    </section>}
    {detalleMovimiento&&<DetalleMovimiento movimiento={detalleMovimiento} cerrar={()=>setDetalleMovimiento(null)}/>}
  </main>;
}

function Tarjeta({titulo,valor,clase=""}:{titulo:string;valor:string;clase?:string}) { return <article className="rounded-2xl border bg-white p-5"><small className="uppercase text-[var(--texto-suave)]">{titulo}</small><strong className={`mt-2 block text-2xl ${clase}`}>{dinero(valor)}</strong></article>; }

function FilaDocumentoInforme({documento,children}:{documento:DocumentoRentabilidad;children:ReactNode}) { const id=documento.id.split(":").at(-1)??documento.id; return <FilaComprobanteExpandible columnas={13} etiqueta={`comprobante ${documento.comprobante}`} valoresOrden={["",documento.fecha,documento.tipo,documento.comprobante,documento.documento_origen??"",documento.cliente,documento.punto_venta,documento.caja,documento.modalidad,documento.importe,documento.costo,documento.margen,documento.margen_porcentual]} className={`border-b last:border-0 ${documento.tipo==="NOTA_CREDITO"?"bg-red-50/40":""}`} detalle={documento.tipo==="FACTURA"?<DetalleVentaRemoto ventaId={id}/>:<DetalleNotaRemoto notaId={id}/>}>{children}</FilaComprobanteExpandible>; }

function RelacionInforme({relacion}:{relacion:RelacionMovimiento}) { return <details className="rounded-xl border bg-white"><summary className="cursor-pointer list-none px-4 py-3 font-semibold text-[var(--marca)]">{relacion.comprobante}<small className="block">Aplicado {dinero(relacion.importe)} · ver líneas</small></summary><div className="min-w-[680px] p-3 pt-0">{relacion.tipo==="FACTURA_COMPRA"?<DetalleCompraRemoto documentoId={relacion.id}/>:<DetalleVentaRemoto ventaId={relacion.id}/>}</div></details>; }

function DetalleMovimiento({movimiento,cerrar}:{movimiento:Movimiento;cerrar:()=>void}){const cuenta=movimiento.socio_id?`/tesoreria?tipo=${movimiento.tipo_origen==="PAGO_PROVEEDOR"?"proveedores":"clientes"}&socio_id=${movimiento.socio_id}`:"/tesoreria";return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><header className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Trazabilidad financiera</p><h2 className="text-2xl font-semibold">{movimiento.origen}</h2><p className="text-sm text-[var(--texto-suave)]">{fecha(movimiento.fecha)} · {dinero(movimiento.importe)}</p></div><button type="button" onClick={cerrar} className="rounded-lg border px-3 py-2 text-xl">×</button></header><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Usuario",movimiento.usuario],["Caja",movimiento.caja],["Punto de venta",movimiento.punto_venta],["Período",movimiento.periodo_operativo??"—"],["Socio",movimiento.socio??"—"],["Medio",movimiento.medio],["Categoría",movimiento.categoria],["Referencia",movimiento.referencia??"—"]].map(([titulo,valor])=><div key={titulo} className="rounded-xl bg-[var(--fondo)] p-3"><small className="text-[var(--texto-suave)]">{titulo}</small><b className="block">{valor}</b></div>)}</div><div className="mt-5 rounded-2xl border p-4"><small className="text-[var(--texto-suave)]">Concepto</small><p className="font-semibold">{movimiento.concepto}</p></div><section className="mt-5"><h3 className="font-semibold">Mapa de relación</h3><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-xl border bg-[var(--fondo)] px-4 py-3">{movimiento.caja}</span><b aria-hidden>→</b><span className="rounded-xl border border-[var(--marca)] bg-[var(--marca-clara)] px-4 py-3 font-semibold">{movimiento.origen}<small className="block">{dinero(movimiento.importe)}</small></span>{movimiento.socio&&<><b aria-hidden>→</b><a href={cuenta} className="rounded-xl border px-4 py-3 font-semibold text-[var(--marca)]">{movimiento.socio}<small className="block">Abrir cuenta</small></a></>}{movimiento.relaciones.map(relacion=><span key={`${relacion.tipo}-${relacion.id}`} className="contents"><b aria-hidden>→</b><RelacionInforme relacion={relacion}/></span>)}</div>{!movimiento.relaciones.length&&movimiento.tipo_origen==="PAGO_PROVEEDOR"&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Este pago todavía no fue conciliado con ninguna factura. Está disponible en la cuenta del proveedor.</p>}</section></section></div>}
