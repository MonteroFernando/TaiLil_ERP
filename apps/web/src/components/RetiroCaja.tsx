"use client";

import { apiFetch } from "@/api";
import { FormEvent, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Proveedor = { id:string;codigo?:string;razon_social:string;numero_documento?:string;es_proveedor:boolean };

export default function RetiroCaja({aperturaId,proveedores,registrado}:{aperturaId:string;proveedores:Proveedor[];registrado:(mensaje:string)=>Promise<void>}) {
  const [destino,setDestino]=useState<"GASTO_DIRECTO"|"PAGO_PROVEEDOR">("GASTO_DIRECTO");
  const [importe,setImporte]=useState("");
  const [medio,setMedio]=useState("EFECTIVO");
  const [concepto,setConcepto]=useState("");
  const [referencia,setReferencia]=useState("");
  const [buscar,setBuscar]=useState("");
  const [proveedorId,setProveedorId]=useState("");
  const [procesando,setProcesando]=useState(false);
  const [error,setError]=useState("");
  const filtrados=useMemo(()=>proveedores.filter(x=>`${x.codigo??""} ${x.razon_social} ${x.numero_documento??""}`.toLowerCase().includes(buscar.toLowerCase())).slice(0,8),[proveedores,buscar]);

  async function guardar(evento:FormEvent){
    evento.preventDefault();setError("");setProcesando(true);
    try{
      const respuesta=await apiFetch(`${apiUrl}/tesoreria/cajas/retiros`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({apertura_caja_id:aperturaId,destino,medio,importe:Number(importe),concepto,referencia:referencia||null,proveedor_id:proveedorId||null})});
      const datos=await respuesta.json().catch(()=>null);
      if(!respuesta.ok)throw new Error(datos?.detail??"No se pudo registrar el retiro");
      setImporte("");setConcepto("");setReferencia("");setBuscar("");setProveedorId("");
      await registrado(destino==="PAGO_PROVEEDOR"?`Pago a proveedor #${datos.numero} registrado; el saldo quedó disponible para conciliar.`:"Gasto directo registrado y descontado de la caja.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar el retiro")}finally{setProcesando(false)}
  }

  return <form onSubmit={guardar} className="rounded-2xl border border-[var(--marca)] bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Salida declarada</p><h2 className="font-semibold">Retirar dinero</h2><p className="mt-1 text-xs text-[var(--texto-suave)]">Clasifique la salida para que nunca quede como un egreso suelto.</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setDestino("GASTO_DIRECTO")} className={`rounded-xl border p-3 text-left text-sm ${destino==="GASTO_DIRECTO"?"border-[var(--marca)] bg-[var(--marca-clara)]":""}`}><b>Gasto directo</b><small className="block">Queda cerrado como gasto de caja.</small></button><button type="button" onClick={()=>setDestino("PAGO_PROVEEDOR")} className={`rounded-xl border p-3 text-left text-sm ${destino==="PAGO_PROVEEDOR"?"border-[var(--marca)] bg-[var(--marca-clara)]":""}`}><b>Pago a proveedor</b><small className="block">Puede conciliarse ahora o después.</small></button></div><div className="mt-3 grid grid-cols-2 gap-2"><input required type="number" min="0.01" step="0.01" value={importe} onChange={e=>setImporte(e.target.value)} placeholder="Importe" className="rounded-lg border p-2"/><select value={medio} onChange={e=>setMedio(e.target.value)} className="rounded-lg border p-2"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></div><input required minLength={3} maxLength={200} value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Concepto del gasto o pago" className="mt-2 w-full rounded-lg border p-2"/><input maxLength={120} value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Referencia o comprobante" className="mt-2 w-full rounded-lg border p-2"/><div className="relative mt-2"><input required={destino==="PAGO_PROVEEDOR"} value={buscar} onChange={e=>{setBuscar(e.target.value);setProveedorId("")}} placeholder={destino==="PAGO_PROVEEDOR"?"Buscar proveedor (obligatorio)":"Buscar proveedor (opcional)"} className="w-full rounded-lg border p-2"/>{buscar&&!proveedorId&&<div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{filtrados.map(x=><button type="button" key={x.id} onClick={()=>{setProveedorId(x.id);setBuscar(`${x.codigo??""} - ${x.razon_social}`)}} className="block w-full rounded-lg p-2 text-left text-sm hover:bg-[var(--fondo)]"><b>{x.razon_social}</b><small className="block">{x.codigo} · {x.numero_documento}</small></button>)}{!filtrados.length&&<p className="p-2 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}</div>}</div>{destino==="PAGO_PROVEEDOR"&&<p className="mt-2 rounded-lg bg-[var(--fondo)] p-2 text-xs">El retiro crea un pago del proveedor. Si no se aplica ahora, aparecerá en su cuenta como pago sin conciliar.</p>}{error&&<p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}<button disabled={procesando||!aperturaId||!importe||!concepto||(destino==="PAGO_PROVEEDOR"&&!proveedorId)} className="mt-3 w-full rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{procesando?"Registrando...":"Confirmar retiro"}</button></form>;
}
