"use client";

import { apiFetch } from "@/api";
import TablaOrdenable from "@/components/TablaOrdenable";
import { FormEvent, useCallback, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Punto = { id:string;codigo:string;descripcion:string;letra:string;tipo_documento:string;almacen_id:string;ultimo_numero:number;activo:boolean };
type Caja = { id:string;punto_venta_id:string;codigo:string;descripcion:string;activo:boolean };
type Almacen = { id:string;codigo:string;descripcion:string;activo:boolean };
type Edicion = { tipo:"punto"|"caja";id:string;codigo:string;descripcion:string };
type Confirmacion = { tipo:"punto"|"caja";id:string;nombre:string };

export default function ConfiguracionPos() {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [codigoPunto, setCodigoPunto] = useState("");
  const [descripcionPunto, setDescripcionPunto] = useState("");
  const [almacen, setAlmacen] = useState("");
  const [puntoCaja, setPuntoCaja] = useState("");
  const [codigoCaja, setCodigoCaja] = useState("");
  const [descripcionCaja, setDescripcionCaja] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [descripcionEditada, setDescripcionEditada] = useState("");
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    const [respuestaPuntos, respuestaCajas, respuestaAlmacenes] = await Promise.all([
      apiFetch(`${apiUrl}/articulos/pos/configuracion/puntos-venta`, { credentials:"include" }),
      apiFetch(`${apiUrl}/articulos/pos/configuracion/cajas`, { credentials:"include" }),
      apiFetch(`${apiUrl}/articulos/almacenes`, { credentials:"include" }),
    ]);
    if (respuestaPuntos.ok) setPuntos(await respuestaPuntos.json());
    if (respuestaCajas.ok) setCajas(await respuestaCajas.json());
    if (respuestaAlmacenes.ok) setAlmacenes(await respuestaAlmacenes.json());
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function crearPunto(e: FormEvent) {
    e.preventDefault();
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/configuracion/puntos-venta`, {
      method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ codigo:codigoPunto, descripcion:descripcionPunto, almacen_id:almacen }),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? "Punto de venta creado" : datos.detail ?? "No se pudo crear");
    if (respuesta.ok) { setCodigoPunto(""); setDescripcionPunto(""); await cargar(); }
  }

  async function crearCaja(e: FormEvent) {
    e.preventDefault();
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/configuracion/cajas`, {
      method:"POST", credentials:"include", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ punto_venta_id:puntoCaja, codigo:codigoCaja, descripcion:descripcionCaja }),
    });
    const datos = await respuesta.json();
    setMensaje(respuesta.ok ? "Caja creada" : datos.detail ?? "No se pudo crear");
    if (respuesta.ok) { setCodigoCaja(""); setDescripcionCaja(""); await cargar(); }
  }

  function abrirEdicion(registro: Edicion) {
    setEdicion(registro);
    setDescripcionEditada(registro.descripcion);
  }

  async function guardarDescripcion(e: FormEvent) {
    e.preventDefault();
    if (!edicion) return;
    setProcesando(true);
    const coleccion = edicion.tipo === "punto" ? "puntos-venta" : "cajas";
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/configuracion/${coleccion}/${edicion.id}`, {
      method:"PATCH", credentials:"include", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ descripcion:descripcionEditada }),
    });
    const datos = await respuesta.json().catch(() => null);
    setProcesando(false);
    if (!respuesta.ok) { setMensaje(datos?.detail ?? "No se pudo modificar la descripción"); return; }
    setMensaje(edicion.tipo === "punto" ? "Punto de venta modificado" : "Caja modificada");
    setEdicion(null);
    await cargar();
  }

  async function eliminarConfirmado() {
    if (!confirmacion) return;
    setProcesando(true);
    const coleccion = confirmacion.tipo === "punto" ? "puntos-venta" : "cajas";
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/configuracion/${coleccion}/${confirmacion.id}`, { method:"DELETE", credentials:"include" });
    const datos = respuesta.ok ? null : await respuesta.json().catch(() => null);
    setProcesando(false);
    if (!respuesta.ok) { setMensaje(datos?.detail ?? "No se pudo eliminar el registro"); setConfirmacion(null); return; }
    setMensaje(confirmacion.tipo === "punto" ? "Punto de venta eliminado" : "Caja eliminada");
    setConfirmacion(null);
    await cargar();
  }

  return <main className="listas-precios-pagina p-6 sm:p-9">
    <header className="border-b pb-5"><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas · Administración</p><h1 className="text-3xl font-semibold">Puntos de venta y cajas</h1><p className="text-sm text-[var(--texto-suave)]">Documento configurado: PRESUPUESTO · Letra T.</p></header>
    {mensaje&&<p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">{mensaje}</p>}
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Puntos de venta</h2>
        <form onSubmit={crearPunto} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>Código<input required maxLength={4} className="mt-1 w-full rounded-xl border p-3" value={codigoPunto} onChange={e=>setCodigoPunto(e.target.value)}/></label>
          <label>Descripción<input required className="mt-1 w-full rounded-xl border p-3" value={descripcionPunto} onChange={e=>setDescripcionPunto(e.target.value)}/></label>
          <label className="sm:col-span-2">Almacén<select required className="mt-1 w-full rounded-xl border p-3" value={almacen} onChange={e=>setAlmacen(e.target.value)}><option value="">Seleccionar</option>{almacenes.filter(x=>x.activo).map(x=><option key={x.id} value={x.id}>{x.codigo} - {x.descripcion}</option>)}</select></label>
          <button className="sm:col-span-2 justify-self-end rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white">Crear punto</button>
        </form>
        <div className="mt-5 overflow-x-auto"><TablaOrdenable className="w-full text-left text-sm"><thead><tr><th>Código y descripción</th><th>Documento</th><th>Último</th><th>Acciones</th></tr></thead><tbody>{puntos.map(x=><tr className="border-t" key={x.id}><td className="py-3"><b>{x.codigo}</b><small className="block">{x.descripcion}</small></td><td>{x.tipo_documento} {x.letra}</td><td>{String(x.ultimo_numero).padStart(8,"0")}</td><td><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>abrirEdicion({tipo:"punto",id:x.id,codigo:x.codigo,descripcion:x.descripcion})} className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]">Editar</button><button type="button" onClick={()=>setConfirmacion({tipo:"punto",id:x.id,nombre:`${x.codigo} - ${x.descripcion}`})} className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700">Eliminar</button></div></td></tr>)}</tbody></TablaOrdenable></div>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Cajas</h2>
        <form onSubmit={crearCaja} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">Punto de venta<select required className="mt-1 w-full rounded-xl border p-3" value={puntoCaja} onChange={e=>setPuntoCaja(e.target.value)}><option value="">Seleccionar</option>{puntos.filter(x=>x.activo).map(x=><option key={x.id} value={x.id}>{x.codigo} - {x.descripcion}</option>)}</select></label>
          <label>Código<input required className="mt-1 w-full rounded-xl border p-3" value={codigoCaja} onChange={e=>setCodigoCaja(e.target.value)}/></label>
          <label>Descripción<input required className="mt-1 w-full rounded-xl border p-3" value={descripcionCaja} onChange={e=>setDescripcionCaja(e.target.value)}/></label>
          <button className="sm:col-span-2 justify-self-end rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white">Crear caja</button>
        </form>
        <div className="mt-5 overflow-x-auto"><TablaOrdenable className="w-full text-left text-sm"><thead><tr><th>Caja</th><th>Punto</th><th>Acciones</th></tr></thead><tbody>{cajas.map(x=><tr className="border-t" key={x.id}><td className="py-3"><b>{x.codigo}</b><small className="block">{x.descripcion}</small></td><td>{puntos.find(p=>p.id===x.punto_venta_id)?.codigo}</td><td><div className="flex flex-wrap gap-2"><button type="button" onClick={()=>abrirEdicion({tipo:"caja",id:x.id,codigo:x.codigo,descripcion:x.descripcion})} className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]">Editar</button><button type="button" onClick={()=>setConfirmacion({tipo:"caja",id:x.id,nombre:`${x.codigo} - ${x.descripcion}`})} className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700">Eliminar</button></div></td></tr>)}</tbody></TablaOrdenable></div>
      </section>
    </div>
    {edicion&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-edicion-pos"><form onSubmit={guardarDescripcion} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">{edicion.tipo === "punto" ? "Punto de venta" : "Caja"} {edicion.codigo}</p><h2 id="titulo-edicion-pos" className="text-2xl font-semibold">Modificar descripción</h2></div><button type="button" onClick={()=>setEdicion(null)} className="rounded-lg border px-3 py-2">×</button></div><label className="mt-5 block font-semibold">Descripción<input autoFocus required minLength={2} maxLength={120} className="mt-1 w-full rounded-xl border p-3" value={descripcionEditada} onChange={e=>setDescripcionEditada(e.target.value)}/></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={()=>setEdicion(null)} className="rounded-xl border px-4 py-2">Cancelar</button><button disabled={procesando} className="rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white disabled:opacity-40">{procesando?"Guardando...":"Guardar"}</button></div></form></div>}
    {confirmacion&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="alertdialog" aria-modal="true" aria-labelledby="titulo-eliminar-pos" aria-describedby="detalle-eliminar-pos"><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-widest text-red-700">Confirmar eliminación</p><h2 id="titulo-eliminar-pos" className="mt-1 text-2xl font-semibold">¿Eliminar {confirmacion.tipo === "punto" ? "el punto de venta" : "la caja"}?</h2><p id="detalle-eliminar-pos" className="mt-3 text-sm text-[var(--texto-suave)]"><b className="text-[var(--texto)]">{confirmacion.nombre}</b><br/>La operación sólo se realizará si no tiene ventas, aperturas, cierres ni otro historial asociado.</p>{confirmacion.tipo==="punto"&&<p className="mt-3 rounded-xl bg-[var(--fondo)] p-3 text-sm">Las cajas nuevas y sin historial pertenecientes a este punto también serán eliminadas.</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={procesando} onClick={()=>setConfirmacion(null)} className="rounded-xl border px-4 py-2">Cancelar</button><button type="button" disabled={procesando} onClick={()=>void eliminarConfirmado()} className="rounded-xl bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-40">{procesando?"Eliminando...":"Eliminar"}</button></div></section></div>}
  </main>;
}
