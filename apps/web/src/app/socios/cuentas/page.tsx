"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
type Socio = { id:string; codigo:string; razon_social:string; cuenta_padre_id:string|null };

export default function CuentasSocios() {
  const [socios,setSocios]=useState<Socio[]>([]);
  const [socioId,setSocioId]=useState("");
  const [padreId,setPadreId]=useState("");
  const [mensaje,setMensaje]=useState("");
  const cargar=useCallback(async()=>{const r=await fetch(`${apiUrl}/articulos/socios`,{credentials:"include"});if(!r.ok)return [] as Socio[];const datos:Socio[]=await r.json();setSocios(datos);return datos},[]);
  useEffect(()=>{const t=window.setTimeout(async()=>{const datos=await cargar();const id=new URLSearchParams(window.location.search).get("socio");if(id){setSocioId(id);setPadreId(datos.find(x=>x.id===id)?.cuenta_padre_id??"")}},0);return()=>window.clearTimeout(t)},[cargar]);
  function elegir(id:string){setSocioId(id);setPadreId(socios.find(x=>x.id===id)?.cuenta_padre_id??"");setMensaje("")}
  async function guardar(e:FormEvent){e.preventDefault();const r=await fetch(`${apiUrl}/articulos/socios/${socioId}/cuenta-padre`,{method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({cuenta_padre_id:padreId||null})});const d=await r.json();setMensaje(r.ok?"CUENTA PADRE ACTUALIZADA":d.detail??"NO SE PUDO GUARDAR");if(r.ok)await cargar()}
  return <main className="min-h-screen p-6 sm:p-8"><section><div className="max-w-xl"><header className="border-b border-[var(--borde)] pb-4"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--marca)]">Socios comerciales</p><h1 className="mt-1 text-xl font-semibold">Cuenta agrupadora</h1></header>{mensaje&&<p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">{mensaje}</p>}<form className="mt-5 space-y-4 rounded-2xl border border-[var(--borde)] bg-white p-5" onSubmit={guardar}><label className="block text-sm">Socio<select className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2.5" value={socioId} onChange={e=>elegir(e.target.value)} required><option value="">SELECCIONAR</option>{socios.map(x=><option value={x.id} key={x.id}>{x.codigo} · {x.razon_social}</option>)}</select></label><label className="block text-sm">Cuenta padre<select className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2.5" value={padreId} onChange={e=>setPadreId(e.target.value)}><option value="">SIN CUENTA PADRE</option>{socios.filter(x=>x.id!==socioId).map(x=><option value={x.id} key={x.id}>{x.codigo} · {x.razon_social}</option>)}</select></label><button className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Guardar</button></form></div></section></main>;
}
