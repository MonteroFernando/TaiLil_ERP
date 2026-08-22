"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { apiFetch } from "@/api";
import { FormEvent, useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const dinero = (v: string | number | null | undefined) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(v ?? 0));
const fecha = (v: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));

type Resumen = { ventas_historicas: string; cuentas_por_cobrar: string; cuentas_por_pagar: string; cajas_abiertas: number };
type Socio = { id: string; codigo?: string; razon_social: string; numero_documento?: string; es_cliente: boolean; es_proveedor: boolean };
type Pendiente = { id: string; numero: number; numero_externo: string | null; socio_id: string; socio_nombre: string; total: string; saldo_pendiente: string; fecha: string };
type Venta = { id: string; numero: number; letra: string; tipo_documento: string; socio_nombre: string; total: string; saldo_pendiente: string; estado: string; fecha: string };
type DocumentoPago = { id: string; numero: number; socio_id: string; socio_nombre: string; estado: string; total: string; disponible: string; fecha_realizacion: string; medios: { medio: string; importe: string; referencia: string | null }[]; imputaciones: { id: string; documento_id: string; importe: string; estado: string; fecha: string; motivo_anulacion: string | null }[] };
type Apertura = { id: string; caja_codigo: string; punto_venta_codigo: string; usuario_nombre: string; efectivo_inicial: string; fecha_apertura: string };
type Control = { apertura_id: string; estado: string; efectivo_inicial: string; total_ventas: string; cantidad_ventas: number; total_cobros: string; total_pagos: string; total_ingresos: string; total_egresos: string; medios: { medio: string; esperado: string }[] };
type Cierre = { id: string; apertura_id: string; caja: string; punto_venta: string; usuario: string; fecha_apertura: string; fecha_cierre: string; cantidad_ventas: number; total_ventas: string; total_cobros: string; total_pagos: string; efectivo_esperado: string; efectivo_declarado: string; diferencia: string; observacion: string | null; medios: { medio: string; esperado: string; declarado: string; diferencia: string }[] };
type CuentaClienteResumen = { socio_id:string;codigo:string;razon_social:string;numero_documento:string;cuenta_configurada:boolean;cuenta_activa:boolean;deuda_actual:string;saldo_favor:string;documentos_pendientes:number;deuda_mas_antigua:string|null };
type CuentaProveedorResumen = { socio_id:string;codigo:string;razon_social:string;numero_documento:string;deuda_actual:string;saldo_favor:string;documentos_pendientes:number;deuda_mas_antigua:string|null };
type Tab = "resumen" | "cuentas" | "conciliaciones" | "ventas" | "caja" | "cierres";

export default function Tesoreria() {
  const [tab, setTab] = useState<Tab>("cuentas");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [tipo, setTipo] = useState<"clientes" | "proveedores">("clientes");
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoPago[]>([]);
  const [aperturas, setAperturas] = useState<Apertura[]>([]);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cuentasClientes, setCuentasClientes] = useState<CuentaClienteResumen[]>([]);
  const [cuentasProveedores, setCuentasProveedores] = useState<CuentaProveedorResumen[]>([]);
  const [busquedaListado, setBusquedaListado] = useState("");
  const [filtroListado, setFiltroListado] = useState<"MOVIMIENTOS" | "DEUDA" | "FAVOR" | "TODOS">("MOVIMIENTOS");
  const [gestionCuentaAbierta, setGestionCuentaAbierta] = useState(false);
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
    const [rr, rs, rv, ra, rc, rcc, rcp] = await Promise.all([
      apiFetch(`${apiUrl}/tesoreria/resumen`),
      apiFetch(`${apiUrl}/articulos/socios?rol=todos`),
      apiFetch(`${apiUrl}/tesoreria/ventas`),
      apiFetch(`${apiUrl}/articulos/pos/cajas/abiertas`),
      apiFetch(`${apiUrl}/tesoreria/cajas/cierres/historial`),
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
    if (rc.ok) setCierres(await rc.json());
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
    if (rd.ok) setDocumentos(await rd.json());
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
    function cerrarGestion(evento: globalThis.KeyboardEvent) {
      if (evento.key === "Escape") setGestionCuentaAbierta(false);
    }
    window.addEventListener("keydown", cerrarGestion);
    return () => window.removeEventListener("keydown", cerrarGestion);
  }, []);

  const pendientesVisibles = useMemo(() => pendientes.filter((x) => socioId && x.socio_id === socioId), [pendientes, socioId]);
  const documentosVisibles = useMemo(() => documentos.filter((x) => socioId && x.socio_id === socioId), [documentos, socioId]);
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
    const items = pendientes.filter((x) => x.socio_id === documento.socio_id && Number(importesConciliacion[`${documento.id}:${x.id}`]) > 0).map((x) => ({ documento_id: x.id, importe: Number(importesConciliacion[`${documento.id}:${x.id}`]) }));
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
    const deuda = Number(cuenta.deuda_actual);
    const favor = Number(cuenta.saldo_favor);
    const coincideSaldo = filtroListado === "TODOS" ||
      (filtroListado === "MOVIMIENTOS" && (deuda > 0 || favor > 0)) ||
      (filtroListado === "DEUDA" && deuda > 0) ||
      (filtroListado === "FAVOR" && favor > 0);
    const texto = `${cuenta.codigo} ${cuenta.razon_social} ${cuenta.numero_documento}`.toLowerCase();
    const coincideBusqueda = busquedaListado.toLowerCase().split(/\s+/).filter(Boolean).every((termino) => texto.includes(termino));
    return coincideSaldo && coincideBusqueda;
  }), [cuentasClientes, busquedaListado, filtroListado]);
  const totalDeudaClientes = cuentasClientes.reduce((suma, cuenta) => suma + Number(cuenta.deuda_actual), 0);
  const totalFavorClientes = cuentasClientes.reduce((suma, cuenta) => suma + Number(cuenta.saldo_favor), 0);
  const cuentasProveedoresVisibles = useMemo(() => cuentasProveedores.filter((cuenta) => {
    const deuda = Number(cuenta.deuda_actual);
    const favor = Number(cuenta.saldo_favor);
    const coincideSaldo = filtroListado === "TODOS" ||
      (filtroListado === "MOVIMIENTOS" && (deuda > 0 || favor > 0)) ||
      (filtroListado === "DEUDA" && deuda > 0) ||
      (filtroListado === "FAVOR" && favor > 0);
    const texto = `${cuenta.codigo} ${cuenta.razon_social} ${cuenta.numero_documento}`.toLowerCase();
    return coincideSaldo && busquedaListado.toLowerCase().split(/\s+/).filter(Boolean).every((termino) => texto.includes(termino));
  }), [cuentasProveedores, busquedaListado, filtroListado]);
  const totalDeudaProveedores = cuentasProveedores.reduce((suma, cuenta) => suma + Number(cuenta.deuda_actual), 0);
  const totalFavorProveedores = cuentasProveedores.reduce((suma, cuenta) => suma + Number(cuenta.saldo_favor), 0);

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
        <div className="mb-4 flex gap-2"><button onClick={() => {setTipo("clientes");setBusquedaSocio("")}} className={`rounded-lg px-4 py-2 text-sm ${tipo === "clientes" ? "bg-[var(--marca-clara)] font-bold text-[var(--marca)]" : "bg-white"}`}>Clientes / cobros</button><button onClick={() => {setTipo("proveedores");setBusquedaSocio("")}} className={`rounded-lg px-4 py-2 text-sm ${tipo === "proveedores" ? "bg-[var(--marca-clara)] font-bold text-[var(--marca)]" : "bg-white"}`}>Proveedores / pagos</button></div>
        {tipo === "clientes"&&<ListadoCuentasClientes cuentas={cuentasClientesVisibles} totalDeuda={totalDeudaClientes} totalFavor={totalFavorClientes} busqueda={busquedaListado} cambiarBusqueda={setBusquedaListado} filtro={filtroListado} cambiarFiltro={setFiltroListado} abrirCuenta={abrirCuentaCliente}/>} 
        {tipo === "proveedores"&&<ListadoCuentasProveedores cuentas={cuentasProveedoresVisibles} totalDeuda={totalDeudaProveedores} totalFavor={totalFavorProveedores} busqueda={busquedaListado} cambiarBusqueda={setBusquedaListado} filtro={filtroListado} cambiarFiltro={setFiltroListado} abrirCuenta={abrirCuentaProveedor}/>} 
        <div className="hidden">
        <section className="mb-5 rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">1 · Buscar {tipo === "clientes" ? "cliente" : "proveedor"}</p><div className="relative mt-2 max-w-2xl"><input autoFocus value={busquedaSocio} onChange={(e)=>{setBusquedaSocio(e.target.value);setSocioId("");setImportes({})}} placeholder="Nombre, código o documento" className="w-full rounded-xl border p-3"/>{busquedaSocio&&!socioId&&<div className="absolute z-30 mt-1 w-full rounded-xl border bg-white p-1 shadow-xl">{sociosEncontrados.map(x=><button key={x.id} onClick={()=>{setSocioId(x.id);setBusquedaSocio(x.razon_social);setImportes({})}} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-[var(--fondo)]"><b>{x.razon_social}</b><small className="block text-[var(--texto-suave)]">{x.codigo} · {x.numero_documento}</small></button>)}{!sociosEncontrados.length&&<p className="p-3 text-sm text-[var(--texto-suave)]">Sin coincidencias</p>}</div>}</div>{socioSeleccionado&&<><div className="mt-4 grid gap-3 rounded-xl bg-[var(--fondo)] p-4 sm:grid-cols-3"><div><small>Cuenta seleccionada</small><b className="block">{socioSeleccionado.razon_social}</b></div><div><small>{tipo==="clientes"?"Saldo por cobrar":"Saldo por pagar"}</small><b className="block text-xl text-[var(--marca)]">{dinero(saldoSocio)}</b></div><div><small>Pagos sin aplicar</small><b className="block text-xl">{dinero(disponibleSocio)}</b></div></div><div className="mt-3 flex gap-2"><button onClick={()=>setTab("cuentas")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Documentos y registrar</button><button onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></div></>}</section>
        {tab === "cuentas" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto rounded-2xl border bg-white p-4"><h2 className="font-semibold">Documentos pendientes</h2><table className="mt-4 w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Socio</th><th className="p-2">Documento</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.socio_nombre}</td><td className="p-2">{x.numero_externo || `#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label="Importe a imputar" type="number" min="0" max={x.saldo_pendiente} step="0.01" disabled={!socioId || socioId !== x.socio_id} value={importes[x.id] ?? ""} onChange={(e) => setImportes({ ...importes, [x.id]: e.target.value })} className="w-28 rounded-lg border p-2 text-right" /></td></tr>)}</tbody></table>{!pendientesVisibles.length && <p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay documentos pendientes.</p>}</div>
          <form onSubmit={registrarPago} className="h-fit rounded-2xl border bg-white p-5"><h2 className="font-semibold">Registrar {tipo === "clientes" ? "cobro" : "pago"}</h2><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Socio<select required value={socioId} onChange={(e) => { setSocioId(e.target.value); setImportes({}); }} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal normal-case"><option value="">Seleccionar...</option>{sociosRol.map((x) => <option key={x.id} value={x.id}>{x.razon_social}</option>)}</select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total {tipo === "clientes" ? "cobrado" : "pagado"}<input type="number" min="0.01" step="0.01" placeholder={`Automatico: ${totalImputado.toFixed(2)}`} value={totalDocumento} onChange={(e) => setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal" /></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e) => setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal" /></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><span className="text-xs text-[var(--texto-suave)]">Total imputado ahora</span><strong className="block text-xl">{dinero(totalImputado)}</strong><small className="text-[var(--texto-suave)]">La diferencia queda disponible para conciliar despues.</small></div><button disabled={procesando || (!totalDocumento && totalImputado <= 0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar y conciliar</button></form>
        </div> : <div className="space-y-3">{documentos.map((d) => <article key={d.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">{tipo === "clientes" ? "COBRO" : "PAGO"} #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><strong>{dinero(d.total)}</strong><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m, i) => <span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length > 0 && <table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i) => <tr key={i.id} className="border-t"><td className="py-2">Documento {i.documento_id.slice(0, 8)}</td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado === "ACTIVA" && <button onClick={async () => { const motivo = prompt("Motivo de anulacion (minimo 5 caracteres)"); if (motivo) await enviar(`/tesoreria/conciliaciones/${tipo}/${i.id}/anular`, { motivo }); }} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible) > 0 && pendientes.some((x) => x.socio_id === d.socio_id) && <div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar saldo disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientes.filter((x) => x.socio_id === d.socio_id).map((x) => <label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo || `#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente), Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`] ?? ""} onChange={(e) => setImportesConciliacion({ ...importesConciliacion, [`${d.id}:${x.id}`]: e.target.value })} className="w-28 rounded-lg border bg-white p-2 text-right" /></label>)}</div><button onClick={() => void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}</div>}
        </div>
      </div>}

      {tipo === "clientes"&&gestionCuentaAbierta&&socioSeleccionado&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-gestion-cuenta" onMouseDown={(evento)=>{if(evento.target===evento.currentTarget)setGestionCuentaAbierta(false)}}><section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Cuenta corriente del cliente</p><h2 id="titulo-gestion-cuenta" className="text-2xl font-semibold">{socioSeleccionado.razon_social}</h2><small className="text-[var(--texto-suave)]">{socioSeleccionado.codigo} · {socioSeleccionado.numero_documento}</small></div><div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 px-4 py-2 text-right"><small className="block text-red-700">Saldo por cobrar</small><b className="text-xl text-red-800">{dinero(saldoSocio)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2 text-right"><small className="block text-green-700">Saldo a favor</small><b className="text-xl text-green-800">{dinero(disponibleSocio)}</b></div><button type="button" aria-label="Cerrar gestión de cuenta" onClick={()=>setGestionCuentaAbierta(false)} className="rounded-lg border px-3 py-2 text-xl">×</button></div></header><nav className="flex shrink-0 gap-2 border-b px-5 py-3"><button type="button" onClick={()=>setTab("cuentas")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Documentos y cobro</button><button type="button" onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></nav><div className="min-h-0 flex-1 overflow-y-auto p-5">{tab==="cuentas"?<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-x-auto rounded-2xl border p-4"><h3 className="font-semibold">Documentos pendientes</h3><table className="mt-3 w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Documento</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x)=><tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.numero_externo||`#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label={`Imputar documento ${x.numero}`} type="number" min="0" max={x.saldo_pendiente} step="0.01" value={importes[x.id]??""} onChange={(e)=>setImportes({...importes,[x.id]:e.target.value})} className="w-28 rounded-lg border p-2 text-right"/></td></tr>)}</tbody></table>{!pendientesVisibles.length&&<div className="p-8 text-center"><b className="block text-green-800">El cliente no tiene deuda pendiente</b><span className="text-sm text-[var(--texto-suave)]">No existe ninguna factura o venta con saldo para imputar.</span></div>}</section><form onSubmit={registrarPago} className="h-fit rounded-2xl border p-5"><h3 className="font-semibold">Registrar cobro</h3><p className="mt-1 text-xs text-[var(--texto-suave)]">Si no se imputa a una deuda, el importe quedará como saldo a favor.</p><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total cobrado<input type="number" min="0.01" step="0.01" placeholder={`Automático: ${totalImputado.toFixed(2)}`} value={totalDocumento} onChange={(e)=>setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e)=>setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e)=>setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><small>Total imputado ahora</small><b className="block text-xl">{dinero(totalImputado)}</b></div><button disabled={procesando||(!totalDocumento&&totalImputado<=0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar cobro</button></form></div>:<div className="space-y-3">{documentosVisibles.map((d)=><article key={d.id} className="rounded-2xl border p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">COBRO #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><b>{dinero(d.total)}</b><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m,i)=><span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length>0&&<table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i)=><tr key={i.id} className="border-t"><td className="py-2">Documento {i.documento_id.slice(0,8)}</td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado==="ACTIVA"&&<button type="button" onClick={async()=>{const motivo=prompt("Motivo de anulacion (minimo 5 caracteres)");if(motivo)await enviar(`/tesoreria/conciliaciones/clientes/${i.id}/anular`,{motivo})}} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible)>0&&pendientesVisibles.length>0&&<div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar saldo disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientesVisibles.map((x)=><label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo||`#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente),Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`]??""} onChange={(e)=>setImportesConciliacion({...importesConciliacion,[`${d.id}:${x.id}`]:e.target.value})} className="w-28 rounded-lg border bg-white p-2 text-right"/></label>)}</div><button type="button" onClick={()=>void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}{!documentosVisibles.length&&<p className="p-10 text-center text-sm text-[var(--texto-suave)]">El cliente todavía no tiene cobros registrados.</p>}</div>}</div></section></div>}
      {tipo === "proveedores"&&gestionCuentaAbierta&&socioSeleccionado&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-gestion-proveedor" onMouseDown={(evento)=>{if(evento.target===evento.currentTarget)setGestionCuentaAbierta(false)}}><section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Cuenta corriente del proveedor</p><h2 id="titulo-gestion-proveedor" className="text-2xl font-semibold">{socioSeleccionado.razon_social}</h2><small className="text-[var(--texto-suave)]">{socioSeleccionado.codigo} · {socioSeleccionado.numero_documento}</small></div><div className="flex items-start gap-3"><div className="rounded-xl bg-red-50 px-4 py-2 text-right"><small className="block text-red-700">Saldo por pagar</small><b className="text-xl text-red-800">{dinero(saldoSocio)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2 text-right"><small className="block text-green-700">Pagos sin aplicar</small><b className="text-xl text-green-800">{dinero(disponibleSocio)}</b></div><button type="button" aria-label="Cerrar gestión del proveedor" onClick={()=>setGestionCuentaAbierta(false)} className="rounded-lg border px-3 py-2 text-xl">×</button></div></header><nav className="flex shrink-0 gap-2 border-b px-5 py-3"><button type="button" onClick={()=>setTab("cuentas")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="cuentas"?"bg-[var(--marca)] text-white":"border"}`}>Facturas y pago</button><button type="button" onClick={()=>setTab("conciliaciones")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="conciliaciones"?"bg-[var(--marca)] text-white":"border"}`}>Historial y conciliación</button></nav><div className="min-h-0 flex-1 overflow-y-auto p-5">{tab==="cuentas"?<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><section className="overflow-x-auto rounded-2xl border p-4"><h3 className="font-semibold">Facturas pendientes</h3><table className="mt-3 w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Factura</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-right">A imputar</th></tr></thead><tbody>{pendientesVisibles.map((x)=><tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.numero_externo||`#${x.numero}`}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td><td className="p-2 text-right"><input aria-label={`Imputar factura ${x.numero}`} type="number" min="0" max={x.saldo_pendiente} step="0.01" value={importes[x.id]??""} onChange={(e)=>setImportes({...importes,[x.id]:e.target.value})} className="w-28 rounded-lg border p-2 text-right"/></td></tr>)}</tbody></table>{!pendientesVisibles.length&&<div className="p-8 text-center"><b className="block text-green-800">No hay facturas pendientes</b><span className="text-sm text-[var(--texto-suave)]">El proveedor no tiene saldo de deuda para imputar.</span></div>}</section><form onSubmit={registrarPago} className="h-fit rounded-2xl border p-5"><h3 className="font-semibold">Registrar pago</h3><p className="mt-1 text-xs text-[var(--texto-suave)]">Si no se imputa a una factura, quedará disponible para conciliar después.</p><label className="mt-4 block text-xs font-bold uppercase text-[var(--texto-suave)]">Total pagado<input type="number" min="0.01" step="0.01" placeholder={`Automático: ${totalImputado.toFixed(2)}`} value={totalDocumento} onChange={(e)=>setTotalDocumento(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Medio<select value={medio} onChange={(e)=>setMedio(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>CHEQUE</option><option>OTRO</option></select></label><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Referencia<input value={referencia} onChange={(e)=>setReferencia(e.target.value)} className="mt-1 block w-full rounded-xl border p-3 text-sm font-normal"/></label><div className="mt-4 rounded-xl bg-[var(--fondo)] p-4"><small>Total imputado ahora</small><b className="block text-xl">{dinero(totalImputado)}</b></div><button disabled={procesando||(!totalDocumento&&totalImputado<=0)} className="mt-4 w-full rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white disabled:opacity-50">Confirmar pago</button></form></div>:<div className="space-y-3">{documentosVisibles.map((d)=><article key={d.id} className="rounded-2xl border p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-[var(--texto-suave)]">PAGO #{d.numero} · {fecha(d.fecha_realizacion)}</span><h3 className="font-semibold">{d.socio_nombre}</h3></div><div className="text-right"><b>{dinero(d.total)}</b><small className="block text-[var(--texto-suave)]">Disponible {dinero(d.disponible)}</small></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{d.medios.map((m,i)=><span key={i} className="rounded-full bg-[var(--fondo)] px-3 py-1">{m.medio}: {dinero(m.importe)}</span>)}</div>{d.imputaciones.length>0&&<table className="mt-4 w-full text-sm"><tbody>{d.imputaciones.map((i)=><tr key={i.id} className="border-t"><td className="py-2">Factura {i.documento_id.slice(0,8)}</td><td>{i.estado}</td><td className="text-right">{dinero(i.importe)}</td><td className="text-right">{i.estado==="ACTIVA"&&<button type="button" onClick={async()=>{const motivo=prompt("Motivo de anulacion (minimo 5 caracteres)");if(motivo)await enviar(`/tesoreria/conciliaciones/proveedores/${i.id}/anular`,{motivo})}} className="text-xs font-semibold text-red-700">Anular</button>}</td></tr>)}</tbody></table>}{Number(d.disponible)>0&&pendientesVisibles.length>0&&<div className="mt-4 rounded-xl border border-dashed p-4"><p className="text-sm font-semibold">Aplicar pago disponible</p><div className="mt-2 grid gap-2 md:grid-cols-2">{pendientesVisibles.map((x)=><label key={x.id} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--fondo)] p-2 text-xs"><span>{x.numero_externo||`#${x.numero}`} · saldo {dinero(x.saldo_pendiente)}</span><input type="number" min="0" max={Math.min(Number(x.saldo_pendiente),Number(d.disponible))} step="0.01" value={importesConciliacion[`${d.id}:${x.id}`]??""} onChange={(e)=>setImportesConciliacion({...importesConciliacion,[`${d.id}:${x.id}`]:e.target.value})} className="w-28 rounded-lg border bg-white p-2 text-right"/></label>)}</div><button type="button" onClick={()=>void conciliarPendiente(d)} disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Conciliar seleccionadas</button></div>}</article>)}{!documentosVisibles.length&&<p className="p-10 text-center text-sm text-[var(--texto-suave)]">El proveedor todavía no tiene pagos registrados.</p>}</div>}</div></section></div>}

      {tab === "ventas" && <div className="mt-6 overflow-x-auto rounded-2xl border bg-white p-4"><table data-exportar-excel="true" className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Fecha</th><th className="p-2">Comprobante</th><th className="p-2">Cliente</th><th className="p-2">Estado</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th></tr></thead><tbody>{ventas.map((x) => <tr key={x.id} className="border-b last:border-0"><td className="p-2">{fecha(x.fecha)}</td><td className="p-2">{x.letra} #{x.numero} · {x.tipo_documento}</td><td className="p-2">{x.socio_nombre}</td><td className="p-2">{x.estado}</td><td className="p-2 text-right">{dinero(x.total)}</td><td className="p-2 text-right font-semibold">{dinero(x.saldo_pendiente)}</td></tr>)}</tbody></table></div>}

      {tab === "caja" && <div className="mt-6"><label className="block max-w-lg text-xs font-bold uppercase text-[var(--texto-suave)]">Apertura a controlar<select value={aperturaId} onChange={(e) => setAperturaId(e.target.value)} className="mt-1 block w-full rounded-xl border bg-white p-3 text-sm font-normal"><option value="">Sin cajas abiertas</option>{aperturas.map((x) => <option key={x.id} value={x.id}>{x.punto_venta_codigo} / {x.caja_codigo} · {x.usuario_nombre}</option>)}</select></label>{control && <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Ventas", control.total_ventas], ["Cobros", control.total_cobros], ["Pagos", control.total_pagos], ["Ingresos", control.total_ingresos], ["Egresos", control.total_egresos]].map(([t, v]) => <article key={t} className="rounded-xl border bg-white p-4"><small className="text-[var(--texto-suave)]">{t}</small><strong className="block text-lg">{dinero(v)}</strong></article>)}</div><div className="mt-5 grid gap-5 xl:grid-cols-3">
          <form onSubmit={registrarMovimiento} className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Movimiento manual</h2><div className="mt-4 flex gap-2"><select value={movTipo} onChange={(e) => setMovTipo(e.target.value as "INGRESO" | "EGRESO")} className="rounded-lg border p-2"><option>INGRESO</option><option>EGRESO</option></select><input required type="number" min="0.01" step="0.01" placeholder="Importe" value={movImporte} onChange={(e) => setMovImporte(e.target.value)} className="min-w-0 flex-1 rounded-lg border p-2" /></div><input required placeholder="Concepto" value={movConcepto} onChange={(e) => setMovConcepto(e.target.value)} className="mt-3 w-full rounded-lg border p-2" /><button disabled={procesando} className="mt-3 rounded-lg bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white">Registrar</button></form>
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Arqueo de efectivo</h2><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(denominaciones).map(([d, c]) => <label key={d} className="flex items-center gap-2 text-sm"><span className="w-20">{dinero(d)}</span><input type="number" min="0" placeholder="Cant." value={c} onChange={(e) => setDenominaciones({ ...denominaciones, [d]: e.target.value })} className="min-w-0 flex-1 rounded-lg border p-2" /></label>)}</div><p className="mt-3 text-sm">Contado: <strong>{dinero(efectivoArqueo)}</strong> · Esperado: <strong>{dinero(control.medios.find((x) => x.medio === "EFECTIVO")?.esperado)}</strong></p><button onClick={arquear} disabled={procesando} className="mt-3 rounded-lg border border-[var(--marca)] px-4 py-2 text-sm font-semibold text-[var(--marca)]">Guardar arqueo</button></div>
          <div className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Cierre definitivo</h2><div className="mt-3 space-y-2">{control.medios.map((x) => <div key={x.medio} className="flex justify-between rounded-lg bg-[var(--fondo)] p-2 text-sm"><span>{x.medio}</span><strong>{dinero(x.esperado)}</strong></div>)}</div><label className="mt-3 block text-xs font-bold uppercase text-[var(--texto-suave)]">Efectivo declarado<input type="number" min="0" step="0.01" value={declarado} onChange={(e) => setDeclarado(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm font-normal" /></label><textarea placeholder="Observaciones" value={observacion} onChange={(e) => setObservacion(e.target.value)} className="mt-3 w-full rounded-lg border p-2 text-sm" /><button onClick={cerrar} disabled={procesando || declarado === ""} className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Cerrar caja</button></div>
        </div></>}</div>}

      {tab === "cierres" && <div className="mt-6 space-y-4">{cierres.map((c) => <article key={c.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs uppercase text-[var(--texto-suave)]">{c.punto_venta} / {c.caja}</span><h2 className="font-semibold">Cierre de {c.usuario}</h2><small>{fecha(c.fecha_cierre)}</small></div><div className={`rounded-xl px-4 py-2 text-right ${Number(c.diferencia) === 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}><small>Diferencia de efectivo</small><strong className="block text-lg">{dinero(c.diferencia)}</strong></div></div><div className="mt-4 grid gap-2 sm:grid-cols-4"><span>Ventas: <b>{dinero(c.total_ventas)}</b></span><span>Cobros: <b>{dinero(c.total_cobros)}</b></span><span>Esperado: <b>{dinero(c.efectivo_esperado)}</b></span><span>Declarado: <b>{dinero(c.efectivo_declarado)}</b></span></div><details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-[var(--marca)]">Ver control por medio</summary><table className="mt-2 w-full"><tbody>{c.medios.map((m) => <tr key={m.medio} className="border-t"><td className="py-2">{m.medio}</td><td className="text-right">Esperado {dinero(m.esperado)}</td><td className="text-right">Declarado {dinero(m.declarado)}</td><td className="text-right">Diferencia {dinero(m.diferencia)}</td></tr>)}</tbody></table></details></article>)}</div>}
    </section>
  </main>;
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
  return <section className="mb-5 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--marca)]">Listado general</p><h2 className="text-xl font-semibold">Cuentas corrientes de clientes</h2><p className="text-sm text-[var(--texto-suave)]">Vea quién debe, quién tiene dinero a favor y abra su cuenta completa.</p></div>
      <div className="flex gap-2 text-right"><div className="rounded-xl bg-red-50 px-4 py-2"><small className="block text-red-700">Total por cobrar</small><b className="text-red-800">{dinero(totalDeuda)}</b></div><div className="rounded-xl bg-green-50 px-4 py-2"><small className="block text-green-700">Total a favor</small><b className="text-green-800">{dinero(totalFavor)}</b></div></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]"><input value={busqueda} onChange={(e)=>cambiarBusqueda(e.target.value)} placeholder="Buscar por nombre, código o documento" className="rounded-xl border p-3"/><select value={filtro} onChange={(e)=>cambiarFiltro(e.target.value as typeof filtro)} className="rounded-xl border p-3"><option value="MOVIMIENTOS">Con deuda o saldo a favor</option><option value="DEUDA">Solamente con deuda</option><option value="FAVOR">Solamente saldo a favor</option><option value="TODOS">Todos los clientes</option></select></div>
    <div className="mt-4 overflow-x-auto"><table data-exportar-excel="true" className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Código</th><th className="p-2">Cliente</th><th className="p-2">Documento</th><th className="p-2">Estado cuenta</th><th className="p-2 text-right">Documentos pendientes</th><th className="p-2">Deuda más antigua</th><th className="p-2 text-right">Deuda</th><th className="p-2 text-right">Saldo a favor</th><th className="p-2">Acción</th></tr></thead><tbody>{cuentas.map((cuenta)=><tr key={cuenta.socio_id} className="border-b last:border-0"><td className="p-2 font-mono">{cuenta.codigo}</td><td className="p-2 font-semibold">{cuenta.razon_social}</td><td className="p-2">{cuenta.numero_documento}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${cuenta.cuenta_activa?"bg-green-50 text-green-800":"bg-gray-100 text-gray-700"}`}>{cuenta.cuenta_configurada?(cuenta.cuenta_activa?"ACTIVA":"INACTIVA"):"SIN CONFIGURAR"}</span></td><td className="p-2 text-right">{cuenta.documentos_pendientes}</td><td className="p-2">{cuenta.deuda_mas_antigua?fecha(cuenta.deuda_mas_antigua):"—"}</td><td className="p-2 text-right font-semibold text-red-700">{dinero(cuenta.deuda_actual)}</td><td className="p-2 text-right font-semibold text-green-700">{dinero(cuenta.saldo_favor)}</td><td className="p-2"><button type="button" onClick={()=>abrirCuenta(cuenta)} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-xs font-semibold text-[var(--marca)]">Abrir cuenta</button></td></tr>)}</tbody></table>{!cuentas.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay clientes que coincidan con el filtro.</p>}</div>
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
    <div className="mt-4 overflow-x-auto"><table data-exportar-excel="true" className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-[var(--texto-suave)]"><th className="p-2">Código</th><th className="p-2">Proveedor</th><th className="p-2">Documento</th><th className="p-2 text-right">Facturas pendientes</th><th className="p-2">Deuda más antigua</th><th className="p-2 text-right">Deuda</th><th className="p-2 text-right">Pagos sin aplicar</th><th className="p-2">Acción</th></tr></thead><tbody>{cuentas.map((cuenta)=><tr key={cuenta.socio_id} className="border-b last:border-0"><td className="p-2 font-mono">{cuenta.codigo}</td><td className="p-2 font-semibold">{cuenta.razon_social}</td><td className="p-2">{cuenta.numero_documento}</td><td className="p-2 text-right">{cuenta.documentos_pendientes}</td><td className="p-2">{cuenta.deuda_mas_antigua?fecha(cuenta.deuda_mas_antigua):"—"}</td><td className="p-2 text-right font-semibold text-red-700">{dinero(cuenta.deuda_actual)}</td><td className="p-2 text-right font-semibold text-green-700">{dinero(cuenta.saldo_favor)}</td><td className="p-2"><button type="button" onClick={()=>abrirCuenta(cuenta)} className="rounded-lg border border-[var(--marca)] px-3 py-2 text-xs font-semibold text-[var(--marca)]">Abrir cuenta</button></td></tr>)}</tbody></table>{!cuentas.length&&<p className="p-8 text-center text-sm text-[var(--texto-suave)]">No hay proveedores que coincidan con el filtro.</p>}</div>
  </section>;
}
