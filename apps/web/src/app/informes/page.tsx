"use client";

import { apiFetch } from "@/api";
import { descargarLibroExcel, monedaExcel, porcentajeExcel } from "@/components/ExportarExcel";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Movimiento = { fecha:string;sentido:"INGRESO"|"EGRESO";origen:string;medio:string;concepto:string;importe:string };
type Flujo = { ingresos:string;egresos:string;flujo_neto:string;movimientos:Movimiento[] };
type VentaMargen = { id:string;fecha:string;comprobante:string;cliente_id:string;cliente:string;venta_original:string;notas_credito:string;venta_bruta:string;costo_bruto:string;margen_bruto:string;margen_porcentual:string };
type Margenes = { venta_bruta:string;notas_credito:string;costo_bruto:string;margen_bruto:string;margen_porcentual:string;ventas:VentaMargen[] };
type Socio = { id:string;razon_social:string;codigo:string;numero_documento:string;es_cliente:boolean;activo:boolean };

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
  const [socios, setSocios] = useState<Socio[]>([]);
  const [buscarCliente, setBuscarCliente] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setMensaje("");
    const rango = `desde=${desde}&hasta=${hasta}`;
    const [respuestaFlujo, respuestaMargenes] = await Promise.all([
      apiFetch(`${apiUrl}/informes/flujo-dinero?${rango}`, { credentials:"include" }),
      apiFetch(`${apiUrl}/informes/ventas-margenes?${rango}${clienteId?`&cliente_id=${clienteId}`:""}`, { credentials:"include" }),
    ]);
    if (respuestaFlujo.ok) setFlujo(await respuestaFlujo.json());
    if (respuestaMargenes.ok) setMargenes(await respuestaMargenes.json());
    if (!respuestaFlujo.ok || !respuestaMargenes.ok) setMensaje("No se pudieron cargar todos los informes");
    setCargando(false);
  }, [desde, hasta, clienteId]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);
  useEffect(() => { void apiFetch(`${apiUrl}/articulos/socios?rol=cliente`, { credentials:"include" }).then(async r => { if (r.ok) setSocios(await r.json()); }); }, []);
  const clientes = useMemo(() => {
    const terminos = buscarCliente.toLowerCase().split(/\s+/).filter(Boolean);
    return socios.filter(x => x.activo && x.es_cliente && terminos.every(t => `${x.codigo} ${x.razon_social} ${x.numero_documento}`.toLowerCase().includes(t))).slice(0, 10);
  }, [socios, buscarCliente]);

  async function exportarInformeCompleto() {
    if (!flujo || !margenes) return;
    setExportandoExcel(true);
    try {
      await descargarLibroExcel(`Informes-TaiLil-${desde}-${hasta}`, [
        { nombre:"Resumen", filas:[
          ["Período", "Indicador", "Valor"],
          [`${desde} al ${hasta}`, "Entradas de dinero", monedaExcel(flujo.ingresos)],
          [`${desde} al ${hasta}`, "Salidas de dinero", monedaExcel(flujo.egresos)],
          [`${desde} al ${hasta}`, "Flujo neto", monedaExcel(flujo.flujo_neto)],
          [`${desde} al ${hasta}`, "Ventas brutas", monedaExcel(margenes.venta_bruta)],
          [`${desde} al ${hasta}`, "Notas de credito", monedaExcel(margenes.notas_credito)],
          [`${desde} al ${hasta}`, "Costo histórico", monedaExcel(margenes.costo_bruto)],
          [`${desde} al ${hasta}`, "Margen bruto", monedaExcel(margenes.margen_bruto)],
          [`${desde} al ${hasta}`, "Margen porcentual", porcentajeExcel(margenes.margen_porcentual)],
        ]},
        { nombre:"Flujo de dinero", filas:[
          ["Fecha", "Sentido", "Origen", "Medio", "Concepto", "Importe"],
          ...flujo.movimientos.map(x=>[new Date(x.fecha),x.sentido,x.origen,x.medio,x.concepto,monedaExcel(x.importe)]),
        ]},
        { nombre:"Ventas y márgenes", filas:[
          ["Fecha", "Comprobante", "Cliente", "Venta original", "Notas de credito", "Venta neta", "Costo histórico neto", "Margen bruto", "Margen %"],
          ...margenes.ventas.map(x=>[new Date(x.fecha),x.comprobante,x.cliente,monedaExcel(x.venta_original),monedaExcel(x.notas_credito),monedaExcel(x.venta_bruta),monedaExcel(x.costo_bruto),monedaExcel(x.margen_bruto),porcentajeExcel(x.margen_porcentual)]),
        ]},
      ]);
    } finally {
      setExportandoExcel(false);
    }
  }

  return <main className="listas-precios-pagina p-6 sm:p-9">
    <header className="border-b pb-5"><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Control gerencial</p><h1 className="text-3xl font-semibold">Informes</h1><p className="mt-2 text-sm text-[var(--texto-suave)]">Entradas y salidas reales de dinero, ventas históricas, costos y márgenes.</p></header>
    <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm font-normal"/></label><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm font-normal"/></label><button type="button" disabled={exportandoExcel||!flujo||!margenes} onClick={()=>void exportarInformeCompleto()} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{exportandoExcel?"Generando...":"Descargar informe completo · Excel"}</button><div className="ml-auto flex rounded-xl border bg-[var(--fondo)] p-1"><button onClick={()=>setVista("flujo")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${vista==="flujo"?"bg-white text-[var(--marca)] shadow-sm":""}`}>Flujo de dinero</button><button onClick={()=>setVista("margenes")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${vista==="margenes"?"bg-white text-[var(--marca)] shadow-sm":""}`}>Ventas y márgenes</button></div></section>
    {mensaje&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{mensaje}</p>}{cargando&&<p className="mt-4 text-sm text-[var(--texto-suave)]">Actualizando informe...</p>}
    {vista==="flujo"&&flujo&&<section className="mt-5"><div className="grid gap-4 sm:grid-cols-3"><Tarjeta titulo="Entradas" valor={flujo.ingresos} clase="text-green-700"/><Tarjeta titulo="Salidas" valor={flujo.egresos} clase="text-red-700"/><Tarjeta titulo="Flujo neto" valor={flujo.flujo_neto} clase={Number(flujo.flujo_neto)>=0?"text-green-700":"text-red-700"}/></div><div className="mt-5 overflow-x-auto rounded-2xl border bg-white p-4"><h2 className="font-semibold">Movimiento cronológico del dinero</h2><table className="mt-3 w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th>Movimiento</th><th>Medio</th><th>Concepto</th><th className="text-right">Entrada</th><th className="text-right">Salida</th></tr></thead><tbody>{flujo.movimientos.map((x,i)=><tr key={`${x.origen}-${i}`} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="font-semibold">{x.origen}</td><td>{x.medio}</td><td>{x.concepto}</td><td className="text-right font-semibold text-green-700">{x.sentido==="INGRESO"?dinero(x.importe):"—"}</td><td className="text-right font-semibold text-red-700">{x.sentido==="EGRESO"?dinero(x.importe):"—"}</td></tr>)}</tbody></table>{!flujo.movimientos.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hubo movimientos en el período.</p>}</div></section>}
    {vista==="margenes"&&margenes&&<section className="mt-5"><div className="relative mb-4 max-w-xl"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Filtrar por cliente<input value={buscarCliente} onChange={e=>{setBuscarCliente(e.target.value);if(!e.target.value)setClienteId("")}} placeholder="Nombre, código o documento" className="mt-1 w-full rounded-xl border bg-white p-3 text-sm font-normal"/></label>{buscarCliente&&!clienteId&&<div className="absolute z-20 mt-1 w-full rounded-xl border bg-white p-1 shadow-xl">{clientes.map(x=><button key={x.id} onClick={()=>{setClienteId(x.id);setBuscarCliente(x.razon_social)}} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-[var(--fondo)]"><b>{x.razon_social}</b><small className="block">{x.codigo} · {x.numero_documento}</small></button>)}</div>}</div><div className="grid gap-4 sm:grid-cols-5"><Tarjeta titulo="Ventas netas" valor={margenes.venta_bruta}/><Tarjeta titulo="Notas de credito" valor={margenes.notas_credito}/><Tarjeta titulo="Costo histórico neto" valor={margenes.costo_bruto}/><Tarjeta titulo="Margen bruto" valor={margenes.margen_bruto} clase="text-[var(--marca)]"/><article className="rounded-2xl border bg-white p-5"><small className="uppercase text-[var(--texto-suave)]">Margen sobre venta</small><strong className="mt-2 block text-2xl">{Number(margenes.margen_porcentual).toFixed(2)}%</strong></article></div><div className="mt-5 overflow-x-auto rounded-2xl border bg-white p-4"><table className="w-full min-w-[1050px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th>Comprobante</th><th>Cliente</th><th className="text-right">Original</th><th className="text-right">NC</th><th className="text-right">Venta neta</th><th className="text-right">Costo neto</th><th className="text-right">Margen</th><th className="text-right">%</th></tr></thead><tbody>{margenes.ventas.map(x=><tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="font-mono">{x.comprobante}</td><td>{x.cliente}</td><td className="text-right">{dinero(x.venta_original)}</td><td className="text-right text-red-700">{dinero(x.notas_credito)}</td><td className="text-right">{dinero(x.venta_bruta)}</td><td className="text-right">{dinero(x.costo_bruto)}</td><td className="text-right font-semibold text-[var(--marca)]">{dinero(x.margen_bruto)}</td><td className="text-right">{Number(x.margen_porcentual).toFixed(2)}%</td></tr>)}</tbody></table></div></section>}
  </main>;
}

function Tarjeta({titulo,valor,clase=""}:{titulo:string;valor:string;clase?:string}) { return <article className="rounded-2xl border bg-white p-5"><small className="uppercase text-[var(--texto-suave)]">{titulo}</small><strong className={`mt-2 block text-2xl ${clase}`}>{dinero(valor)}</strong></article>; }
