"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { apiFetch } from "@/api";
import TablaOrdenable from "@/components/TablaOrdenable";
import HistorialCierresCalendario from "@/components/HistorialCierresCalendario";
import RetiroCaja from "@/components/RetiroCaja";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const dinero = (v: string | number | null | undefined) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(v ?? 0));
const fecha = (v: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));

type Resumen = { ventas_historicas: string; cuentas_por_cobrar: string; cuentas_por_pagar: string; cajas_abiertas: number };
type Socio = { id: string; codigo?: string; razon_social: string; numero_documento?: string; es_cliente: boolean; es_proveedor: boolean };
type Pendiente = { id: string; numero: number; numero_externo: string | null; socio_id: string; socio_nombre: string; total: string; saldo_pendiente: string; fecha: string };
type Venta = { id: string; numero: number; numero_completo:string; letra: string; tipo_documento: string; socio_nombre: string; total: string; saldo_pendiente: string; estado: string; fecha: string };
type DocumentoPago = { id: string; numero: number; socio_id: string; socio_nombre: string; estado: string; total: string; disponible: string; fecha_realizacion: string; medios: { medio: string; importe: string; referencia: string | null }[]; imputaciones: { id: string; documento_id: string; documento?: string; importe: string; estado: string; fecha: string; motivo_anulacion: string | null }[] };
type TicketDetalle = { id:string;numero:number|null;numero_completo:string|null;letra:string;tipo_documento:string;punto_venta_codigo:string|null;caja_codigo:string|null;cliente_nombre:string;estado:string;subtotal_neto:string;total_iva:string;total_bruto:string;saldo_pendiente:string;fecha_realizacion:string;lineas:{articulo_id:string;articulo_codigo:string;articulo_descripcion:string;lista_nombre:string;cantidad_base:string;precio_unitario_bruto:string;descuento_porcentual:string;total_bruto:string}[] };
type Apertura = { id: string; caja_codigo: string; punto_venta_codigo: string; usuario_nombre: string; efectivo_inicial: string; periodo_operativo: string; fecha_apertura: string };
type Control = { apertura_id: string; estado: string; efectivo_inicial: string; total_ventas: string; cantidad_ventas: number; total_cobros: string; total_pagos: string; total_ingresos: string; total_egresos: string; medios: { medio: string; esperado: string }[] };
type CuentaAgrupada = { cuenta_padre_id:string|null;cuenta_padre_nombre:string|null;es_cuenta_agrupadora:boolean;miembros_agrupados:number;deuda_individual:string;saldo_favor_individual:string;documentos_individuales:number };
type CuentaClienteResumen = CuentaAgrupada & { socio_id:string;codigo:string;razon_social:string;numero_documento:string;cuenta_configurada:boolean;cuenta_activa:boolean;limite_asignado:string;credito_ocupado:string;credito_disponible:string;deuda_actual:string;saldo_favor:string;documentos_pendientes:number;deuda_mas_antigua:string|null };
type CuentaProveedorResumen = CuentaAgrupada & { socio_id:string;codigo:string;razon_social:string;numero_documento:string;deuda_actual:string;saldo_favor:string;documentos_pendientes:number;deuda_mas_antigua:string|null };
type Tab = "resumen" | "cuentas" | "conciliaciones" | "ventas" | "caja" | "cierres";

export default function Tesoreria() {
  const enlaceInformeAplicado = useRef(false);
  const [tab, setTab] = useState<Tab>("cuentas");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [tipo, setTipo] = useState<"clientes" | "proveedores">("clientes");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoPago[]>([]);
  const [aperturas, setAperturas] = useState<Apertura[]>([]);
  const [cuentasClientes, setCuentasClientes] = useState<CuentaClienteResumen[]>([]);
  const [cuentasProveedores, setCuentasProveedores] = useState<CuentaProveedorResumen[]>([]);
  const [busquedaListado, setBusquedaListado] = useState("");
  const [filtroListado, setFiltroListado] = useState<"MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS">("MOVIMIENTOS");
  const [gestionCuentaAbierta, setGestionCuentaAbierta] = useState(false);
  const [ticketDetalle, setTicketDetalle] = useState<TicketDetalle|null>(null);
  const [cargandoTicket, setCargandoTicket] = useState(false);
  const [socioId, setSocioId] = useState("");
  const [busquedaSocio, setBusquedaSocio] = useState("");
  const [medio, setMedio] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [totalDocumento, setTotalDocumento] = useState("");
  const [importes, setImportes] = useState<Record<string, string>>({});
  const [importesConciliacion, setImportesConciliacion] = useState<Record<string, string>>({});
  const [aperturaId, setAperturaId] = useState("");
  const [control, setControl] = useState<Control | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [movTipo, setMovTipo] = useState<"INGRESO" | "EGRESO">("INGRESO");
  const [movImporte, setMovImporte] = useState("");
  const [movConcepto, setMovConcepto] = useState("");
  const [denominaciones, setDenominaciones] = useState<Record<string, string>>({ "100": "", "200": "", "500": "", "1000": "", "2000": "", "10000": "", "20000": "" });
  const [declarado, setDeclarado] = useState("");
  const [observacion, setObservacion] = useState("");

  async function cargarBase() {
    const [rr, rs, rv, ra, rcc, rcp] = await Promise.all([
      apiFetch(`${apiUrl}/tesoreria/resumen`),
      apiFetch(`${apiUrl}/articulos/socios?rol=todos`),
      apiFetch(`${apiUrl}/tesoreria/ventas`),
      apiFetch(`${apiUrl}/articulos/pos/cajas/abiertas`),
      apiFetch(`${apiUrl}/tesoreria/cuentas-corrientes/clientes/resumen`),
      apiFetch(`${apiUrl}/tesoreria/cuentas-corrientes/proveedores/resumen`),
    ]);
    if (rr.ok) setResumen(await rr.json());
    if (rs.ok) setSocios(await rs.json());
    if (rv.ok) setVentas(await rv.json());
    if (ra.ok) {
      const data: Apertura[] = await ra.json(); setAperturas(data);
      setAperturaId((actual) => actual || data[0]?.id || "");
    }
    if (rcc.ok) setCuentasClientes(await rcc.json());
    if (rcp.ok) setCuentasProveedores(await rcp.json());
  }

  async function cargarFinanciero(clase = tipo) {
    const esCliente = clase === "clientes";
    const filtroSocio = socioId ? `?socio_id=${socioId}` : "";
    const filtroCuenta = socioId ? `?socio_id=${socioId}` : "";
    const [rp, rd] = await Promise.all([
      apiFetch(`${apiUrl}/tesoreria/cuentas-corrientes/${clase}${filtroCuenta}`),
      apiFetch(`${apiUrl}/tesoreria/${esCliente ? "cobros" : "pagos"}${filtroSocio}`),
    ]);
    if (rp.ok) setPendientes(await rp.json());
    if (rd.ok) {
      const documentosCargados: DocumentoPago[] = await rd.json();
      if (esCliente) {
        const ventasSinRotulo = [...new Set(documentosCargados.flatMap((documento) => documento.imputaciones.filter((imputacion) => !imputacion.documento).map((imputacion) => imputacion.documento_id)))];
        const rotulos = new Map<string,string>();
        await Promise.all(ventasSinRotulo.map(async (ventaId) => {
          const respuesta = await apiFetch(`${apiUrl}/articulos/pos/ventas/${ventaId}`);
          if (!respuesta.ok) return;
          const venta: TicketDetalle = await respuesta.json();
          if (venta.numero_completo) rotulos.set(ventaId, venta.numero_completo);
        }));
        setDocumentos(documentosCargados.map((documento) => ({...documento,imputaciones:documento.imputaciones.map((imputacion) => ({...imputacion,documento:imputacion.documento||rotulos.get(imputacion.documento_id)}))})));
      } else setDocumentos(documentosCargados);
    }
  }

  async function cargarControl(id = aperturaId) {
    if (!id) { setControl(null); return; }
    const r = await apiFetch(`${apiUrl}/tesoreria/cajas/${id}/control`);
    if (r.ok) setControl(await r.json());
  }

  useEffect(() => { void cargarBase(); void cargarFinanciero(); }, []);
  useEffect(() => { window.setTimeout(() => window.scrollTo({ top: 0 }), 0); }, []);
  useEffect(() => { void cargarFinanciero(tipo); setSocioId(""); setImportes({}); }, [tipo]);
  useEffect(() => { if (socioId) void cargarFinanciero(tipo); }, [socioId]);
  useEffect(() => { void cargarControl(aperturaId); }, [aperturaId]);
  useEffect(() => {
    if(enlaceInformeAplicado.current)return;
    const parametros=new URLSearchParams(window.location.search),socio=parametros.get("socio_id"),clase=parametros.get("tipo");
    if(!socio)return;
    const cuenta=clase==="proveedores"?cuentasProveedores.find(x=>x.socio_id===socio):cuentasClientes.find(x=>x.socio_id===socio);
    if(!cuenta)return;
    enlaceInformeAplicado.current=true;
    if(clase==="proveedores")abrirCuentaProveedor(cuenta as CuentaProveedorResumen);else abrirCuentaCliente(cuenta as CuentaClienteResumen);
    setTab("conciliaciones");
  },[cuentasClientes,cuentasProveedores]);
  useEffect(() => {
    function cerrarGestion(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") {
        if (ticketDetalle) setTicketDetalle(null);
        else setGestionCuentaAbierta(false);
      }
    }
    window.addEventListener("keydown", cerrarGestion);
    return () => window.removeEventListener("keydown", cerrarGestion);
  }, [ticketDetalle]);

  // El API ya devuelve sólo la cuenta hija o todo el grupo cuando se abre la cuenta padre.
  const pendientesVisibles = useMemo(() => socioId ? pendientes : [], [pendientes, socioId]);
  const documentosVisibles = useMemo(() => socioId ? documentos : [], [documentos, socioId]);
  const totalImputado = useMemo(() => Object.values(importes).reduce((a, v) => a + (Number(v) || 0), 0), [importes]);
  const efectivoArqueo = useMemo(() => Object.entries(denominaciones).reduce((a, [d, c]) => a + Number(d) * (Number(c) || 0), 0), [denominaciones]);

  async function enviar(url: string, body: unknown) {
    setProcesando(true); setMensaje("");
    try {
      const r = await apiFetch(`${apiUrl}${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "No se pudo completar la operacion");
      setMensaje("Operacion registrada correctamente");
      await cargarBase(); await cargarFinanciero(); await cargarControl();
      return true;
    } catch (error) { setMensaje(error instanceof Error ? error.message : "Error de conexion"); return false; }
    finally { setProcesando(false); }
  }

  async function abrirTicket(ventaId: string) {
    setCargandoTicket(true);
    setMensaje("");
    try {
      const respuesta = await apiFetch(`${apiUrl}/articulos/pos/ventas/${ventaId}`);
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detail ?? "No se pudo abrir el ticket");
      setTicketDetalle(datos as TicketDetalle);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo abrir el ticket");
    } finally {
      setCargandoTicket(false);
    }
  }

  async function registrarPago(e: FormEvent) {
    e.preventDefault();
    const total = Number(totalDocumento) || totalImputado;
    if (!socioId || total <= 0) { setMensaje("Seleccione un socio e indique el total cobrado o pagado"); return; }
    if (total < totalImputado) { setMensaje("El total del documento no puede ser menor que lo imputado"); return; }
    const ok = await enviar(`/tesoreria/${tipo === "clientes" ? "cobros" : "pagos"}`, {
      socio_id: socioId, apertura_caja_id: aperturaId || null,
      medios: [{ medio, importe: total, referencia: referencia || null }],
      imputaciones: pendientesVisibles.filter((x) => Number(importes[x.id]) > 0).map((x) => ({ documento_id: x.id, importe: Number(importes[x.id]) })),
      observacion: null,
    });
    if (ok) { setImportes({}); setReferencia(""); setTotalDocumento(""); }
  }

  async function conciliarPendiente(documento: DocumentoPago) {
    const items = pendientesVisibles.filter((x) => Number(importesConciliacion[`${documento.id}:${x.id}`]) > 0).map((x) => ({ documento_id: x.id, importe: Number(importesConciliacion[`${documento.id}:${x.id}`]) }));
    if (!items.length) { setMensaje("Ingrese al menos un importe para conciliar"); return; }
    if (items.reduce((a, x) => a + x.importe, 0) > Number(documento.disponible)) { setMensaje("La conciliacion supera el saldo disponible"); return; }
    const ok = await enviar(`/tesoreria/conciliaciones/${tipo}`, { documento_pago_id: documento.id, imputaciones: items });
    if (ok) setImportesConciliacion({});
  }

  async function registrarMovimiento(e: FormEvent) {
    e.preventDefault();
    const ok = await enviar("/tesoreria/cajas/movimientos", { apertura_caja_id: aperturaId, tipo: movTipo, medio: "EFECTIVO", importe: Number(movImporte), concepto: movConcepto });
    if (ok) { setMovImporte(""); setMovConcepto(""); }
  }

  async function arquear() {
    const lista = Object.entries(denominaciones).filter(([, c]) => Number(c) > 0).map(([d, c]) => ({ denominacion: Number(d), cantidad: Number(c) }));
    if (!lista.length) { setMensaje("Ingrese las cantidades contadas"); return; }
    const ok = await enviar("/tesoreria/cajas/arqueos", { apertura_caja_id: aperturaId, denominaciones: lista, observacion: observacion || null });
    if (ok) setDenominaciones((actual) => Object.fromEntries(Object.keys(actual).map((k) => [k, ""])));
  }

  async function cerrar() {
    if (!confirm("El cierre es definitivo para esta apertura. ¿Desea continuar?")) return;
    const medios = (control?.medios ?? []).map((x) => ({ medio: x.medio, declarado: x.medio === "EFECTIVO" ? Number(declarado) : Number(x.esperado) }));
    await enviar(`/tesoreria/cajas/${aperturaId}/cerrar`, { medios, observacion: observacion || null });
    setDeclarado(""); setObservacion("");
  }

  const tabs: [Tab, string][] = [["cuentas", "Cuentas corrientes"], ["caja", "Caja y arqueo"], ["cierres", "Historial de cierres"]];
  const sociosRol = socios.filter((x) => tipo === "clientes" ? x.es_cliente : x.es_proveedor);
  const socioSeleccionado = sociosRol.find((x) => x.id === socioId);
  const sociosEncontrados = sociosRol.filter((x) => {
    const texto = `${x.codigo ?? ""} ${x.razon_social} ${x.numero_documento ?? ""}`.toLowerCase();
    return busquedaSocio.toLowerCase().split(/\s+/).filter(Boolean).every((termino) => texto.includes(termino));
  }).slice(0, 10);
  const saldoSocio = pendientesVisibles.reduce((total, x) => total + Number(x.saldo_pendiente), 0);
  const disponibleSocio = documentosVisibles.reduce((total, x) => total + Number(x.disponible), 0);
  const cuentasClientesVisibles = useMemo(() => cuentasClientes.filter((cuenta) => {
    const deuda = Math.max(Number(cuenta.deuda_actual), Number(cuenta.deuda_individual));
    const favor = Math.max(Number(cuenta.saldo_favor), Number(cuenta.saldo_favor_individual));
    const coincideSaldo = filtroListado === "TODOS" ||
      (filtroListado === "MOVIMIENTOS" && (deuda > 0 || favor > 0)) ||
      (filtroListado === "DEUDA" && deuda > 0) ||
      (filtroListado === "FAVOR" && favor > 0);
    const texto = `${cuenta.codigo} ${cuenta.razon_social} ${cuenta.numero_documento} ${cuenta.cuenta_padre_nombre ?? ""}`.toLowerCase();
    const coincideBusqueda = busquedaListado.toLowerCase().split(/\s+/).filter(Boolean).every((termino) => texto.includes(termino));
    return coincideSaldo && coincideBusqueda;
  }), [cuentasClientes, busquedaListado, filtroListado]);
  const totalDeudaClientes = cuentasClientesVisibles.reduce((suma, cuenta) => suma + Number(cuenta.deuda_actual), 0);
  const totalFavorClientes = cuentasClientesVisibles.reduce((suma, cuenta) => suma + Number(cuenta.saldo_favor), 0);
  const cuentasProveedoresVisibles = useMemo(() => cuentasProveedores.filter((cuenta) => {
    const deuda = Math.max(Number(cuenta.deuda_actual), Number(cuenta.deuda_individual));
    const favor = Math.max(Number(cuenta.saldo_favor), Number(cuenta.saldo_favor_individual));
    const coincideSaldo = filtroListado === "TODOS" ||
      (filtroListado === "MOVIMIENTOS" && (deuda > 0 || favor > 0)) ||
      (filtroListado === "DEUDA" && deuda > 0) ||
      (filtroListado === "FAVOR" && favor > 0);
    const texto = `${cuenta.codigo} ${cuenta.razon_social} ${cuenta.numero_documento} ${cuenta.cuenta_padre_nombre ?? ""}`.toLowerCase();
    return coincideSaldo && busquedaListado.toLowerCase().split(/\s+/).filter(Boolean).every((termino) => texto.includes(termino));
  }), [cuentasProveedores, busquedaListado, filtroListado]);
  const totalDeudaProveedores = cuentasProveedoresVisibles.reduce((suma, cuenta) => suma + Number(cuenta.deuda_actual), 0);
  const totalFavorProveedores = cuentasProveedoresVisibles.reduce((suma, cuenta) => suma + Number(cuenta.saldo_favor), 0);

  function abrirCuentaCliente(cuenta: CuentaClienteResumen) {
    setTipo("clientes");
    setTab("cuentas");
    setSocioId(cuenta.socio_id);
    setBusquedaSocio(cuenta.razon_social);
    setImportes({});
    setGestionCuentaAbierta(true);
  }

  function abrirCuentaProveedor(cuenta: CuentaProveedorResumen) {
    setTipo("proveedores");
    setTab("cuentas");
    setSocioId(cuenta.socio_id);
    setBusquedaSocio(cuenta.razon_social);
    setImportes({});
    setGestionCuentaAbierta(true);
  }

  return <main className="min-h-screen p-5 sm:p-8">
    <section>
      <header className="border-b border-[var(--borde)] pb-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--marca)]">Tesoreria</p>
        <h1 className="mt-1 text-3xl font-semibold">Tesorería</h1>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">Busque una cuenta, revise su posición y concilie documentos en una misma ficha.</p>
      </header>
      <nav className="mt-5 flex flex-wrap gap-2">{tabs.map(([id, nombre]) => <button key={id} onClick={() => setTab(id)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${(tab === id || (id === "cuentas" && tab === "conciliaciones")) ? "border-[var(--marca)] bg-[var(--marca)] text-white" : "bg-white"}`}>{nombre}</button>)}</nav>
      {mensaje && <p className={`mt-4 rounded-xl border p-3 text-sm ${mensaje.includes("correctamente") ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{mensaje}</p>}

      {tab === "resumen" && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[["Ventas registradas", resumen?.ventas_historicas], ["Cuentas por cobrar", resumen?.cuentas_por_cobrar], ["Cuentas por pagar", resumen?.cuentas_por_pagar]].map(([t, v]) => <article key={t} className="rounded-2xl border bg-white p-5"><p className="text-xs uppercase tracking-wider text-[var(--texto-suave)]">{t}</p><strong className="mt-3 block text-2xl">{dinero(v)}</strong></article>)}
        <article className="rounded-2xl border bg-white p-5"><p className="text-xs uppercase tracking-wider text-[var(--texto-suave)]">Cajas abiertas</p><strong className="mt-3 block text-2xl">{resumen?.cajas_abiertas ?? 0}</strong></article>
      </div>}

      {(tab === "cuentas" || tab === "conciliaciones") && <div className="mt-6">
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><b>Jerarquía de cuentas:</b> la deuda y los pagos de las cuentas vinculadas se consolidan en la cuenta padre. El límite, el crédito ocupado y el disponible se siguen controlando individualmente en cada cliente hijo.</div>
        <div className="mb-4 flex gap-2"><button onClick={() => {setTipo("clientes");setBusquedaSocio("")}} className={`rounded-lg px-4 py-2 text-sm ${tipo === "clientes" ? "bg-[var(--marca-clara)] font-bold text-[var(--marca)]" : "bg-white"}`}>Clientes / cobros</button><button onClick={() => {setTipo("proveedores");setBusquedaSocio("")}} className={`rounded-lg px-4 py-2 text-sm ${tipo === "proveedores" ? "bg-[var(--marca-clara)] font-bold text-[var(--marca)]" : "bg-white"}`}>Proveedores / pagos</button></div>
        {tipo === "clientes"&&<ListadoCuentasClientes cuentas={cuentasClientesVisibles} totalDeuda={totalDeudaClientes} totalFavor={totalFavorClientes} busqueda={busquedaListado} cambiarBusqueda={setBusquedaListado} filtro={filtroListado} cambiarFiltro={setFiltroListado} abrirCuenta={abrirCuentaCliente}/>} 
        {tipo === "proveedores"&&<ListadoCuentasProveedores cuentas={cuentasProveedoresVisibles} totalDeuda={totalDeudaProveedores} totalFavor={totalFavorProveedores} busqueda={busquedaListado} cambiarBusqueda={setBusquedaListado} filtro={filtroListado} cambiarFiltro={setFiltroListado} abrirCuenta={abrirCuentaProveedor}/>} 
        <div className="hidden">
        <section className="mb-5 rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">1 · Buscar {tipo === "clientes" ? "cliente" : "proveedor"}</p><div className="relative mt-2 max-w-2xl"><input autoFocus value={busquedaSocio} onChange={(e)=>{setBusquedaSocio(e.target.value);setSocioId("");setImportes({})}} placeholder="Nombre, código o documento" className="w-full rounded-xl border p-3"/>{busquedaSocio&&!socioId&&<div className="absolute z-30 mt-1 w-full rounded-xl border bg-white p-1 shadow-xl">{sociosEncontrados.map(x=><button key={x.id} onClick={()=>{setSocioId(x.id);setBusquedaSocio(x.razon_social);setImportes({})}} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[var(--fondo)]"><b>{x.razon_social}</b><small className="block text-[var(--texto-suave)]">{x.codigo} · {x.numero_documento}</small></button>)}{!sociosEncontrados.length&&<p className="p-3 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}</div>}</div>{socioSeleccionado&&<><div className="mt-4 grid gap-3 rounded-xl bg-[var(--fondo)] p-4 sm:grid-cols-3"><div><small>Cuenta seleccionada</small><b className="block">{socioSeleccionado.razon_social}</b></div><div><small>{tipo==="clientes"?"Saldo por cobrar":"Saldo por pagar"}</small><b className="block text-xl text-[var(--marca)]">{dinero(saldoSocio)}</b></div><div><small>Pagos sin aplicar</small><b className="block text-xl">{dinero(disponibleSocio)}</b></div></div><div className="mt-3 flex gap-2"><button onClick={()=>setTab("cuentas")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Documentos y registrar</button><button onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></div></>}</section>
        {tab === "cuentas" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto rounded-2xl border bg-white p-4"><h2 className="font-semibold">Documentos pendientes</h2><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Socio</th><th className="p-2">Documento</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.socio_nombre}</td><td className="p-2">{x.numero_externo || `#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label="Importe a imputar" type="number" min="0" max={x.saldo_pendiente} step="0.01" disabled={!socioId || socioId !== x.socio_id} value={importes[x.id] ?? ""} onChange={(e) => setImportes({ ...importes, [x.id]: e.target.value })} className="w-28 rounded-lg border p-2 text-right" /></td></tr>)}</tbody></table>{!pendientesVisibles.length && <p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay documentos pendientes.</p>}</div>
          <form onSubmit={registrarPago} className="h-fit rounded-2xl border bg-white p-5"><h2 className="font-semibold">Registrar {tipo === "clientes" ? "cobro" : "pago"}</h2><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Socio<select required value={socioId} onChange={(e) => { setSocioId(e.target.value); setImportes({}); }} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal normal-case"><option value="">Seleccionar...</option>{sociosRol.map((x) => <option key={x.id} value={x.id}>{x.razon_social}</option>)}</select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total {tipo === "clientes" ? "cobrado" : "pagado"}<input type="number" min="0.01" step="0.01" placeholder={`Automatico: ${dinero(totalImputado)}`} value={totalDocumento} onChange={(e) => setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal" /></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e) => setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal" /></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><span className="text-xs text-[var(--texto-suave)]">Total imputado ahora</span><strong className="block text-xl">{dinero(totalImputado)}</strong><small className="text-[var(--texto-suave)]">La diferencia queda disponible para conciliar despues.</small></div><button disabled={procesando || (!totalDocumento && totalImputado <= 0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar y conciliar</button></form>
        </div> : <div className="space-y-3">{documentos.map((d) => <article key={d.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">{tipo === "clientes" ? "COBRO" : "PAGO"} #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><strong>{dinero(d.total)}</strong><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m, i) => <span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length > 0 && <table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i) => <tr key={i.id} className="border-t"><td className="py-2">{tipo==="clientes"?<button type="button" disabled={cargandoTicket} onClick={()=>void abrirTicket(i.documento_id)} className="font-mono font-semibold text-[var(--marca)] underline decoration-dotted underline-offset-4 disabled:opacity-50">{i.documento||`Ticket ${i.documento_id.slice(0,8)}`}</button>:(i.documento||`Factura ${i.documento_id.slice(0,8)}`)}</td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado === "ACTIVA" && <button onClick={async () => { const motivo = prompt("Motivo de anulacion (minimo 5 caracteres)"); if (motivo) await enviar(`/tesoreria/conciliaciones/${tipo}/${i.id}/anular`, { motivo }); }} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible) > 0 && pendientes.some((x) => x.socio_id === d.socio_id) && <div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar saldo disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientes.filter((x) => x.socio_id === d.socio_id).map((x) => <label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo || `#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente), Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`] ?? ""} onChange={(e) => setImportesConciliacion({ ...importesConciliacion, [`${d.id}:${x.id}`]: e.target.value })} className="w-28 rounded-lg border bg-white p-2 text-right" /></label>)}</div><button onClick={() => void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}</div>}
        </div>
      </div>}

      {tipo === "clientes"&&gestionCuentaAbierta&&socioSeleccionado&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-gestion-cuenta" onMouseDown={(evento)=>{if(evento.target===evento.currentTarget)setGestionCuentaAbierta(false)}}><section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Cuenta corriente del cliente</p><h2 id="titulo-gestion-cuenta" className="text-2xl font-semibold">{socioSeleccionado.razon_social}</h2><small className="text-[var(--texto-suave)]">{socioSeleccionado.codigo} · {socioSeleccionado.numero_documento}</small></div><div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 px-4 py-2 text-right"><small className="block text-red-700">Saldo por cobrar</small><b className="text-xl text-red-800">{dinero(saldoSocio)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2 text-right"><small className="block text-green-700">Saldo a favor</small><b className="text-xl text-green-800">{dinero(disponibleSocio)}</b></div><button type="button" aria-label="Cerrar gestión de cuenta" onClick={()=>setGestionCuentaAbierta(false)} className="rounded-lg border px-3 py-2 text-xl">×</button></div></header><nav className="flex shrink-0 gap-2 border-b px-5 py-3"><button type="button" onClick={()=>setTab("cuentas")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Documentos y cobro</button><button type="button" onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></nav><div className="min-h-0 flex-1 overflow-y-auto p-5">{tab==="cuentas"?<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-x-auto rounded-2xl border p-4"><h3 className="font-semibold">Documentos pendientes</h3><table className="mt-3 w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Documento</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x)=><tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.numero_externo||`#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label={`Imputar documento ${x.numero}`} type="number" min="0" max={x.saldo_pendiente} step="0.01" value={importes[x.id]??""} onChange={(e)=>setImportes({...importes,[x.id]:e.target.value})} className="w-28 rounded-lg border p-2 text-right"/></td></tr>)}</tbody></table>{!pendientesVisibles.length&&<div className="p-8 text-center"><b className="block text-green-800">El cliente no tiene deuda pendiente</b><span className="text-sm text-[var(--texto-suave)]">No existe ninguna factura o venta con saldo para imputar.</span></div>}</section><form onSubmit={registrarPago} className="h-fit rounded-2xl border p-5"><h3 className="font-semibold">Registrar cobro</h3><p className="mt-1 text-xs text-[var(--texto-suave)]">Si no se imputa a una deuda, el importe quedará como saldo a favor.</p><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total cobrado<input type="number" min="0.01" step="0.01" placeholder={`Automático: ${dinero(totalImputado)}`} value={totalDocumento} onChange={(e)=>setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e)=>setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e)=>setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><small>Total imputado ahora</small><b className="block text-xl">{dinero(totalImputado)}</b></div><button disabled={procesando||(!totalDocumento&&totalImputado<=0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar cobro</button></form></div>:<div className="space-y-3">{documentosVisibles.map((d)=><article key={d.id} className="rounded-2xl border p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">COBRO #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><b>{dinero(d.total)}</b><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m,i)=><span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length>0&&<table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i)=><tr key={i.id} className="border-t"><td className="py-2"><button type="button" disabled={cargandoTicket} onClick={()=>void abrirTicket(i.documento_id)} className="font-mono font-semibold text-[var(--marca)] underline decoration-dotted underline-offset-4 disabled:opacity-50">{i.documento||`Ticket ${i.documento_id.slice(0,8)}`}</button></td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado==="ACTIVA"&&<button type="button" onClick={async()=>{const motivo=prompt("Motivo de anulacion (minimo 5 caracteres)");if(motivo)await enviar(`/tesoreria/conciliaciones/clientes/${i.id}/anular`,{motivo})}} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible)>0&&pendientesVisibles.length>0&&<div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar saldo disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientesVisibles.map((x)=><label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo||`#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente),Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`]??""} onChange={(e)=>setImportesConciliacion({...importesConciliacion,[`${d.id}:${x.id}`]:e.target.value})} className="w-28 rounded-lg border bg-white p-2 text-right"/></label>)}</div><button type="button" onClick={()=>void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}{!documentosVisibles.length&&<p className="p-10 text-center text-sm text-[var(--texto-suave)]">El cliente todavía no tiene cobros registrados.</p>}</div>}</div></section></div>}
      {tipo === "proveedores"&&gestionCuentaAbierta&&socioSeleccionado&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-gestion-proveedor" onMouseDown={(evento)=>{if(evento.target===evento.currentTarget)setGestionCuentaAbierta(false)}}><section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Cuenta corriente del proveedor</p><h2 id="titulo-gestion-proveedor" className="text-2xl font-semibold">{socioSeleccionado.razon_social}</h2><small className="text-[var(--texto-suave)]">{socioSeleccionado.codigo} · {socioSeleccionado.numero_documento}</small></div><div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 px-4 py-2 text-right"><small className="block text-red-700">Saldo por pagar</small><b className="text-xl text-red-800">{dinero(saldoSocio)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2 text-right"><small className="block text-green-700">Pagos sin aplicar</small><b className="text-xl text-green-800">{dinero(disponibleSocio)}</b></div><button type="button" aria-label="Cerrar gestión del proveedor" onClick={()=>setGestionCuentaAbierta(false)} className="rounded-lg border px-3 py-2 text-xl">×</button></div></header><nav className="flex shrink-0 gap-2 border-b px-5 py-3"><button type="button" onClick={()=>setTab("cuentas")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Facturas y pago</button><button type="button" onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></nav><div className="min-h-0 flex-1 overflow-y-auto p-5">{tab==="cuentas"?<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-x-auto rounded-2xl border p-4"><h3 className="font-semibold">Facturas pendientes</h3><table className="mt-3 w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Factura</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x)=><tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.numero_externo||`#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label={`Imputar factura ${x.numero}`} type="number" min="0" max={x.saldo_pendiente} step="0.01" value={importes[x.id]??""} onChange={(e)=>setImportes({...importes,[x.id]:e.target.value})} className="w-28 rounded-lg border p-2 text-right"/></td></tr>)}</tbody></table>{!pendientesVisibles.length&&<div className="p-8 text-center"><b className="block text-green-800">No hay facturas pendientes</b><span className="text-sm text-[var(--texto-suave)]">El proveedor no tiene saldo de deuda para imputar.</span></div>}</section><form onSubmit={registrarPago} className="h-fit rounded-2xl border p-5"><h3 className="font-semibold">Registrar pago</h3><p className="mt-1 text-xs text-[var(--texto-suave)]">Si no se imputa a una factura, quedará disponible para conciliar después.</p><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total pagado<input type="number" min="0.01" step="0.01" placeholder={`Automático: ${dinero(totalImputado)}`} value={totalDocumento} onChange={(e)=>setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e)=>setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e)=>setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><small>Total imputado ahora</small><b className="block text-xl">{dinero(totalImputado)}</b></div><button disabled={procesando||(!totalDocumento&&totalImputado<=0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar pago</button></form></div>:<div className="space-y-3">{documentosVisibles.map((d)=><article key={d.id} className="rounded-2xl border p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">PAGO #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><b>{dinero(d.total)}</b><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m,i)=><span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length>0&&<table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i)=><tr key={i.id} className="border-t"><td className="py-2">{i.documento||`Factura ${i.documento_id.slice(0,8)}`}</td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado==="ACTIVA"&&<button type="button" onClick={async()=>{const motivo=prompt("Motivo de anulacion (minimo 5 caracteres)");if(motivo)await enviar(`/tesoreria/conciliaciones/proveedores/${i.id}/anular`,{motivo})}} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible)>0&&pendientesVisibles.length>0&&<div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar pago disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientesVisibles.map((x)=><label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo||`#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente),Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`]??""} onChange={(e)=>setImportesConciliacion({...importesConciliacion,[`${d.id}:${x.id}`]:e.target.value})} className="w-28 rounded-lg border bg-white p-2 text-right"/></label>)}</div><button type="button" onClick={()=>void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}{!documentosVisibles.length&&<p className="p-10 text-center text-sm text-[var(--texto-suave)]">El proveedor todavía no tiene pagos registrados.</p>}</div>}</div></section></div>}

      {tab === "ventas" && <div className="mt-6 overflow-x-auto rounded-2xl border bg-white p-4"><TablaOrdenable data-exportar-excel="true" className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Comprobante</th><th className="p-2">Cliente</th><th className="p-2">Estado</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th></tr></thead><tbody>{ventas.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2"><button type="button" disabled={cargandoTicket} onClick={()=>void abrirTicket(x.id)} className="font-mono font-semibold text-[var(--marca)] underline decoration-dotted underline-offset-4">{x.numero_completo}</button><small className="block text-[var(--texto-suave)]">{x.tipo_documento}</small></td><td className="p-2">{x.socio_nombre}</td><td className="p-2">{x.estado}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td></tr>)}</tbody></TablaOrdenable></div>}

      {tab === "caja" && <div className="mt-6"><label className="block max-w-2xl text-xs font-bold uppercase text-[var(--texto-suave)]">Apertura a controlar<select value={aperturaId} onChange={(e) => setAperturaId(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="">Sin cajas abiertas</option>{aperturas.map((x) => <option key={x.id} value={x.id}>{new Date(`${x.periodo_operativo}T00:00:00`).toLocaleDateString("es-AR")} · {x.punto_venta_codigo} / {x.caja_codigo} · {x.usuario_nombre}</option>)}</select></label>{control && <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Ventas", control.total_ventas], ["Cobros", control.total_cobros], ["Pagos", control.total_pagos], ["Ingresos", control.total_ingresos], ["Egresos", control.total_egresos]].map(([t, v]) => <article key={t} className="rounded-xl border bg-white p-4"><small className="text-[var(--texto-suave)]">{t}</small><strong className="block text-lg">{dinero(v)}</strong></article>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-2">
          <RetiroCaja aperturaId={aperturaId} proveedores={socios.filter(x=>x.es_proveedor)} registrado={async texto=>{setMensaje(texto);await cargarBase();await cargarFinanciero("proveedores");await cargarControl()}}/>
          <form onSubmit={registrarMovimiento} className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Movimiento manual</h2><div className="mt-4 flex gap-2"><select value={movTipo} onChange={(e) => setMovTipo(e.target.value as "INGRESO" | "EGRESO")} className="rounded-lg border p-2"><option>INGRESO</option><option>EGRESO</option></select><input required type="number" min="0.01" step="0.01" placeholder="Importe" value={movImporte} onChange={(e) => setMovImporte(e.target.value)} className="min-w-0 flex-1 rounded-lg border p-2" /></div><input required placeholder="Concepto" value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} className="mt-3 w-full rounded-lg border p-2" /><button disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Registrar</button></form>
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Arqueo de efectivo</h2><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(denominaciones).map(([d, c]) => <label key={d} className="flex items-center gap-2 text-sm"><span className="w-20">{dinero(d)}</span><input type="number" min="0" placeholder="Cant." value={c} onChange={(e) => setDenominaciones({ ...denominaciones, [d]: e.target.value })} className="min-w-0 flex-1 rounded-lg border p-2" /></label>)}</div><p className="mt-3 text-sm">Contado: <strong>{dinero(efectivoArqueo)}</strong> · Esperado: <strong>{dinero(control.medios.find((x) => x.medio === "EFECTIVO")?.esperado)}</strong></p><button onClick={arquear} disabled={procesando} className="mt-3 rounded-lg border border-[var(--marca)] px-4 py-2 text-sm font-semibold text-[var(--marca)]">Guardar arqueo</button></div>
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Cierre definitivo</h2><div className="mt-3 space-y-2">{control.medios.map((x) => <div key={x.medio} className="flex justify-between rounded-lg bg-[var(--fondo)] p-2 text-sm"><span>{x.medio}</span><strong>{dinero(x.esperado)}</strong></div>)}</div><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Efectivo declarado<input type="number" min="0" step="0.01" value={declarado} onChange={(e) => setDeclarado(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm font-normal" /></label><textarea placeholder="Observaciones" value={observacion} onChange={(e) => setObservacion(e.target.value)} className="mt-3 w-full rounded-lg border p-2 text-sm" /><button onClick={cerrar} disabled={procesando || declarado === ""} className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Cerrar caja</button></div>
        </div></>}</div>}

      {tab === "cierres" && <HistorialCierresCalendario />}
      {ticketDetalle&&<DetalleTicket ticket={ticketDetalle} cerrar={()=>setTicketDetalle(null)}/>}
    </section>
  </main>;
}

function DetalleTicket({ticket,cerrar}:{ticket:TicketDetalle;cerrar:()=>void}) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-ticket" onMouseDown={(evento)=>{if(evento.target===evento.currentTarget)cerrar()}}>
    <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Detalle del ticket</p><h2 id="titulo-ticket" className="text-2xl font-semibold">{ticket.numero_completo||`${ticket.letra} #${ticket.numero??0}`}</h2><p className="mt-1 text-sm text-[var(--texto-suave)]">{fecha(ticket.fecha_realizacion)} · {ticket.tipo_documento}</p></div><button type="button" onClick={cerrar} aria-label="Cerrar detalle del ticket" className="rounded-lg border px-3 py-2 text-xl">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Cliente",ticket.cliente_nombre],["Punto de venta",ticket.punto_venta_codigo||"—"],["Caja",ticket.caja_codigo||"—"],["Estado",ticket.estado]].map(([titulo,valor])=><div key={titulo} className="rounded-xl bg-[var(--fondo)] p-3"><small className="text-[var(--texto-suave)]">{titulo}</small><b className="block">{valor}</b></div>)}</div>
        <div className="mt-5 overflow-x-auto rounded-2xl border"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-3">Artículo</th><th>Lista</th><th className="text-right">Cantidad</th><th className="text-right">Precio</th><th className="text-right">Desc.</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{ticket.lineas.map(linea=><tr key={linea.articulo_id} className="border-b last:border-0"><td className="p-3"><b className="font-mono">{linea.articulo_codigo}</b><span className="block">{linea.articulo_descripcion}</span></td><td>{linea.lista_nombre}</td><td className="text-right">{Number(linea.cantidad_base).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:3})}</td><td className="text-right">{dinero(linea.precio_unitario_bruto)}</td><td className="text-right">{Number(linea.descuento_porcentual).toLocaleString("es-AR",{maximumFractionDigits:2})}%</td><td className="p-3 text-right font-semibold">{dinero(linea.total_bruto)}</td></tr>)}</tbody></table></div>
        <div className="mt-5 ml-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-[var(--fondo)] p-4 text-right"><span>Subtotal neto</span><b>{dinero(ticket.subtotal_neto)}</b><span>IVA</span><b>{dinero(ticket.total_iva)}</b><span className="text-lg">Total</span><b className="text-lg text-[var(--marca)]">{dinero(ticket.total_bruto)}</b><span>Saldo pendiente</span><b>{dinero(ticket.saldo_pendiente)}</b></div>
      </div>
    </section>
  </div>;
}

function ListadoCuentasClientes({ cuentas, totalDeuda, totalFavor, busqueda, cambiarBusqueda, filtro, cambiarFiltro, abrirCuenta }: {
  cuentas: CuentaClienteResumen[];
  totalDeuda: number;
  totalFavor: number;
  busqueda: string;
  cambiarBusqueda: (valor: string) => void;
  filtro: "MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS";
  cambiarFiltro: (valor: "MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS") => void;
  abrirCuenta: (cuenta: CuentaClienteResumen) => void;
}) {
  const totalAsignado = cuentas.reduce((suma, cuenta) => suma + Number(cuenta.limite_asignado), 0);
  const totalOcupado = cuentas.reduce((suma, cuenta) => suma + Number(cuenta.credito_ocupado), 0);
  const totalDisponible = cuentas.reduce((suma, cuenta) => suma + Number(cuenta.credito_disponible), 0);
  return <section className="mb-5 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Listado general</p><h2 className="text-xl font-semibold">Cuentas corrientes de clientes</h2><p className="text-sm text-[var(--texto-suave)]">Vea quién debe, quién tiene dinero a favor y abra su cuenta completa.</p></div>
      <div className="flex flex-wrap justify-end gap-2 text-right"><div className="rounded-xl bg-[var(--fondo)] px-4 py-2"><small className="block text-[var(--texto-suave)]">Posición agrupada</small><b>{dinero(totalDeuda-totalFavor)}</b><small className="block text-[var(--texto-suave)]">{cuentas.length} cuenta{cuentas.length===1?"":"s"}</small></div><div className="rounded-xl bg-blue-50 px-4 py-2"><small className="block text-blue-700">Límite asignado</small><b className="text-blue-800">{dinero(totalAsignado)}</b></div><div className="rounded-xl bg-red-50 px-4 py-2"><small className="block text-red-700">Crédito ocupado</small><b className="text-red-800">{dinero(totalOcupado)}</b></div><div className="rounded-xl bg-emerald-50 px-4 py-2"><small className="block text-emerald-700">Crédito disponible</small><b className="text-emerald-800">{dinero(totalDisponible)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2"><small className="block text-green-700">Saldo a favor</small><b className="text-green-800">{dinero(totalFavor)}</b></div></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]"><input value={busqueda} onChange={(e)=>cambiarBusqueda(e.target.value)} placeholder="Buscar por nombre, código o documento" className="rounded-xl border p-3"/><select value={filtro} onChange={(e)=>cambiarFiltro(e.target.value as typeof filtro)} className="rounded-xl border p-3"><option value="MOVIMIENTOS">Con deuda o saldo a favor</option><option value="DEUDA">Solamente con deuda</option><option value="FAVOR">Solamente saldo a favor</option><option value="TODOS">Todos los clientes</option></select></div>
    <div className="mt-4 overflow-x-auto">
      <TablaOrdenable data-exportar-excel="true" className="w-full min-w-[1320px] text-left text-sm">
        <thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Código</th><th className="p-2">Cliente</th><th className="p-2">Documento</th><th className="p-2">Tipo / estado</th><th className="p-2 text-right">Pendientes</th><th className="p-2">Deuda más antigua</th><th className="p-2 text-right">Deuda agrupada</th><th className="p-2 text-right">Límite individual</th><th className="p-2 text-right">Ocupado individual</th><th className="p-2 text-right">Disponible individual</th><th className="p-2 text-right">Saldo a favor</th><th className="p-2">Acción</th></tr></thead>
        <tbody>{cuentas.map((cuenta)=>{
          const asignado=Number(cuenta.limite_asignado);
          const ocupado=Number(cuenta.credito_ocupado);
          const uso=asignado>0?Math.min(100,(ocupado/asignado)*100):0;
          const esAgrupadora=cuenta.es_cuenta_agrupadora;
          const deudaMostrada=esAgrupadora?cuenta.deuda_actual:cuenta.deuda_individual;
          const favorMostrado=esAgrupadora?cuenta.saldo_favor:cuenta.saldo_favor_individual;
          return <tr key={cuenta.socio_id} className="border-b last:border-0"><td className="p-2 font-mono">{cuenta.codigo}</td><td className="p-2"><b className="block">{cuenta.razon_social}</b>{esAgrupadora&&<small className="font-semibold text-blue-700">Agrupa {cuenta.miembros_agrupados} cuentas</small>}{cuenta.cuenta_padre_nombre&&<small className="block text-[var(--texto-suave)]">Agrupada en {cuenta.cuenta_padre_nombre}</small>}</td><td className="p-2">{cuenta.numero_documento}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${esAgrupadora?"bg-blue-50 text-blue-800":cuenta.cuenta_activa?"bg-green-50 text-green-800":"bg-gray-100 text-gray-700"}`}>{esAgrupadora?"AGRUPADORA":cuenta.cuenta_configurada?(cuenta.cuenta_activa?"ACTIVA":"INACTIVA"):"SIN CONFIGURAR"}</span>{esAgrupadora&&cuenta.cuenta_configurada&&<small className="mt-1 block text-[var(--texto-suave)]">Crédito propio {cuenta.cuenta_activa?"activo":"inactivo"}</small>}</td><td className="p-2 text-right">{esAgrupadora?cuenta.documentos_pendientes:cuenta.documentos_individuales}</td><td className="p-2">{cuenta.deuda_mas_antigua?fecha(cuenta.deuda_mas_antigua):"—"}</td><td className="p-2 text-right font-semibold text-red-700">{dinero(deudaMostrada)}</td><td className="p-2 text-right font-semibold text-blue-700">{esAgrupadora&&!cuenta.cuenta_configurada?"No aplica":dinero(asignado)}</td><td className="p-2 text-right">{esAgrupadora&&!cuenta.cuenta_configurada?"No aplica":<><b className="text-red-700">{dinero(ocupado)}</b><div className="ml-auto mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-[var(--fondo)]" title={`${uso.toFixed(1)}% utilizado`}><span className="block h-full rounded-full bg-red-500" style={{width:`${uso}%`}}/></div><small className="text-[var(--texto-suave)]">{uso.toFixed(1)}%</small></>}</td><td className="p-2 text-right font-semibold text-emerald-700">{esAgrupadora&&!cuenta.cuenta_configurada?"No aplica":dinero(cuenta.credito_disponible)}</td><td className="p-2 text-right font-semibold text-green-700">{dinero(favorMostrado)}</td><td className="p-2"><button type="button" onClick={()=>abrirCuenta(cuenta)} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-xs font-semibold text-[var(--marca)]">Abrir cuenta</button></td></tr>
        })}</tbody>
      </TablaOrdenable>
      {!cuentas.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay clientes que coincidan con el filtro.</p>}
    </div>
  </section>;
}

function ListadoCuentasProveedores({ cuentas, totalDeuda, totalFavor, busqueda, cambiarBusqueda, filtro, cambiarFiltro, abrirCuenta }: {
  cuentas: CuentaProveedorResumen[];
  totalDeuda: number;
  totalFavor: number;
  busqueda: string;
  cambiarBusqueda: (valor: string) => void;
  filtro: "MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS";
  cambiarFiltro: (valor: "MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS") => void;
  abrirCuenta: (cuenta: CuentaProveedorResumen) => void;
}) {
  return <section className="mb-5 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Listado general</p><h2 className="text-xl font-semibold">Cuentas corrientes de proveedores</h2><p className="text-sm text-[var(--texto-suave)]">Vea a quién se debe, qué pagos quedaron sin aplicar y abra la cuenta completa.</p></div><div className="flex gap-2 text-right"><div className="rounded-xl bg-red-50 px-4 py-2"><small className="block text-red-700">Total por pagar</small><b className="text-red-800">{dinero(totalDeuda)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2"><small className="block text-green-700">Pagos sin aplicar</small><b className="text-green-800">{dinero(totalFavor)}</b></div></div></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]"><input value={busqueda} onChange={(e)=>cambiarBusqueda(e.target.value)} placeholder="Buscar por nombre, código o documento" className="rounded-xl border p-3"/><select value={filtro} onChange={(e)=>cambiarFiltro(e.target.value as typeof filtro)} className="rounded-xl border p-3"><option value="MOVIMIENTOS">Con deuda o pagos disponibles</option><option value="DEUDA">Solamente con deuda</option><option value="FAVOR">Solamente pagos sin aplicar</option><option value="TODOS">Todos los proveedores</option></select></div>
    <div className="mt-4 overflow-x-auto"><TablaOrdenable data-exportar-excel="true" className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Código</th><th className="p-2">Proveedor</th><th className="p-2">Documento</th><th className="p-2 text-right">Facturas pendientes</th><th className="p-2">Deuda más antigua</th><th className="p-2 text-right">Deuda</th><th className="p-2 text-right">Pagos sin aplicar</th><th className="p-2">Acción</th></tr></thead><tbody>{cuentas.map((cuenta)=><tr key={cuenta.socio_id} className="border-b last:border-0"><td className="p-2 font-mono">{cuenta.codigo}</td><td className="p-2 font-semibold">{cuenta.razon_social}</td><td className="p-2">{cuenta.numero_documento}</td><td className="p-2 text-right">{cuenta.documentos_pendientes}</td><td className="p-2">{cuenta.deuda_mas_antigua?fecha(cuenta.deuda_mas_antigua):"—"}</td><td className="p-2 text-right font-semibold text-red-700">{dinero(cuenta.deuda_actual)}</td><td className="p-2 text-right font-semibold text-green-700">{dinero(cuenta.saldo_favor)}</td><td className="p-2"><button type="button" onClick={()=>abrirCuenta(cuenta)} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-xs font-semibold text-[var(--marca)]">Abrir cuenta</button></td></tr>)}</tbody></TablaOrdenable>{!cuentas.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay proveedores que coincidan con el filtro.</p>}</div>
  </section>;
}
