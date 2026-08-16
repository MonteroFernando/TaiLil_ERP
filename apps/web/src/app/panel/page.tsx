"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
type Tarjeta = { codigo:string; titulo:string; descripcion:string; modulo:string; tipo:"actividad"|"cantidad"|"dinero"|"estado"; disponible:boolean; valor:string|number|null };

export default function Panel() {
  const router=useRouter(); const [tarjetas,setTarjetas]=useState<Tarjeta[]>([]); const [cargando,setCargando]=useState(true);
  useEffect(()=>{async function cargar(){const r=await fetch(`${apiUrl}/dashboard`,{credentials:"include"});if(!r.ok){router.replace("/acceso");return}const d=await r.json();setTarjetas(d.tarjetas);setCargando(false)}void cargar()},[router]);
  if(cargando)return <main className="grid min-h-screen place-items-center text-sm text-[var(--texto-suave)]">Preparando tu resumen...</main>;
  return <main className="min-h-screen p-6 sm:p-8"><section><header className="border-b border-[var(--borde)] pb-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--marca)]">Resumen principal</p><h1 className="mt-1 text-2xl font-semibold">Dashboard</h1><p className="mt-2 text-sm text-[var(--texto-suave)]">La informacion visible depende de tus permisos y actividad.</p></header><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{tarjetas.map(t=><article className={`${t.codigo==="ultimos_movimientos"?"md:col-span-2 xl:col-span-4":""} rounded-2xl border border-[var(--borde)] bg-white p-5`} key={t.codigo}><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--texto-suave)]">{t.modulo}</p><h2 className="mt-1 text-base font-semibold">{t.titulo}</h2></div><span className="rounded-full bg-[var(--marca-clara)] px-2 py-1 text-[10px] font-semibold text-[var(--marca)]">{t.disponible?"ACTUALIZADO":"PREPARADO"}</span></div>{t.disponible?<p className="mt-5 text-2xl font-semibold">{t.valor}</p>:<p className="mt-5 text-sm text-[var(--texto-suave)]">{t.descripcion}. Se completara cuando el modulo comience a registrar movimientos.</p>}</article>)}</div></section></main>;
}
