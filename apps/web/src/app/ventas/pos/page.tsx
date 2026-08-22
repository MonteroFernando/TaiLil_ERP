"use client";

import { apiFetch } from "@/api";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import BuscadorArticulo, { ArticuloBuscado } from "@/components/BuscadorArticulo";
import SelectorModoImpresion, { useModoImpresion } from "@/components/SelectorModoImpresion";
import { formatearCantidad, formatearMoneda, redondearCantidad } from "@/formato";
import TablaOrdenable from "@/components/TablaOrdenable";
import ModalNotaCreditoPos from "@/components/ModalNotaCreditoPos";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const hoyLocal = () => {
  const ahora = new Date();
  const desplazamiento = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - desplazamiento).toISOString().slice(0, 10);
};

type Almacen = { id: string; codigo: string; descripcion: string; activo: boolean; es_predeterminado: boolean };
type Socio = { id: string; codigo: string; razon_social: string; numero_documento: string; activo: boolean };
type Linea = ArticuloBuscado & { cantidad: number; precio: number; precioAnterior: number | null; lista: string; total: number };
type Pago = { medio: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "OTRO" | "CUENTA_CORRIENTE"; importe: string; referencia: string };
type Apertura={id:string;caja_id:string;caja_codigo:string;caja_descripcion:string;punto_venta_id:string;punto_venta_codigo:string;usuario_nombre:string;efectivo_inicial:string;periodo_operativo:string;fecha_apertura:string};
type Caja={id:string;punto_venta_id:string;codigo:string;descripcion:string;activo:boolean};
type Punto={id:string;codigo:string;almacen_id:string;activo:boolean};
type LineaVenta={articulo_id:string;articulo_codigo:string;articulo_descripcion:string;es_pesable:boolean;lista_nombre:string;cantidad_base:string;precio_unitario_bruto:string;precio_anterior_bruto:string|null;total_bruto:string};
type Venta = { id:string;numero:number|null;numero_completo:string|null;cliente_id:string;cliente_nombre:string;almacen_id:string;estado:string;cobro_numero:number|null;total_bruto:string;saldo_pendiente:string;lineas:LineaVenta[] };
type PrecioVentaConsulta = { lista_id:string;lista_nombre:string;articulo_id:string;articulo_codigo:string;articulo_descripcion:string;precio_venta_bruto:string };
type CuentaCorrienteCliente = { socio_id:string;activa:boolean;limite_deuda:string;limite_periodo:string;temporalidad:"diaria"|"semanal"|"mensual";dias_maximos_deuda:number;deuda_actual:string;consumo_periodo:string;credito_disponible:string;saldo_favor:string;disponible_total:string;deuda_vencida:boolean };
type ControlCaja = { apertura_id:string;total_ventas:string;cantidad_ventas:number;total_cobros:string;total_pagos:string;total_ingresos:string;total_egresos:string;medios:{medio:string;esperado:string}[] };

export default function PuntoVenta() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacen, setAlmacen] = useState("");
  const [cliente, setCliente] = useState<Socio | null>(null);
  const [cuentaCliente, setCuentaCliente] = useState<CuentaCorrienteCliente | null>(null);
  const [cargandoCuentaCliente, setCargandoCuentaCliente] = useState(false);
  const [errorCuentaCliente, setErrorCuentaCliente] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [consultaPreciosAbierta, setConsultaPreciosAbierta] = useState(false);
  const [notaCreditoAbierta, setNotaCreditoAbierta] = useState(false);
  const { modo: modoImpresion, cambiar: cambiarModoImpresion } = useModoImpresion();
  const [errorCobro,setErrorCobro]=useState("");
  const [apertura,setApertura]=useState<Apertura|null>(null),[aperturas,setAperturas]=useState<Apertura[]>([]),[cajas,setCajas]=useState<Caja[]>([]),[puntos,setPuntos]=useState<Punto[]>([]);
  const [cajaAbrir,setCajaAbrir]=useState(""),[efectivoInicial,setEfectivoInicial]=useState("0"),[periodoOperativo,setPeriodoOperativo]=useState(hoyLocal),[borradores,setBorradores]=useState<Venta[]>([]),[verBorradores,setVerBorradores]=useState(false),[ultimaVenta,setUltimaVenta]=useState<Venta|null>(null);
  const [permisosUsuario,setPermisosUsuario]=useState<string[]>([]),[cierreAbierto,setCierreAbierto]=useState(false),[controlCierre,setControlCierre]=useState<ControlCaja|null>(null),[declaraciones,setDeclaraciones]=useState<Record<string,string>>({}),[observacionCierre,setObservacionCierre]=useState(""),[errorCierre,setErrorCierre]=useState("");
  const borradorIdRef=useRef<string|null>(null);
  const guardadoEnCursoRef=useRef<Promise<string|null>|null>(null);
  const confirmandoRef=useRef(false);
  const versionCuentaClienteRef=useRef(0);
  const buscadorArticuloRef = useRef<HTMLInputElement>(null);
  const cantidadesRef = useRef<Record<string, HTMLInputElement | null>>({});
  // Se deriva siempre de cantidad por precio para mantener sincronizados
  // multiplicadores, total visible y cobro.
  const total = lineas.reduce((suma, linea) => suma + linea.cantidad * linea.precio, 0);
  const pagado = pagos
    .filter((pago) => pago.medio !== "CUENTA_CORRIENTE")
    .reduce((suma, pago) => suma + Number(pago.importe || 0), 0);
  const importeCuentaCorriente = pagos
    .filter((pago) => pago.medio === "CUENTA_CORRIENTE")
    .reduce((suma, pago) => suma + Number(pago.importe || 0), 0);
  const cantidadCuentasCorrientes = pagos.filter((pago) => pago.medio === "CUENTA_CORRIENTE").length;
  const saldoFavorDisponible = cliente ? Number(cuentaCliente?.saldo_favor ?? 0) : 0;
  const saldoFavorAplicado = Math.min(saldoFavorDisponible, Math.max(total - pagado, 0));
  const saldoCuentaCorrienteRequerido = Math.max(total - pagado - saldoFavorAplicado, 0);
  const diferenciaCobro = total - pagado - saldoFavorAplicado - importeCuentaCorriente;
  const cobroCoincide = Math.abs(diferenciaCobro) < 0.005;
  const cuentaCorrienteValida = importeCuentaCorriente <= 0 || (
    Boolean(cliente) &&
    Boolean(cuentaCliente?.activa) &&
    !cuentaCliente?.deuda_vencida &&
    !cargandoCuentaCliente &&
    !errorCuentaCliente &&
    importeCuentaCorriente <= Number(cuentaCliente?.credito_disponible ?? 0) + 0.001
  );

  const cargarCuentaCliente = useCallback(async (socio: Socio | null) => {
    const version = ++versionCuentaClienteRef.current;
    setCuentaCliente(null);
    setErrorCuentaCliente("");
    if (!socio) {
      setCargandoCuentaCliente(false);
      return;
    }
    setCargandoCuentaCliente(true);
    try {
      const respuesta = await apiFetch(
        `${apiUrl}/articulos/socios/${socio.id}/cuenta-corriente-ventas`,
        { credentials: "include" },
      );
      const datos = await respuesta.json().catch(() => null);
      if (version !== versionCuentaClienteRef.current) return;
      if (!respuesta.ok) throw new Error(datos?.detail ?? "No se pudo consultar la cuenta corriente");
      setCuentaCliente(datos);
    } catch (error) {
      if (version !== versionCuentaClienteRef.current) return;
      setErrorCuentaCliente(error instanceof Error ? error.message : "No se pudo consultar la cuenta corriente");
    } finally {
      if (version === versionCuentaClienteRef.current) setCargandoCuentaCliente(false);
    }
  }, []);

  function seleccionarCliente(socio: Socio | null) {
    setCliente(socio);
    setPagos((actuales) => actuales.filter((pago) => pago.medio !== "CUENTA_CORRIENTE"));
    void cargarCuentaCliente(socio);
  }

  useEffect(() => {
    async function cargar() {
      const [respuesta,respuestaAperturas,respuestaCajas,respuestaPuntos]=await Promise.all([apiFetch(`${apiUrl}/articulos/almacenes`,{credentials:"include"}),apiFetch(`${apiUrl}/articulos/pos/cajas/abiertas`,{credentials:"include"}),apiFetch(`${apiUrl}/articulos/pos/configuracion/cajas`,{credentials:"include"}),apiFetch(`${apiUrl}/articulos/pos/configuracion/puntos-venta`,{credentials:"include"})]);
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
  useEffect(()=>{void apiFetch(`${apiUrl}/autenticacion/mis-permisos`,{credentials:"include"}).then(async respuesta=>{if(respuesta.ok){const datos:{permisos:string[]}=await respuesta.json();setPermisosUsuario(datos.permisos)}})},[]);

  const persistirBorrador=useCallback(async():Promise<string|null>=>{if(!apertura||!lineas.length)return null;try{const r=await apiFetch(`${apiUrl}/articulos/pos/borradores`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({borrador_id:borradorIdRef.current,apertura_caja_id:apertura.id,cliente_id:cliente?.id??null,almacen_id:almacen,lineas:lineas.map(x=>({articulo_id:x.id,cantidad_base:x.cantidad})),pagos:[]})});if(!r.ok)return null;const d:Venta=await r.json();borradorIdRef.current=d.id;return d.id}catch{return null}},[apertura,cliente,almacen,lineas]);
  useEffect(()=>{
    if(!apertura||!lineas.length)return;
    const temporizador=window.setTimeout(async()=>{if(confirmandoRef.current)return;const promesa=persistirBorrador();guardadoEnCursoRef.current=promesa;await promesa;if(guardadoEnCursoRef.current===promesa)guardadoEnCursoRef.current=null},450);
    return()=>window.clearTimeout(temporizador)
  },[apertura,lineas.length,persistirBorrador]);

  async function abrirCaja(e:FormEvent){e.preventDefault();const r=await apiFetch(`${apiUrl}/articulos/pos/cajas/abrir`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({caja_id:cajaAbrir,efectivo_inicial:Number(efectivoInicial),periodo_operativo:periodoOperativo})});const d=await r.json();if(!r.ok){setMensaje(d.detail??"No se pudo abrir la caja");return}setApertura(d);setAperturas([...aperturas,d]);setAlmacen(puntos.find(x=>x.id===d.punto_venta_id)?.almacen_id??"")}
  async function cargarBorradores(){if(!apertura)return;const r=await apiFetch(`${apiUrl}/articulos/pos/borradores?apertura_caja_id=${apertura.id}`,{credentials:"include"});if(r.ok){setBorradores(await r.json());setVerBorradores(true)}}
  function recuperarBorrador(b:Venta){borradorIdRef.current=b.id;setAlmacen(b.almacen_id);seleccionarCliente({id:b.cliente_id,codigo:"",razon_social:b.cliente_nombre,numero_documento:"",activo:true});setLineas(b.lineas.map(x=>({id:x.articulo_id,codigo:x.articulo_codigo,descripcion:x.articulo_descripcion,habilitado_inventario:true,es_pesable:x.es_pesable,cantidad:Number(x.cantidad_base),precio:Number(x.precio_unitario_bruto),precioAnterior:x.precio_anterior_bruto?Number(x.precio_anterior_bruto):null,lista:x.lista_nombre,total:Number(x.total_bruto)})));setVerBorradores(false)}
  async function borrarBorrador(id:string){const r=await apiFetch(`${apiUrl}/articulos/pos/borradores/${id}`,{method:"DELETE",credentials:"include"});if(r.ok){if(borradorIdRef.current===id){borradorIdRef.current=null;setLineas([])}await cargarBorradores()}}
  async function prepararCierre(){
    if(!apertura)return;
    setProcesando(true);setMensaje("");
    const respuesta=await apiFetch(`${apiUrl}/tesoreria/cajas/${apertura.id}/control`,{credentials:"include"});
    const datos=await respuesta.json();setProcesando(false);
    if(!respuesta.ok){setMensaje(datos.detail??"No se pudo obtener el control de caja");return}
    const control:ControlCaja=datos;
    setControlCierre(control);setDeclaraciones(Object.fromEntries(control.medios.map(x=>[x.medio,""])));setObservacionCierre("");setErrorCierre("");setCierreAbierto(true);
  }
  async function confirmarCierre(){
    if(!apertura||!controlCierre)return;
    if(controlCierre.medios.some(x=>declaraciones[x.medio]==="")){setErrorCierre("Debe declarar el importe contado de cada medio");return}
    setProcesando(true);setErrorCierre("");
    const respuesta=await apiFetch(`${apiUrl}/tesoreria/cajas/${apertura.id}/cerrar`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({medios:controlCierre.medios.map(x=>({medio:x.medio,declarado:Number(declaraciones[x.medio])})),observacion:observacionCierre||null})});
    const datos=await respuesta.json();setProcesando(false);
    if(!respuesta.ok){setErrorCierre(datos.detail??"No se pudo cerrar la caja");return}
    const aperturasRestantes=aperturas.filter(x=>x.id!==apertura.id);
    setCierreAbierto(false);setControlCierre(null);setAperturas(aperturasRestantes);setApertura(aperturasRestantes[0]??null);setLineas([]);setPagos([{medio:"EFECTIVO",importe:"",referencia:""}]);setMensaje(`Caja cerrada · Diferencia de efectivo ${formatearMoneda(Number(datos.diferencia))}`);
  }

  useEffect(() => {
    function accesoRapido(e: globalThis.KeyboardEvent) {
      if (e.key === "F3") {
        e.preventDefault();
        setCobroAbierto(false);
        setConsultaPreciosAbierta(true);
      } else if (e.key === "F2") {
        e.preventDefault();
        setCobroAbierto(false);
        setConsultaPreciosAbierta(false);
        window.setTimeout(() => buscadorArticuloRef.current?.focus(), 0);
      } else if (e.key === "Escape" && consultaPreciosAbierta) {
        e.preventDefault();
        setConsultaPreciosAbierta(false);
        window.setTimeout(() => buscadorArticuloRef.current?.focus(), 0);
      } else if (e.key === "Escape" && cobroAbierto) {
        e.preventDefault();
        setCobroAbierto(false);
      } else if (e.key === "F10" && !cobroAbierto && !consultaPreciosAbierta && lineas.length > 0) {
        e.preventDefault();
        setErrorCobro("");setCobroAbierto(true);
      }
    }
    window.addEventListener("keydown", accesoRapido);
    return () => window.removeEventListener("keydown", accesoRapido);
  }, [cobroAbierto, consultaPreciosAbierta, lineas.length]);

  function agregarCuentaCorriente() {
    if (!cliente || cantidadCuentasCorrientes > 0 || saldoCuentaCorrienteRequerido <= 0) return;
    setPagos([
      ...pagos,
      { medio: "CUENTA_CORRIENTE", importe: saldoCuentaCorrienteRequerido.toFixed(2), referencia: "" },
    ]);
    setErrorCobro("");
  }

  function cambiarMedioPago(indice: number, medio: Pago["medio"]) {
    const pagoActual = pagos[indice];
    const pagadoSinFila = pagado - (
      pagoActual.medio === "CUENTA_CORRIENTE" ? 0 : Number(pagoActual.importe || 0)
    );
    const saldoFavorParaCambio = Math.min(
      saldoFavorDisponible,
      Math.max(total - pagadoSinFila, 0),
    );
    const cuentaCorrienteParaCambio = Math.max(
      total - pagadoSinFila - saldoFavorParaCambio,
      0,
    );
    setPagos(pagos.map((pago, posicion) => posicion === indice
      ? {
          ...pago,
          medio,
          importe: medio === "CUENTA_CORRIENTE"
            ? cuentaCorrienteParaCambio.toFixed(2)
            : pago.importe,
          referencia: medio === "CUENTA_CORRIENTE" ? "" : pago.referencia,
        }
      : pago));
    setErrorCobro("");
  }

  async function cotizar(articulo: ArticuloBuscado, cantidad: number) {
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/precio?articulo_id=${articulo.id}&cantidad_base=${cantidad}`, { credentials: "include" });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.detail ?? "No se pudo obtener el precio");
    return {
      precio: Number(datos.precio_venta_bruto),
      precioAnterior: datos.precio_anterior_bruto === null ? null : Number(datos.precio_anterior_bruto),
      lista: datos.lista_nombre,
    };
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
      const cantidad = redondearCantidad((existente?.cantidad ?? 0) + cantidadAgregar);
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
    const cantidadNormalizada = redondearCantidad(cantidad);
    if (cantidadNormalizada <= 0) {
      setLineas(lineas.filter((x) => x.id !== id));
      return;
    }
    const linea = lineas.find((x) => x.id === id);
    if (!linea) return;
    try {
      const precio = await cotizar(linea, cantidadNormalizada);
      setLineas(lineas.map((x) => x.id === id ? { ...x, cantidad: cantidadNormalizada, ...precio, total: cantidadNormalizada * precio.precio } : x));
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo recalcular el precio");
    }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!apertura || !almacen || !lineas.length) return;
    if (!cobroCoincide || cantidadCuentasCorrientes > 1 || !cuentaCorrienteValida) {
      setErrorCobro("La venta debe quedar cubierta exactamente por medios de pago, saldo a favor y una cuenta corriente seleccionada de forma explicita.");
      return;
    }
    const ventanaImpresion = modoImpresion === "DIRECTA" ? window.open("about:blank", "ticket-directo-tailil", "width=420,height=720") : null;
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
    if(!borradorConfirmar){ventanaImpresion?.close();setProcesando(false);confirmandoRef.current=false;setErrorCobro("No se pudo guardar el borrador antes de confirmar");return}
    const respuesta = await apiFetch(`${apiUrl}/articulos/pos/ventas`, {
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
      ventanaImpresion?.close();
      confirmandoRef.current=false;
      setErrorCobro(datos.detail ?? "No se pudo confirmar la venta");
      return;
    }
    const venta: Venta = datos;
    setMensaje(`PRESUPUESTO ${venta.numero_completo} confirmado · Saldo pendiente ${formatearMoneda(venta.saldo_pendiente)}`);
    setUltimaVenta(venta);
    void cargarCuentaCliente(cliente);
    if (modoImpresion === "DIRECTA" && ventanaImpresion) {
      ventanaImpresion.location.href = `${apiUrl}/articulos/pos/ventas/${venta.id}/imprimir?formato=ticket&automatico=true`;
    } else if (modoImpresion === "DIRECTA") {
      setMensaje(`PRESUPUESTO ${venta.numero_completo} confirmado. El navegador bloqueó la impresión directa.`);
    }
    borradorIdRef.current=null;
    confirmandoRef.current=false;
    setLineas([]);
    setPagos([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
    setCobroAbierto(false);
    } catch (error) {
      ventanaImpresion?.close();
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

  if(!apertura)return <main className="listas-precios-pagina p-6 sm:p-9"><header className="border-b pb-5"><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas</p><h1 className="text-3xl font-semibold">Abrir caja</h1><p className="text-sm text-[var(--texto-suave)]">Elija la fecha operativa. Puede abrir y cerrar varias cajas o turnos dentro del mismo día.</p></header>{mensaje&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{mensaje}</p>}<form onSubmit={abrirCaja} className="mt-5 grid max-w-2xl gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="sm:col-span-2">Caja<select required className="mt-1 w-full rounded-xl border p-3" value={cajaAbrir} onChange={e=>setCajaAbrir(e.target.value)}><option value="">Seleccionar caja</option>{cajas.filter(x=>x.activo).map(x=><option key={x.id} value={x.id}>{puntos.find(p=>p.id===x.punto_venta_id)?.codigo} · {x.codigo} - {x.descripcion}</option>)}</select></label><label>Fecha operativa<input required max={hoyLocal()} type="date" className="mt-1 w-full rounded-xl border p-3" value={periodoOperativo} onChange={e=>setPeriodoOperativo(e.target.value)}/><small className="mt-1 block text-[var(--texto-suave)]">Período al que pertenecerá el cierre.</small></label><label>Efectivo inicial<input required min="0" step="0.01" type="number" className="mt-1 w-full rounded-xl border p-3" value={efectivoInicial} onChange={e=>setEfectivoInicial(e.target.value)}/></label><button className="sm:col-span-2 justify-self-end rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white">Abrir caja</button></form></main>;

  return (
    <main className="listas-precios-pagina flex min-h-screen flex-col overflow-x-hidden p-4 sm:p-6 xl:h-screen xl:min-h-[720px] xl:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas</p>
        <h1 className="text-2xl font-semibold">Punto de venta</h1>
        <p className="text-sm text-[var(--texto-suave)]">PRESUPUESTO · {apertura.punto_venta_codigo} · {apertura.caja_codigo} · Caja de {apertura.usuario_nombre} · Período {new Date(`${apertura.periodo_operativo}T00:00:00`).toLocaleDateString("es-AR")}</p></div>
        <div className="flex flex-wrap items-end gap-2">{permisosUsuario.includes("ventas.notas_credito.emitir")&&<button type="button" disabled={!apertura} onClick={()=>setNotaCreditoAbierta(true)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)] disabled:opacity-40">Emitir N/C</button>}{aperturas.length>1&&<label className="text-xs">Caja abierta<select className="ml-2 rounded-lg border p-2" value={apertura.id} onChange={e=>{const elegida=aperturas.find(x=>x.id===e.target.value);if(elegida){setApertura(elegida);setAlmacen(puntos.find(p=>p.id===elegida.punto_venta_id)?.almacen_id??"");borradorIdRef.current=null;setLineas([])}}}>{aperturas.map(x=><option key={x.id} value={x.id}>{x.punto_venta_codigo} · {x.caja_codigo} · {x.usuario_nombre}</option>)}</select></label>}<button type="button" onClick={()=>void cargarBorradores()} className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)]">Recuperar borradores</button>{permisosUsuario.some(x=>x==="ventas.caja.cerrar"||x==="tesoreria.gestionar")&&<button type="button" disabled={procesando||lineas.length>0} title={lineas.length?"Finalice o quite la venta en curso antes de cerrar":"Cerrar la caja propia"} onClick={()=>void prepararCierre()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Cerrar caja</button>}</div>
      </header>
      {mensaje && <p className="mt-3 shrink-0 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">{mensaje}</p>}
      <form onSubmit={confirmar} className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <section className="flex min-h-0 flex-col gap-3">
          <div className="shrink-0 rounded-2xl border bg-white p-4"><label className="text-sm font-semibold"><span className="flex items-center justify-between"><span>Agregar producto</span><span className="font-normal text-[var(--texto-suave)]">Código, descripción, barra o proveedor <kbd className="ml-2 rounded border bg-[var(--fondo)] px-2 py-1 text-xs">F2</kbd></span></span><BuscadorArticulo soloInventario={false} referenciaEntrada={buscadorArticuloRef} limpiarAlSeleccionar seleccionarDirectoConEnter seleccionar={()=>{}} seleccionarConCantidad={(x,cantidad)=>void agregarArticulo(x,cantidad)} /><small className="mt-1 block text-[var(--texto-suave)]">Escanee y presione Enter. Multiplicador: 12*código.</small></label></div>
          <div className="min-h-[320px] flex-1 overflow-auto rounded-2xl border bg-white">
            <table className="w-full min-w-[780px] text-left text-sm"><thead className="sticky top-0 z-10 bg-white shadow-sm"><tr className="text-xs uppercase text-[var(--texto-suave)]"><th className="p-3">Articulo</th><th className="p-3">Cantidad</th><th className="p-3">Lista</th><th className="p-3 text-right">Precio</th><th className="p-3 text-right">Total</th><th className="p-3"></th></tr></thead><tbody>{lineas.map((x) => <tr key={x.id} className="border-t"><td className="p-3"><b>{x.codigo}</b><small className="block max-w-[320px] truncate" title={x.descripcion}>{x.descripcion}</small>{x.es_pesable&&<small className="font-semibold text-[var(--marca)]">PESABLE</small>}</td><td className="p-3"><input ref={(elemento)=>{cantidadesRef.current[x.id]=elemento}} className="w-24 rounded-lg border p-2" type="number" min={x.es_pesable?"0.001":"1"} step={x.es_pesable?"0.001":"1"} value={x.cantidad} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();buscadorArticuloRef.current?.focus()}}} onChange={(e) => void cambiarCantidad(x.id, Number(e.target.value))} /></td><td className="p-3">{x.lista}{x.precioAnterior!==null&&<span className="ml-2 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">DESCUENTO</span>}</td><td className="p-3 text-right">{x.precioAnterior!==null&&<span className="mr-2 block text-xs text-[var(--texto-suave)] line-through">{formatearMoneda(x.precioAnterior)}</span>}<b className={x.precioAnterior!==null?"text-green-700":""}>{formatearMoneda(x.precio)}</b></td><td className="p-3 text-right font-semibold">{formatearMoneda(x.total)}</td><td className="p-3 text-right"><button type="button" aria-label={`Quitar ${x.descripcion}`} title="Quitar" className="rounded-lg border border-red-200 px-3 py-2 text-red-700" onClick={() => setLineas(lineas.filter((l) => l.id !== x.id))}>×</button></td></tr>)}</tbody></table>
            {!lineas.length && <div className="grid h-full min-h-[240px] place-content-center p-6 text-center text-sm text-[var(--texto-suave)]"><b className="text-base text-[var(--texto)]">La venta está vacía</b><span>Escanee o busque un producto para comenzar.</span></div>}
          </div>
        </section>
        <aside className="order-first space-y-3 overflow-y-auto pb-2 xl:order-none xl:min-h-0">
          <section className="sticky top-0 z-20 rounded-2xl border border-[var(--marca)] bg-white p-5 shadow-md"><small className="font-semibold uppercase tracking-wider text-[var(--texto-suave)]">Total a cobrar</small><b className="block text-4xl text-[var(--marca)]">{formatearMoneda(total)}</b><p className="mt-1 text-xs text-[var(--texto-suave)]">{lineas.length} {lineas.length===1?"artículo":"artículos"} · {formatearCantidad(lineas.reduce((suma,linea)=>suma+linea.cantidad,0))} unidades</p><button type="button" disabled={!lineas.length} onClick={() => { setErrorCobro("");setCobroAbierto(true); }} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-5 py-3 text-lg font-semibold text-white disabled:opacity-40">Cobrar <kbd className="ml-2 rounded border border-white/50 px-2 py-1 text-xs">F10</kbd></button><button type="button" onClick={() => { setCobroAbierto(false); setConsultaPreciosAbierta(true); }} className="mt-2 w-full rounded-xl border px-4 py-2 font-semibold text-[var(--marca)]">Consultar precios <kbd className="ml-2 rounded border px-2 py-1 text-xs">F3</kbd></button></section>
          <section className="rounded-2xl border bg-white p-4"><label className="text-sm font-semibold">Cliente <small className="font-normal text-[var(--texto-suave)]">(CONSUMIDOR FINAL)</small><BuscadorCliente seleccionar={seleccionarCliente} /></label><EstadoCuentaCorriente cliente={cliente} cuenta={cuentaCliente} cargando={cargandoCuentaCliente} error={errorCuentaCliente}/></section>
          <section className="rounded-2xl border bg-white p-4"><label className="text-xs font-bold uppercase text-[var(--texto-suave)]">Almacén<select disabled className="mt-1 w-full rounded-xl border bg-gray-100 p-2 text-sm font-normal normal-case" value={almacen} onChange={(e) => setAlmacen(e.target.value)} required><option value="">Seleccionar</option>{almacenes.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.codigo} - {x.descripcion}</option>)}</select></label><div className="mt-3"><SelectorModoImpresion modo={modoImpresion} cambiar={cambiarModoImpresion}/></div></section>
          {ultimaVenta&&<section className="rounded-2xl border bg-white p-4 text-sm"><small className="text-[var(--texto-suave)]">Última venta</small><b className="block">{ultimaVenta.numero_completo}</b><div className="mt-2 flex gap-2"><button type="button" onClick={()=>window.open(`${apiUrl}/articulos/pos/ventas/${ultimaVenta.id}/imprimir?formato=ticket`,"_blank")} className="rounded-lg border px-3 py-2">Ticket</button><button type="button" onClick={()=>window.open(`${apiUrl}/articulos/pos/ventas/${ultimaVenta.id}/imprimir?formato=a4`,"_blank")} className="rounded-lg border px-3 py-2">A4</button></div></section>}
        </aside>
        {cobroAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Punto de venta</p><h2 id="titulo-cobro" className="text-2xl font-semibold">Cobrar venta</h2></div><button type="button" aria-label="Cerrar cobro" onClick={() => setCobroAbierto(false)} className="rounded-lg border px-3 py-2 font-semibold">×</button></div>
          <EstadoCuentaCorriente cliente={cliente} cuenta={cuentaCliente} cargando={cargandoCuentaCliente} error={errorCuentaCliente} saldoVenta={importeCuentaCorriente}/>
          <div className="my-5 grid grid-cols-2 gap-3 rounded-xl bg-[var(--fondo)] p-4 text-right sm:grid-cols-4"><div><small>Total</small><b className="block text-2xl">{formatearMoneda(total)}</b></div><div><small>Pago inmediato</small><b className="block text-2xl">{formatearMoneda(pagado)}</b></div><div><small>Saldo a favor aplicado</small><b className="block text-2xl text-green-700">{formatearMoneda(saldoFavorAplicado)}</b></div><div><small>Cuenta corriente elegida</small><b className="block text-2xl text-[var(--marca)]">{formatearMoneda(importeCuentaCorriente)}</b></div></div>
          {errorCobro&&<p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{errorCobro}</p>}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Como se cubre la venta</h2><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold text-[var(--marca)]" onClick={() => setPagos([...pagos, { medio: "TARJETA", importe: "", referencia: "" }])}>Agregar medio</button><button type="button" disabled={!cliente || cantidadCuentasCorrientes > 0 || saldoCuentaCorrienteRequerido <= 0} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-sm font-semibold text-[var(--marca)] disabled:cursor-not-allowed disabled:opacity-40" onClick={agregarCuentaCorriente}>Usar cuenta corriente</button></div></div>
          <div className="space-y-2">{pagos.map((pago, indice) => <div key={indice} className="grid gap-2 md:grid-cols-[200px_160px_1fr_auto]"><select className="rounded-xl border p-3" value={pago.medio} onChange={(e) => cambiarMedioPago(indice, e.target.value as Pago["medio"])}><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>OTRO</option><option disabled={!cliente || (cantidadCuentasCorrientes > 0 && pago.medio !== "CUENTA_CORRIENTE")}>CUENTA_CORRIENTE</option></select><input autoFocus={indice === 0} className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Importe" value={pago.importe} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, importe: e.target.value } : x))} /><input disabled={pago.medio === "CUENTA_CORRIENTE"} className="rounded-xl border p-3 disabled:bg-gray-100" placeholder={pago.medio === "CUENTA_CORRIENTE" ? "No corresponde" : "Referencia opcional"} value={pago.referencia} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, referencia: e.target.value } : x))} /><button type="button" className="rounded-lg border px-3" onClick={() => setPagos(pagos.filter((_, i) => i !== indice))}>Quitar</button></div>)}</div>
          {!cliente&&saldoCuentaCorrienteRequerido>0&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Para usar cuenta corriente primero debe seleccionar un cliente.</p>}
          {!cobroCoincide&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{diferenciaCobro>0?`Falta cubrir ${formatearMoneda(diferenciaCobro)}. Agregue un medio de pago o elija Cuenta corriente.`:`La cobertura supera el total por ${formatearMoneda(Math.abs(diferenciaCobro))}.`}</p>}
          {importeCuentaCorriente>0&&!cuentaCorrienteValida&&<p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">La cuenta corriente seleccionada no esta habilitada, posee deuda vencida, no pudo consultarse o no tiene credito suficiente.</p>}
          <div className="mt-5 flex flex-wrap items-end justify-end gap-6 border-t pt-4 text-right"><div><small>Total bruto</small><b className="block text-xl">{formatearMoneda(total)}</b></div><div><small>Pago inmediato</small><b className="block text-xl">{formatearMoneda(pagado)}</b></div><div><small>Saldo a favor</small><b className="block text-xl text-green-700">{formatearMoneda(saldoFavorAplicado)}</b></div><div><small>Cuenta corriente elegida</small><b className="block text-xl">{formatearMoneda(importeCuentaCorriente)}</b></div><button disabled={procesando || !almacen || !lineas.length || !cobroCoincide || cantidadCuentasCorrientes > 1 || !cuentaCorrienteValida} className="rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40">{procesando ? "Confirmando..." : "Confirmar venta"}</button></div>
          <p className="mt-3 text-xs text-[var(--texto-suave)]">La cuenta corriente nunca se supone por una diferencia: debe elegirla expresamente. El saldo a favor se aplica primero y no vuelve a ingresar en caja. Presione ESC para cerrar.</p>
        </section></div>}
      </form>
      {consultaPreciosAbierta&&<ModalConsultaPrecios cerrar={()=>{setConsultaPreciosAbierta(false);window.setTimeout(()=>buscadorArticuloRef.current?.focus(),0)}}/>}
      {notaCreditoAbierta&&apertura&&<ModalNotaCreditoPos aperturaId={apertura.id} cerrar={()=>setNotaCreditoAbierta(false)} confirmada={setMensaje}/>}
      {verBorradores&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><section className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6"><div className="flex justify-between border-b pb-4"><h2 className="text-xl font-semibold">Borradores de caja</h2><button onClick={()=>setVerBorradores(false)} className="rounded-lg border px-3 py-2">×</button></div><TablaOrdenable className="mt-4 w-full text-left text-sm"><thead><tr><th>Cliente</th><th>Productos</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{borradores.map(b=><tr className="border-t" key={b.id}><td className="py-3">{b.cliente_nombre}</td><td>{b.lineas.length}</td><td>{formatearMoneda(Number(b.total_bruto))}</td><td className="flex gap-2 py-2"><button onClick={()=>recuperarBorrador(b)} className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]">Recuperar</button><button onClick={()=>void borrarBorrador(b.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Eliminar</button></td></tr>)}</tbody></TablaOrdenable>{!borradores.length&&<p className="p-8 text-center text-[var(--texto-suave)]">No hay borradores pendientes.</p>}</section></div>}
      {cierreAbierto&&controlCierre&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cierre-caja"><section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><header className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Control de caja propia</p><h2 id="titulo-cierre-caja" className="text-2xl font-semibold">Cerrar {apertura.caja_codigo}</h2><small className="text-[var(--texto-suave)]">{controlCierre.cantidad_ventas} ventas · {formatearMoneda(Number(controlCierre.total_ventas))}</small><span className="mt-2 block rounded-lg bg-[var(--marca-clara)] px-3 py-2 text-sm font-semibold text-[var(--marca)]">Período del cierre: {new Date(`${apertura.periodo_operativo}T00:00:00`).toLocaleDateString("es-AR")}</span></div><button type="button" aria-label="Cancelar cierre" disabled={procesando} onClick={()=>setCierreAbierto(false)} className="rounded-lg border px-3 py-2">×</button></header><div className="mt-5 grid gap-3 sm:grid-cols-2">{controlCierre.medios.map(x=><label key={x.medio} className="rounded-xl border p-4 text-sm"><span className="flex justify-between gap-3"><b>{x.medio}</b><span>Esperado {formatearMoneda(Number(x.esperado))}</span></span><input type="number" min="0" step="0.01" required value={declaraciones[x.medio]??""} onChange={e=>setDeclaraciones({...declaraciones,[x.medio]:e.target.value})} placeholder="Importe contado" className="mt-3 w-full rounded-lg border p-3"/></label>)}</div><label className="mt-4 block text-sm font-semibold">Observación<textarea value={observacionCierre} onChange={e=>setObservacionCierre(e.target.value)} maxLength={500} placeholder="Explique cualquier diferencia" className="mt-1 block min-h-24 w-full rounded-xl border p-3 font-normal"/></label><div className="mt-5 flex justify-end gap-3 border-t pt-4"><button type="button" disabled={procesando} onClick={()=>setCierreAbierto(false)} className="rounded-xl border px-4 py-2">Cancelar</button><button type="button" disabled={procesando||controlCierre.medios.some(x=>declaraciones[x.medio]==="")} onClick={()=>void confirmarCierre()} className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-40">{procesando?"Cerrando...":"Confirmar cierre"}</button></div></section></div>}
      {cierreAbierto&&errorCierre&&<p role="alert" className="fixed left-1/2 top-5 z-[60] w-[min(92vw,680px)] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-xl">{errorCierre}</p>}
    </main>
  );
}

function EstadoCuentaCorriente({ cliente, cuenta, cargando, error, saldoVenta = 0 }: { cliente:Socio|null;cuenta:CuentaCorrienteCliente|null;cargando:boolean;error:string;saldoVenta?:number }) {
  if (!cliente) return null;
  if (cargando) return <div className="mt-2 rounded-xl border bg-[var(--fondo)] p-3 text-sm text-[var(--texto-suave)]">Consultando limite de cuenta corriente...</div>;
  if (error) return <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">No se pudo mostrar el limite disponible: {error}</div>;
  if (!cuenta) return null;
  const creditoDisponible=Number(cuenta.credito_disponible);
  const saldoFavor=Number(cuenta.saldo_favor);
  const disponible=Number(cuenta.disponible_total);
  const excede=saldoVenta>creditoDisponible+0.001;
  return <div className={`mt-2 rounded-xl border p-3 ${cuenta.deuda_vencida||excede?"border-red-200 bg-red-50":"border-green-200 bg-green-50"}`}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><small className="font-semibold uppercase tracking-wider text-[var(--texto-suave)]">Disponible total</small><b className={`block text-2xl ${excede?"text-red-700":"text-green-800"}`}>{formatearMoneda(disponible)}</b><span className="text-xs text-[var(--texto-suave)]">Saldo a favor {formatearMoneda(saldoFavor)} + credito autorizado {formatearMoneda(creditoDisponible)}</span></div><div className="text-right text-xs text-[var(--texto-suave)]"><span className="block">Limite total {formatearMoneda(Number(cuenta.limite_deuda))}</span><span className="block">Deuda actual {formatearMoneda(Number(cuenta.deuda_actual))}</span><span className="block">Disponible del periodo {cuenta.temporalidad}: {formatearMoneda(Math.max(Number(cuenta.limite_periodo)-Number(cuenta.consumo_periodo),0))}</span></div></div>
    {!cuenta.activa&&<p className="mt-2 text-xs font-semibold text-amber-800">Cuenta corriente no habilitada. El saldo a favor igualmente puede utilizarse.</p>}
    {cuenta.deuda_vencida&&<p className="mt-2 text-xs font-semibold text-red-700">El cliente posee deuda vencida; el credito autorizado queda bloqueado, pero conserva su saldo a favor.</p>}
    {excede&&<p className="mt-2 text-xs font-semibold text-red-700">El importe elegido para cuenta corriente supera el credito autorizado disponible.</p>}
  </div>;
}

function ModalConsultaPrecios({ cerrar }: { cerrar: () => void }) {
  const [articulo, setArticulo] = useState<ArticuloBuscado | null>(null);
  const [precios, setPrecios] = useState<PrecioVentaConsulta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const buscadorRef = useRef<HTMLInputElement>(null);
  const versionConsultaRef = useRef(0);

  useEffect(() => { window.setTimeout(() => buscadorRef.current?.focus(), 0); }, []);

  async function consultar(seleccionado: ArticuloBuscado | null) {
    const version = ++versionConsultaRef.current;
    setArticulo(seleccionado);
    setPrecios([]);
    setError("");
    if (!seleccionado) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const respuesta = await apiFetch(`${apiUrl}/articulos/precios/consulta-venta/${seleccionado.id}`, { credentials: "include" });
      const datos = await respuesta.json();
      if (version !== versionConsultaRef.current) return;
      if (!respuesta.ok) throw new Error(datos.detail ?? "No se pudieron consultar los precios");
      setPrecios(datos);
    } catch (e) {
      if (version !== versionConsultaRef.current) return;
      setError(e instanceof Error ? e.message : "No se pudieron consultar los precios");
    } finally {
      if (version === versionConsultaRef.current) setCargando(false);
    }
  }

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-consulta-precios">
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Punto de venta</p><h2 id="titulo-consulta-precios" className="text-2xl font-semibold">Consulta de precios</h2><p className="text-sm text-[var(--texto-suave)]">Busque por código, descripción, código de barras o código de proveedor.</p></div><button type="button" aria-label="Cerrar consulta de precios" onClick={cerrar} className="rounded-lg border px-3 py-2 font-semibold">×</button></div>
      <div className="mt-5"><BuscadorArticulo soloInventario={false} referenciaEntrada={buscadorRef} seleccionarDirectoConEnter seleccionar={(x)=>void consultar(x)} /></div>
      {error&&<p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {cargando&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">Consultando precios...</p>}
      {!cargando&&articulo&&<div className="mt-5 overflow-hidden rounded-xl border"><div className="bg-[var(--fondo)] p-4"><b className="font-mono">{articulo.codigo}</b><span className="ml-2">{articulo.descripcion}</span></div><table className="w-full text-left text-sm"><thead><tr className="border-t text-xs uppercase text-[var(--texto-suave)]"><th className="p-3">Lista de venta</th><th className="p-3 text-right">Precio</th></tr></thead><tbody>{precios.map((precio)=><tr key={precio.lista_id} className="border-t"><td className="p-3 font-semibold">{precio.lista_nombre}</td><td className="p-3 text-right text-lg font-semibold text-[var(--marca)]">{formatearMoneda(Number(precio.precio_venta_bruto))}</td></tr>)}</tbody></table>{!precios.length&&!error&&<p className="border-t p-5 text-center text-sm text-[var(--texto-suave)]">El artículo no tiene listas de venta activas.</p>}</div>}
      <p className="mt-4 text-xs text-[var(--texto-suave)]">La lista interna de compras no forma parte de esta consulta. Presione ESC para cerrar.</p>
    </section>
  </div>;
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
      const r = await apiFetch(`${apiUrl}/articulos/socios?rol=cliente&buscar=${encodeURIComponent(texto)}`, { credentials: "include" });
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
