"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import BuscadorArticulo, { ArticuloBuscado } from "@/components/BuscadorArticulo";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type Almacen = { id: string; codigo: string; descripcion: string; activo: boolean; es_predeterminado: boolean };
type Socio = { id: string; codigo: string; razon_social: string; numero_documento: string; activo: boolean };
type Linea = ArticuloBuscado & { cantidad: number; precio: number; lista: string; total: number };
type Pago = { medio: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "OTRO"; importe: string; referencia: string };
type Venta = { numero: number; cobro_numero: number | null; total_bruto: string; saldo_pendiente: string };

export default function PuntoVenta() {
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacen, setAlmacen] = useState("");
  const [cliente, setCliente] = useState<Socio | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const total = lineas.reduce((suma, linea) => suma + linea.total, 0);
  const pagado = pagos.reduce((suma, pago) => suma + Number(pago.importe || 0), 0);

  useEffect(() => {
    async function cargar() {
      const respuesta = await fetch(`${apiUrl}/articulos/almacenes`, { credentials: "include" });
      if (!respuesta.ok) return;
      const datos: Almacen[] = await respuesta.json();
      setAlmacenes(datos);
      setAlmacen(datos.find((x) => x.es_predeterminado && x.activo)?.id ?? datos.find((x) => x.activo)?.id ?? "");
    }
    void cargar();
  }, []);

  useEffect(() => {
    function accesoRapido(e: globalThis.KeyboardEvent) {
      const elemento = e.target as HTMLElement;
      const estaEscribiendo = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(elemento.tagName)
        || elemento.isContentEditable;
      if (e.key === "Escape" && cobroAbierto) {
        e.preventDefault();
        setCobroAbierto(false);
      } else if (e.code === "Space" && !estaEscribiendo && !cobroAbierto && lineas.length > 0) {
        e.preventDefault();
        setPagos((actuales) => actuales.length === 1 && !actuales[0].importe
          ? [{ ...actuales[0], importe: total.toFixed(2) }]
          : actuales);
        setCobroAbierto(true);
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
    return { precio: Number(datos[0].precio_venta_bruto), lista: lista.nombre };
  }

  async function agregarArticulo(articulo: ArticuloBuscado | null) {
    if (!articulo) return;
    setMensaje("");
    try {
      const existente = lineas.find((x) => x.id === articulo.id);
      const cantidad = (existente?.cantidad ?? 0) + 1;
      const precio = await cotizar(articulo, cantidad);
      const siguiente = existente
        ? lineas.map((x) => x.id === articulo.id ? { ...x, cantidad, ...precio, total: cantidad * precio.precio } : x)
        : [...lineas, { ...articulo, cantidad, ...precio, total: precio.precio }];
      setLineas(siguiente);
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
    if (!cliente || !almacen || !lineas.length) return;
    setProcesando(true);
    setMensaje("");
    const pagosValidos = pagos.filter((x) => Number(x.importe) > 0);
    const respuesta = await fetch(`${apiUrl}/articulos/pos/ventas`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: cliente.id,
        almacen_id: almacen,
        lineas: lineas.map((x) => ({ articulo_id: x.id, cantidad_base: x.cantidad })),
        pagos: pagosValidos.map((x) => ({ ...x, importe: Number(x.importe), referencia: x.referencia || null })),
      }),
    });
    const datos = await respuesta.json();
    setProcesando(false);
    if (!respuesta.ok) {
      setMensaje(datos.detail ?? "No se pudo confirmar la venta");
      return;
    }
    const venta: Venta = datos;
    setMensaje(`Venta #${venta.numero} confirmada${venta.cobro_numero ? ` · Cobro #${venta.cobro_numero}` : ""} · Saldo pendiente $${Number(venta.saldo_pendiente).toFixed(2)}`);
    setLineas([]);
    setPagos([{ medio: "EFECTIVO", importe: "", referencia: "" }]);
    setCobroAbierto(false);
  }

  return (
    <main className="listas-precios-pagina p-6 sm:p-9">
      <header className="border-b pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Ventas</p>
        <h1 className="text-3xl font-semibold">Punto de venta</h1>
        <p className="text-sm text-[var(--texto-suave)]">Documento interno de venta. Sin facturacion electronica.</p>
      </header>
      <section className="sticky top-0 z-30 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-3 shadow-sm">
        <div><small className="font-semibold uppercase tracking-wider text-[var(--texto-suave)]">Total de la venta</small><b className="block text-3xl text-[var(--marca)]">${total.toFixed(2)}</b></div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--texto-suave)]">Presione <kbd className="rounded border bg-[var(--fondo)] px-2 py-1 font-semibold">ESPACIO</kbd> para cobrar</span>
          <button type="button" disabled={!lineas.length} onClick={() => { if (pagos.length === 1 && !pagos[0].importe) setPagos([{ ...pagos[0], importe: total.toFixed(2) }]); setCobroAbierto(true); }} className="rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40">Cobrar</button>
        </div>
      </section>
      {mensaje && <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">{mensaje}</p>}
      <form onSubmit={confirmar} className="mt-5 space-y-5">
        <section className="grid gap-4 rounded-2xl border bg-white p-5 lg:grid-cols-2">
          <label className="text-sm font-semibold">Cliente<BuscadorCliente seleccionar={setCliente} /></label>
          <label className="text-sm font-semibold">Almacen<select className="mt-1 w-full rounded-xl border p-3" value={almacen} onChange={(e) => setAlmacen(e.target.value)} required><option value="">Seleccionar</option>{almacenes.filter((x) => x.activo).map((x) => <option key={x.id} value={x.id}>{x.codigo} - {x.descripcion}</option>)}</select></label>
          <label className="text-sm font-semibold lg:col-span-2">Agregar producto<BuscadorArticulo soloInventario={false} seleccionar={(x) => void agregarArticulo(x)} /></label>
        </section>
        <section className="overflow-x-auto rounded-2xl border bg-white p-5">
          <table className="min-w-[850px] w-full text-left text-sm"><thead><tr className="text-xs uppercase text-[var(--texto-suave)]"><th className="p-3">Articulo</th><th>Cantidad base</th><th>Lista</th><th>Precio bruto</th><th>Total</th><th></th></tr></thead><tbody>{lineas.map((x) => <tr key={x.id} className="border-t"><td className="p-3"><b>{x.codigo}</b><small className="block">{x.descripcion}</small></td><td><input className="w-28 rounded-lg border p-2" type="number" min="0.000001" step="0.000001" value={x.cantidad} onChange={(e) => void cambiarCantidad(x.id, Number(e.target.value))} /></td><td>{x.lista}</td><td>${x.precio.toFixed(2)}</td><td className="font-semibold">${x.total.toFixed(2)}</td><td><button type="button" className="rounded-lg border border-red-200 px-3 py-2 text-red-700" onClick={() => setLineas(lineas.filter((l) => l.id !== x.id))}>Quitar</button></td></tr>)}</tbody></table>
          {!lineas.length && <p className="p-6 text-center text-sm text-[var(--texto-suave)]">Agregue productos para iniciar la venta.</p>}
        </section>
        {cobroAbierto && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-cobro"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between border-b pb-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">Punto de venta</p><h2 id="titulo-cobro" className="text-2xl font-semibold">Cobrar venta</h2></div><button type="button" aria-label="Cerrar cobro" onClick={() => setCobroAbierto(false)} className="rounded-lg border px-3 py-2 font-semibold">×</button></div>
          <div className="my-5 grid grid-cols-3 gap-3 rounded-xl bg-[var(--fondo)] p-4 text-right"><div><small>Total</small><b className="block text-2xl">${total.toFixed(2)}</b></div><div><small>Pagado</small><b className="block text-2xl">${pagado.toFixed(2)}</b></div><div><small>Saldo</small><b className="block text-2xl text-[var(--marca)]">${Math.max(total - pagado, 0).toFixed(2)}</b></div></div>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Cobro</h2><button type="button" className="rounded-lg border px-3 py-2 text-sm font-semibold text-[var(--marca)]" onClick={() => setPagos([...pagos, { medio: "TARJETA", importe: "", referencia: "" }])}>Agregar medio</button></div>
          <div className="space-y-2">{pagos.map((pago, indice) => <div key={indice} className="grid gap-2 md:grid-cols-[180px_160px_1fr_auto]"><select className="rounded-xl border p-3" value={pago.medio} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, medio: e.target.value as Pago["medio"] } : x))}><option>EFECTIVO</option><option>TARJETA</option><option>TRANSFERENCIA</option><option>OTRO</option></select><input autoFocus={indice === 0} className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Importe" value={pago.importe} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, importe: e.target.value } : x))} /><input className="rounded-xl border p-3" placeholder="Referencia opcional" value={pago.referencia} onChange={(e) => setPagos(pagos.map((x, i) => i === indice ? { ...x, referencia: e.target.value } : x))} /><button type="button" className="rounded-lg border px-3" onClick={() => setPagos(pagos.filter((_, i) => i !== indice))}>Quitar</button></div>)}</div>
          <div className="mt-5 flex flex-wrap items-end justify-end gap-6 border-t pt-4 text-right"><div><small>Total bruto</small><b className="block text-xl">${total.toFixed(2)}</b></div><div><small>Pagado</small><b className="block text-xl">${pagado.toFixed(2)}</b></div><div><small>Saldo / cuenta corriente</small><b className="block text-xl">${Math.max(total - pagado, 0).toFixed(2)}</b></div><button disabled={procesando || !cliente || !almacen || !lineas.length || pagado > total} className="rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40">{procesando ? "Confirmando..." : "Confirmar venta"}</button></div>
          <p className="mt-3 text-xs text-[var(--texto-suave)]">Si queda saldo pendiente, el cliente debe tener cuenta corriente activa y limites disponibles. Presione ESC para cerrar.</p>
        </section></div>}
      </form>
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
