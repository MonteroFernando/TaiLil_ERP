"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import BuscadorArticulo, { ArticuloBuscado } from "@/components/BuscadorArticulo";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type Almacen = { id: string; codigo: string; descripcion: string; activo: boolean; es_predeterminado: boolean };
type Socio = { id: string; codigo: string; razon_social: string; numero_documento: string; activo: boolean };
type Linea = ArticuloBuscado & { cantidad: number; precio: number; precioAnterior: number | null; lista: string; total: number };
type Pago = { medio: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "OTRO"; importe: string; referencia: string };
type Apertura={id:string;caja_id:string;caja_codigo:string;caja_descripcion:string;punto_venta_id:string;punto_venta_codigo:string;usuario_nombre:string;efectivo_inicial:string;fecha_apertura:string};
type Caja={id:string;punto_venta_id:string;codigo:string;descripcion:string;activo:boolean};
type Punto={id:string;codigo:string;almacen_id:string;activo:boolean};
type LineaVenta={articulo_id:string;articulo_codigo:string;articulo_descripcion:string;es_pesable:boolean;lista_nombre:string;cantidad_base:string;precio_unitario_bruto:string;precio_anterior_bruto:string|null;total_bruto:string};
type Venta = { id:string;numero:number|null;numero_completo:string|null;cliente_id:string;cliente_nombre:string;almacen_id:string;estado:string;cobro_numero:number|null;total_bruto:string;saldo_pendiente:string;lineas:LineaVenta[] };

export default function PuntoVenta() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacen, setAlmacen] = useState("");
  const [cliente, setCliente] = useState<Socio | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [errorCobro,setErrorCobro]=useState("");
  const [apertura,setApertura]=useState<Apertura|null>(null),[aperturas,setAperturas]=useState<Apertura[]>([]),[cajas,setCajas]=useState<Caja[]>([]),[puntos,setPuntos]=useState<Punto[]>([]);
  const [cajaAbrir,setCajaAbrir]=useState(""),[efectivoInicial,setEfectivoInicial]=useState("0"),[borradores,setBorradores]=useState<Venta[]>([]),[verBorradores,setVerBorradores]=useState(false),[ultimaVenta,setUltimaVenta]=useState<Venta|null>(null);
  const borradorIdRef=useRef<string|null>(null);
  const guardadoEnCursoRef=useRef<Promise<string|null>|null>(null);
  const confirmandoRef=useRef(false);
  const buscadorArticuloRef = useRef<HTMLInputElement>(null);
  const cantidadesRef = useRef<Record<string, HTMLInputElement | null>>({});
  // Se deriva siempre de cantidad por precio para mantener sincronizados
  // multiplicadores, total visible y cobro.
  const total = lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precio, 0);
  const pagado = pagos.reduce((suma, pago) => suma + Number(pago.importe || 0), 0);

  useEffect(() => {
    async function cargar() {
      const [respuesta,respuestaAperturas,respuestaCajas,respuestaPuntos]=await Promise.all([fetch(`${apiUrl}/articulos/almacenes`,{credentials:"include"}),fetch(`${apiUrl}/articulos/pos/cajas/abiertas`,{credentials:"include"}),fetch(`${apiUrl}/articulos/pos/configuracion/cajas`,{credentials:"include"}),fetch(`${apiUrl}/articulos/pos/configuracion/puntos-venta`,{credentials:"include"})]);
      if (!respuesta.ok) return;
      const datos: Almacen[] = await respuesta.json();
      setAlmacenes(datos);
      const datosAperturas:Apertura[]=respuestaAperturas.ok?await respuestaAperturas.json():[];
      const datosCajas:Caja[]=respuestaCajas.ok?await respuestaCajas.json():[];
      const datosPuntos:Punto[]=respuestaPuntos.ok?await respuestaPuntos.json():[];
      setAperturas(datosAperturas);setCajas(datosCajas);setPuntos(datosPuntos);
      const activa=datosAperturas[0]??null;setApertura(activa);
      setAlmacen(datosPuntos.find(x=>x.id===activa?.punto_venta_id)?.almacen_id??datos.find((x) => x.es_predeterminado && x.activo)?.id??"");
    }
    void cargar();
  }, []);

  const persistirBorrador=useCallback(async():Promise<string|null>=>{if(!apertura||!lineas.length)return null;try{const r=await fetch(`${apiUrl}/articulos/pos/borradores`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({borrador_id:borradorIdRef.current,apertura_caja_id:apertura.id,cliente_id:cliente?.id??null,almacen_id:almacen,lineas:lineas.map(x=>({articulo_id:x.id,cantidad_base:x.cantidad})),pagos:[]})});if(!r.ok)return null;const d:Venta=await r.json();borradorIdRef.current=d.id;return d.id}catch{return null}},[apertura,cliente,almacen,lineas]);
  useEffect(()=>{
    if(!apertura||!lineas.length)return;
    const temporizador=window.setTimeout(async()=>{if(confirmandoRef.current)return;const promesa=persistirBorrador();guardadoEnCursoRef.current=promesa;await promesa;if(guardadoEnCursoRef.current===promesa)guardadoEnCursoRef.current=null},450);
    return()=>window.clearTimeout(temporizador)
  },[apertura,lineas.length,persistirBorrador]);

  async function abrirCaja(e:FormEvent){e.preventDefault();const r=await fetch(`${apiUrl}/articulos/pos/cajas/abrir`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({caja_id:cajaAbrir,efectivo_inicial:Number(efectivoInicial)})});const d=await r.json();if(!r.ok){setMensaje(d.detail??"No se pudo abrir la caja");return}setApertura(d);setAperturas([...aperturas,d]);setAlmacen(puntos.find(x=>x.id===d.punto_venta_id)?.almacen_id??"")}
  async function cargarBorradores(){if(!apertura)return;const r=await fetch(`${apiUrl}/articulos/pos/borradores?apertura_caja_id=${apertura.id}`,{credentials:"include"});if(r.ok){setBorradores(await r.json());setVerBorradores(true)}}
  function recuperarBorrador(b:Venta){borradorIdRef.current=b.id;setAlmacen(b.almacen_id);setCliente({id:b.cliente_id,codigo:"",razon_social:b.cliente_nombre,numero_documento:"",activo:true});setLineas(b.lineas.map(x=>({id:x.articulo_id,codigo:x.articulo_codigo,descripcion:x.articulo_descripcion,habilitado_inventario:true,es_pesable:x.es_pesable,cantidad:Number(x.cantidad_base),precio:Number(x.precio_unitario_bruto),precioAnterior:x.precio_anterior_bruto?Number(x.precio_anterior_bruto):null,lista:x.lista_nombre,total:Number(x.total_bruto)})));setVerBorradores(false)}
  async function borrarBorrador(id:string){const r=await fetch(`${apiUrl}/articulos/pos/borradores/${id}`,{method:"DELETE",credentials:"include"});if(r.ok){if(borradorIdRef.current===id){borradorIdRef.current=null;setLineas([])}await cargarBorradores()}}

  useEffect(() => {
    function accesoRapido(e: globalThis.KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        setCobroAbierto(false);
        window.setTimeout(() => buscadorArticuloRef.current?.focus(), 0);
      } else if (e.key === "Escape" && cobroAbierto) {
        e.preventDefault();
        setCobroAbierto(false);
      } else if (e.key === "F10" && !cobroAbierto && lineas.length > 0) {
        e.preventDefault();
        setPagos((actuales) => actuales.length === 1 && !actuales[0].importe
          ? [{ ...actuales[0], importe: total.toFixed(2) }]
          : actuales);
        setErrorCobro("");setCobroAbierto(true);
      }
    }
    window.addEventListener("keydown", accesoRapido);
    return () => window.removeEventListener("keydown", accesoRapido);
  }, [cobroAbierto, lineas.length, total]);

  async function cotizar(articulo: ArticuloBuscado, cantidad: number) {
    const respuestaLista = await fetch(`${apiUrl}/articulos/precios/articulos/${articulo.id}/resolver-lista?cantidad_base=${cantidad}`, { credentials: "include" });
    const lista = await respuestaLista.json();
    if (!respuestaLista.ok) throw new Error(lista.detail ?? "No se pudo resolver la lista");
    const respuesta = await fetch(`${apiUrl}/articulos/precios/listas/${lista.id}/articulos?articulo_id=${articulo.id}`, { credentials: "include" });
    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.length) throw new Error(datos.detail ?? "No se pudo obtener el precio");
    const precioAplicado = Number(datos[0].precio_venta_bruto);
    let precioAnterior: number | null = null;
    if (lista.nombre !== "GENERAL") {
      const respuestaListas = await fetch(`${apiUrl}/articulos/precios/listas`, { credentials: "include" });
      const listas = await respuestaListas.json();
      const general = respuestaListas.ok ? listas.find((x: { nombre: string; activa: boolean }) => x.nombre === "GENERAL" && x.activa) : null;
      if (general) {
        const respuestaGeneral = await fetch(`${apiUrl}/articulos/precios/listas/${general.id}/articulos?articulo_id=${articulo.id}`, { credentials: "include" });
        const precioGeneral = await respuestaGeneral.json();
        if (respuestaGeneral.ok && precioGeneral.length && Number(precioGeneral[0].precio_venta_bruto) > precioAplicado) precioAnterior = Number(precioGeneral[0].precio_venta_bruto);
      }
    }
    return { precio: precioAplicado, precioAnterior, lista: lista.nombre };
  }

  async function agregarArticulo(articulo: ArticuloBuscado | null, cantidadAgregar = 1) {
    if (!articulo) return;
    if (!Number.isFinite(cantidadAgregar) || cantidadAgregar <= 0) {
      setMensaje("El multiplicador debe ser mayor que cero");
      return;
    }
    if (!articulo.es_pesable && !Number.isInteger(cantidadAgregar)) {
      setMensaje("Solo los productos pesables permiten multiplicadores decimales");
      return;
    }
    setMensaje("");
    try {
      const existente = lineas.find((x) => x.id === articulo.id);
      const cantidad = (existente?.cantidad ?? 0) + cantidadAgregar;
      const precio = await cotizar(articulo, cantidad);
      const siguiente = existente
        ? lineas.map((x) => x.id === articulo.id ? { ...x, cantidad, ...precio, total: cantidad * precio.precio } : x)
        : [...lineas, { ...articulo, cantidad, ...precio, total: cantidad * precio.precio }];
      setLineas(siguiente);
      window.setTimeout(() => buscadorArticuloRef.current?.focus(), 0);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo agregar el producto");
    }
  }

  async function cambiarCantidad(id: string, cantidad: number) {
    if (cantidad <= 0) {
      setLineas(lineas.filter((x) => x.id !== id));
      return;
    }
    const linea = lineas.find((x) => x.id === id);
    if (!linea) return;
    try {
      const precio = await cotizar(linea, cantidad);
      setLineas(lineas.map((x) => x.id === id ? { ...x, cantidad, ...precio, total: cantidad * precio.precio } : x));
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo recalcular el precio");
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!apertura || !almacen || !lineas.length) return;
    confirmandoRef.current=true;
    setProcesando(true);
    setErrorCobro("");
    setMensaje("");
    const pagosValidos = pagos
      .filter((x) => Number(x.importe) > 0)
      .map((x) => ({ ...x, importe: Math.round(Number(x.importe) * 100) / 100 }));
    try {
    if(guardadoEnCursoRef.current)await guardadoEnCursoRef.current;
    const borradorConfirmar=await persistirBorrador();
    if(!borradorConfirmar){setProcesando(false);confirmandoRef.current=false;setErrorCobro("No se pudo guardar el borrador antes de confirmar");return}
    const respuesta = await fetch(`${apiUrl}/articulos/pos/ventas`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: cliente?.id ?? null,
        borrador_id: borradorConfirmar,
        apertura_caja_id: apertura.id,
        almacen_id: almacen,
        lineas: lineas.map((x) => ({ articulo_id: x.id, cantidad_base: x.cantidad })),
        pagos: pagosValidos.map((x) => ({ ...x, referencia: x.referencia || null })),
      }),
    });
    const datos = await respuesta.json();
    setProcesando(false);
    if (!respuesta.ok) {
      confirmandoRef.current=false;
      setErrorCobro(datos.detail ?? "No se pudo confirmar la venta");
      return;
    }
    const venta: Venta = datos;
    setMensaje(`PRESUPUESTO ${venta.numero_completo} confirmado · Saldo pendiente $${Number(venta.saldo_pendiente).toFixed(2)}`);
    setUltimaVenta(venta);
    borradorIdRef.current=null;
    confirmandoRef.current=false;
    setLineas([]);
    setPagos([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
    setCobroAbierto(false);
    } catch (error) {
      setErrorCobro(
        error instanceof TypeError
          ? "No se pudo conectar con el servidor. Verifique que la API siga iniciada e intente nuevamente."
          : error instanceof Error
            ? error.message
            : "No se pudo confirmar la venta",
      );
    } finally {
      setProcesando(false);
      confirmandoRef.current=false;
    }
  }

  if(!apertura)return <main className="listas-precios-pagina p-6 sm:p-9"><header className="border-b pb-5"><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas</p><h1 className="text-3xl font-semibold">Abrir caja</h1><p className="text-sm text-[var(--texto-suave)]">Debe abrir una caja antes de registrar presupuestos.</p></header>{mensaje&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{mensaje}</p>}<form onSubmit={abrirCaja} className="mt-5 grid max-w-2xl gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="sm:col-span-2">Caja<select required className="mt-1 w-full rounded-xl border p-3" value={cajaAbrir} onChange={e=>setCajaAbrir(e.target.value)}><option value="">Seleccionar caja</option>{cajas.filter(x=>x.activo).map(x=><option key={x.id} value={x.id}>{puntos.find(p=>p.id===x.punto_venta_id)?.codigo} · {x.codigo} - {x.descripcion}</option>)}</select></label><label className="sm:col-span-2">Efectivo inicial<input required min="0" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-3" value={efectivoInicial} onChange={e=>setEfectivoInicial(e.target.value)}/></label><button className="sm:col-span-2 justify-self-end rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white">Abrir caja</button></form></main>;

  return (
    <main className="listas-precios-pagina p-6 sm:p-9">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas</p>
        <h1 className="text-3xl font-semibold">Punto de venta</h1>
        <p className="text-sm text-[var(--texto-suave)]">PRESUPUESTO · {apertura.punto_venta_codigo} · {apertura.caja_codigo} · Caja de {apertura.usuario_nombre}</p></div>
        <div className="flex flex-wrap items-end gap-2">{aperturas.length>1&&<label className="text-xs">Caja abierta<select className="ml-2 rounded-lg border p-2" value={apertura.id} onChange={e=>{const elegida=aperturas.find(x=>x.id===e.target.value);if(elegida){setApertura(elegida);setAlmacen(puntos.find(p=>p.id===elegida.punto_venta_id)?.almacen_id??"");borradorIdRef.current=null;setLineas([])}}}>{aperturas.map(x=><option key={x.id} value={x.id}>{x.punto_venta_codigo} · {x.caja_codigo} · {x.usuario_nombre}</option>)}</select></label>}<button type="button" onClick={()=>void cargarBorradores()} className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)]">Recuperar borradores</button></div>
      </header>
      <section className="sticky top-0 z-30 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-3 shadow-sm">
        <div><small className="font-semibold uppercase tracking-wider text-[var(--texto-suave)]">Total de la venta</small><b className="block text-3xl text-[var(--marca)]">${total.toFixed(2)}</b></div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--texto-suave)]">Acceso rapido disponible desde cualquier campo</span>
          <button type="button" disabled={!lineas.length} onClick={() => { if (pagos.length === 1 && !pagos[0].importe) setPagos([{ ...pagos[0], importe: total.toFixed(2) }]); setErrorCobro("");setCobroAbierto(true); }} className="rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40">Cobrar <kbd className="ml-2 rounded border border-white/50 px-2 py-1 text-xs">F10</kbd></button>
        </div>
      </section>
      {mensaje && <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">{mensaje}</p>}
      {ultimaVenta&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 text-sm"><b>{ultimaVenta.numero_completo}</b><div className="flex gap-2"><button onClick={()=>window.open(`${apiUrl}/articulos/pos/ventas/${ultimaVenta.id}/imprimir?formato=ticket`,"_blank")} className="rounded-lg border px-3 py-2">Ticket 80 mm</button><button onClick={()=>window.open(`${apiUrl}/articulos/pos/ventas/${ultimaVenta.id}/imprimir?formato=a4`,"_blank")} className="rounded-lg border px-3 py-2">Imprimir A4</button></div></div>}
      <form onSubmit={confirmar} className="mt-5 space-y-5">
        <section className="grid gap-4 rounded-2xl border bg-white p-5 lg:grid-cols-2">
          <label className="text-sm font-semibold">Cliente <small className="font-normal text-[var(--texto-suave)]">(por defecto: CONSUMIDOR FINAL)</small><BuscadorCliente seleccionar={setCliente} /></label>
          <label className="text-sm font-semibold">Almacen del punto de venta<select disabled className="mt-1 w-full rounded-xl border bg-gray-100 p-3" value={almacen} onChange={(e) => setAlmacen(e.target.value)} required><option value="">Seleccionar</option>{almacenes.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.codigo} - {x.descripcion}</option>)}</select></label>
          <label className="text-sm font-semibold lg:col-span-2"><span className="flex items-center justify-between"><span>Agregar producto por codigo, descripcion o codigo de barras</span><kbd className="rounded border bg-[var(--fondo)] px-2 py-1 text-xs">F2</kbd></span><BuscadorArticulo soloInventario={false} referenciaEntrada={buscadorArticuloRef} limpiarAlSeleccionar seleccionar={()=>{}} seleccionarConCantidad={(x,cantidad)=>void agregarArticulo(x,cantidad)} /><small className="mt-1 block text-[var(--texto-suave)]">El foco permanece aquí para continuar cargando. Use Tab para pasar a cantidad. Multiplicador: 12*código.</small></label>
        </section>
        <section className="overflow-x-auto rounded-2xl border bg-white p-5">
          <table className="min-w-[850px] w-full text-left text-sm"><thead><tr className="text-xs uppercase text-[var(--texto-suave)]"><th className="p-3">Articulo</th><th>Cantidad base</th><th>Lista</th><th>Precio bruto</th><th>Total</th><th></th></tr></thead><tbody>{lineas.map((x) => <tr key={x.id} className="border-t"><td className="p-3"><b>{x.codigo}</b><small className="block">{x.descripcion}</small>{x.es_pesable&&<small className="font-semibold text-[var(--marca)]">PESABLE</small>}</td><td><input ref={(elemento)=>{cantidadesRef.current[x.id]=elemento}} className="w-28 rounded-lg border p-2" type="number" min={x.es_pesable?"0.001":"1"} step={x.es_pesable?"0.001":"1"} value={x.cantidad} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();buscadorArticuloRef.current?.focus()}}} onChange={(e) => void cambiarCantidad(x.id, Number(e.target.value))} /></td><td>{x.lista}{x.precioAnterior!==null&&<span className="ml-2 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">DESCUENTO</span>}</td><td>{x.precioAnterior!==null&&<span className="mr-2 text-[var(--texto-suave)] line-through">${x.precioAnterior.toFixed(2)}</span>}<b className={x.precioAnterior!==null?"text-green-700":""}>${x.precio.toFixed(2)}</b></td><td className="font-semibold">${x.total.toFixed(2)}</td><td><button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-red-700" onClick={() => setLineas(lineas.filter((l) => l.id !== x.id))}>Quitar</button></td></tr>)}</tbody></table>
          {!lineas.length && <p className="p-6 text-center text-sm text-[var(--texto-suave)]">Agregue productos para iniciar la venta.</p>}
        </section>
        {cobroAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Punto de venta</p><h2 id="titulo-cobro" className="text-2xl font-semibold">Cobrar venta</h2></div><button type="button" aria-label="Cerrar cobro" onClick={() => setCobroAbierto(false)} className="rounded-lg border px-3 py-2 font-semibold">×</button></div>
          <div className="my-5 grid grid-cols-3 gap-3 rounded-xl bg-[var(--fondo)] p-4 text-right"><div><small>Total</small><b className="block text-2xl">${total.toFixed(2)}</b></div><div><small>Pagado</small><b className="block text-2xl">${pagado.toFixed(2)}</b></div><div><small>Saldo</small><b className="block text-2xl text-[var(--marca)]">${Math.max(total - pagado, 0).toFixed(2)}</b></div></div>
          {errorCobro&&<p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{errorCobro}</p>}
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Cobro</h2><button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold text-[var(--marca)]" onClick={() => setPagos([...pagos, { medio: "TARJETA", importe: "", referencia: "" }])}>Agregar medio</button></div>
          <div className="space-y-2">{pagos.map((pago, indice) => <div key={indice} className="grid gap-2 md:grid-cols-[180px_160px_1fr_auto]"><select className="rounded-xl border p-3" value={pago.medio} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, medio: e.target.value as Pago["medio"] } : x))}><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>OTRO</option></select><input autoFocus={indice === 0} className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Importe" value={pago.importe} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, importe: e.target.value } : x))} /><input className="rounded-xl border p-3" placeholder="Referencia opcional" value={pago.referencia} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, referencia: e.target.value } : x))} /><button type="button" className="rounded-lg border px-3" onClick={() => setPagos(pagos.filter((_, i) => i !== indice))}>Quitar</button></div>)}</div>
          <div className="mt-5 flex flex-wrap items-end justify-end gap-6 border-t pt-4 text-right"><div><small>Total bruto</small><b className="block text-xl">${total.toFixed(2)}</b></div><div><small>Pagado</small><b className="block text-xl">${pagado.toFixed(2)}</b></div><div><small>Saldo / cuenta corriente</small><b className="block text-xl">${Math.max(total - pagado, 0).toFixed(2)}</b></div><button disabled={procesando || !almacen || !lineas.length || pagado > total} className="rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40">{procesando ? "Confirmando..." : "Confirmar venta"}</button></div>
          <p className="mt-3 text-xs text-[var(--texto-suave)]">Si queda saldo pendiente, el cliente debe tener cuenta corriente activa y limites disponibles. Presione ESC para cerrar.</p>
        </section></div>}
      </form>
      {verBorradores&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><section className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6"><div className="flex justify-between border-b pb-4"><h2 className="text-xl font-semibold">Borradores de caja</h2><button onClick={()=>setVerBorradores(false)} className="rounded-lg border px-3 py-2">×</button></div><table className="mt-4 w-full text-left text-sm"><thead><tr><th>Cliente</th><th>Productos</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{borradores.map(b=><tr className="border-t" key={b.id}><td className="py-3">{b.cliente_nombre}</td><td>{b.lineas.length}</td><td>${Number(b.total_bruto).toFixed(2)}</td><td className="flex gap-2 py-2"><button onClick={()=>recuperarBorrador(b)} className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]">Recuperar</button><button onClick={()=>void borrarBorrador(b.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Eliminar</button></td></tr>)}</tbody></table>{!borradores.length&&<p className="p-8 text-center text-[var(--texto-suave)]">No hay borradores pendientes.</p>}</section></div>}
    </main>
  );
}

function BuscadorCliente({ seleccionar }: { seleccionar: (socio: Socio | null) => void }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Socio[]>([]);
  const [indice, setIndice] = useState(-1);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!texto.trim()) return;
    const temporizador = window.setTimeout(async () => {
      const r = await fetch(`${apiUrl}/articulos/socios?rol=cliente&buscar=${encodeURIComponent(texto)}`, { credentials: "include" });
      if (!r.ok) return;
      const datos: Socio[] = (await r.json()).filter((x: Socio) => x.activo).slice(0, 12);
      setResultados(datos); setIndice(datos.length ? 0 : -1); setAbierto(true);
    }, 180);
    return () => window.clearTimeout(temporizador);
  }, [texto]);
  useEffect(() => { const cerrar = (e: MouseEvent) => { if (!contenedor.current?.contains(e.target as Node)) setAbierto(false); }; document.addEventListener("mousedown", cerrar); return () => document.removeEventListener("mousedown", cerrar); }, []);
  function elegir(socio: Socio) { setTexto(`${socio.razon_social} - ${socio.numero_documento}`); seleccionar(socio); setAbierto(false); }
  function teclado(e: KeyboardEvent<HTMLInputElement>) { if (!abierto) return; if (e.key === "ArrowDown") { e.preventDefault(); setIndice(Math.min(indice + 1, resultados.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setIndice(Math.max(indice - 1, 0)); } else if (e.key === "Enter" && indice >= 0) { e.preventDefault(); elegir(resultados[indice]); } }
  return <div ref={contenedor} className="relative"><input className="mt-1 w-full rounded-xl border p-3" value={texto} placeholder="Nombre, DNI o CUIT" autoComplete="off" onKeyDown={teclado} onChange={(e) => { setTexto(e.target.value); seleccionar(null); if (!e.target.value) setAbierto(false); }} />{abierto && <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{resultados.map((x, i) => <button type="button" key={x.id} onClick={() => elegir(x)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${i === indice ? "bg-[var(--marca-clara)]" : "hover:bg-[var(--fondo)]"}`}><b>{x.razon_social}</b><small className="block">{x.numero_documento}</small></button>)}</div>}</div>;
}
