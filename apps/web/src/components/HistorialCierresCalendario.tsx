"use client";

import { apiFetch } from "@/api";
import { formatearMoneda } from "@/formato";
import { useCallback, useEffect, useMemo, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type Cierre = {
  id: string;
  apertura_id: string;
  caja: string;
  punto_venta: string;
  usuario: string;
  periodo_operativo: string;
  fecha_apertura: string;
  fecha_cierre: string;
  cantidad_ventas: number;
  total_ventas: string;
  total_cobros: string;
  total_pagos: string;
  efectivo_esperado: string;
  efectivo_declarado: string;
  diferencia: string;
  observacion: string | null;
  medios: { medio: string; esperado: string; declarado: string; diferencia: string }[];
};

const fechaPeriodo = (valor: string) => new Date(`${valor}T00:00:00`);
const hora = (valor: string) => new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(valor));
const diasSemana = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export default function HistorialCierresCalendario() {
  const [dia, setDia] = useState("");
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const parametros = new URLSearchParams({ limite: dia || mesSeleccionado ? "1000" : "500" });
    if (dia) parametros.set("periodo", dia);
    else if (mesSeleccionado) {
      const [anio, mes] = mesSeleccionado.split("-").map(Number);
      const ultimoDia = new Date(anio, mes, 0).getDate();
      parametros.set("desde", `${mesSeleccionado}-01`);
      parametros.set("hasta", `${mesSeleccionado}-${String(ultimoDia).padStart(2, "0")}`);
    }
    try {
      const respuesta = await apiFetch(
        `${apiUrl}/tesoreria/cajas/cierres/historial?${parametros.toString()}`,
        { credentials: "include" },
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detail ?? "No se pudieron cargar los cierres");
      setCierres(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los cierres");
    } finally {
      setCargando(false);
    }
  }, [dia, mesSeleccionado]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 180);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  const meses = useMemo(() => {
    const agrupados = new Map<string, Map<string, Cierre[]>>();
    cierres.forEach((cierre) => {
      const mes = cierre.periodo_operativo.slice(0, 7);
      if (!agrupados.has(mes)) agrupados.set(mes, new Map());
      const dias = agrupados.get(mes)!;
      if (!dias.has(cierre.periodo_operativo)) dias.set(cierre.periodo_operativo, []);
      dias.get(cierre.periodo_operativo)!.push(cierre);
    });
    return [...agrupados.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, dias]) => ({
        mes,
        dias: [...dias.entries()].sort(([a], [b]) => b.localeCompare(a)),
      }));
  }, [cierres]);

  return (
    <div className="mt-6">
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="min-w-[240px] text-xs font-bold uppercase text-[var(--texto-suave)]">
              Filtrar por mes
              <input
                type="month"
                value={mesSeleccionado}
                onChange={(evento) => {
                  setMesSeleccionado(evento.target.value);
                  if (evento.target.value) setDia("");
                }}
                className="mt-1 block w-full rounded-xl border p-3 text-base font-normal"
              />
            </label>
            <label className="min-w-[240px] text-xs font-bold uppercase text-[var(--texto-suave)]">
              Buscar día operativo
              <input
                type="date"
                value={dia}
                onChange={(evento) => {
                  setDia(evento.target.value);
                  if (evento.target.value) setMesSeleccionado("");
                }}
                className="mt-1 block w-full rounded-xl border p-3 text-base font-normal"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--texto-suave)]">
              {cargando ? "Buscando…" : `${cierres.length} ${cierres.length === 1 ? "cierre" : "cierres"}`}
            </span>
            {(dia || mesSeleccionado) && (
              <button type="button" onClick={() => { setDia(""); setMesSeleccionado(""); }} className="rounded-xl border px-4 py-3 text-sm font-semibold text-[var(--marca)]">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-[var(--texto-suave)]">
          Cada fecha es un período operativo y puede contener varios cierres de cajas o turnos.
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</p>}

      <div className="mt-5 space-y-8">
        {meses.map(({ mes, dias }) => {
          const fechaMes = fechaPeriodo(`${mes}-01`);
          const tituloMes = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" })
            .format(fechaMes)
            .toLocaleUpperCase("es-AR");
          const [anio, numeroMes] = mes.split("-").map(Number);
          const cantidadDias = new Date(anio, numeroMes, 0).getDate();
          const espaciosIniciales = (new Date(anio, numeroMes - 1, 1).getDay() + 6) % 7;
          const cantidadCeldas = Math.ceil((espaciosIniciales + cantidadDias) / 7) * 7;
          const cierresPorDia = new Map(dias);
          return (
            <section key={mes} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-3 bg-[var(--marca)] px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-11 w-11 place-content-center rounded-xl border border-white/40 bg-white/10 text-sm font-bold">
                    {new Intl.DateTimeFormat("es-AR", { month: "short" }).format(fechaMes).toLocaleUpperCase("es-AR")}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Calendario de cierres</p>
                    <h2 className="text-2xl font-bold tracking-wide" style={{ color: "white" }}>{tituloMes}</h2>
                  </div>
                </div>
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold text-white">
                  {dias.reduce((total, [, items]) => total + items.length, 0)} cierres
                </span>
              </header>

              <div className="overflow-x-auto">
                <div className="min-w-[1400px]">
                  <div className="grid grid-cols-7 border-b bg-[var(--fondo)]">
                    {diasSemana.map((nombre) => (
                      <div key={nombre} className="border-r px-3 py-2 text-center text-xs font-bold tracking-widest text-[var(--texto-suave)] last:border-r-0">
                        {nombre}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {Array.from({ length: cantidadCeldas }, (_, indice) => {
                      const numeroDia = indice - espaciosIniciales + 1;
                      const perteneceAlMes = numeroDia >= 1 && numeroDia <= cantidadDias;
                      if (!perteneceAlMes) {
                        return <div key={`vacio-${indice}`} aria-hidden="true" className="min-h-[190px] border-b border-r bg-[var(--fondo)] opacity-50" />;
                      }
                      const fecha = `${mes}-${String(numeroDia).padStart(2, "0")}`;
                      const items = cierresPorDia.get(fecha) ?? [];
                      return (
                        <section key={fecha} className={`min-h-[190px] border-b border-r p-2 ${items.length ? "bg-[var(--marca-clara)]" : "bg-white"}`}>
                          <header className="mb-2 flex items-center justify-between border-b pb-1">
                            <time dateTime={fecha} className={`grid h-8 w-8 place-content-center rounded-full text-base font-bold ${items.length ? "bg-[var(--marca)] text-white" : "text-[var(--texto-suave)]"}`}>
                              {numeroDia}
                            </time>
                            {items.length > 0 && <span className="text-xs font-semibold text-[var(--marca)]">{items.length} {items.length === 1 ? "cierre" : "cierres"}</span>}
                          </header>
                          <div className="space-y-2">
                            {items.map((cierre) => (
                              <article key={cierre.id} className="rounded-lg border bg-white p-2 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="block truncate text-[11px] font-semibold uppercase text-[var(--texto-suave)]">{cierre.punto_venta} / {cierre.caja}</span>
                                    <h3 className="truncate text-sm font-semibold">{cierre.usuario}</h3>
                                  </div>
                                  <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${Number(cierre.diferencia) === 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>
                                    {formatearMoneda(cierre.diferencia)}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-[var(--texto-suave)]">{hora(cierre.fecha_apertura)} → {hora(cierre.fecha_cierre)}</p>
                                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                  <span>Ventas<b className="block">{formatearMoneda(cierre.total_ventas)}</b></span>
                                  <span>Declarado<b className="block">{formatearMoneda(cierre.efectivo_declarado)}</b></span>
                                </div>
                                <details className="mt-2 border-t pt-2 text-xs">
                                  <summary className="cursor-pointer font-semibold text-[var(--marca)]">Ver cierre completo</summary>
                                  <div className="mt-2 space-y-1">
                                    <p>Cobros <b>{formatearMoneda(cierre.total_cobros)}</b></p>
                                    <p>Pagos <b>{formatearMoneda(cierre.total_pagos)}</b></p>
                                    <p>Esperado <b>{formatearMoneda(cierre.efectivo_esperado)}</b></p>
                                    {cierre.medios.map((medio) => (
                                      <div key={medio.medio} className="border-t pt-1">
                                        <b>{medio.medio}</b>
                                        <span className="block">Esperado {formatearMoneda(medio.esperado)}</span>
                                        <span className="block">Declarado {formatearMoneda(medio.declarado)}</span>
                                      </div>
                                    ))}
                                    {cierre.observacion && <p className="border-t pt-1"><b>Observación:</b> {cierre.observacion}</p>}
                                  </div>
                                </details>
                              </article>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {!cargando && !error && !cierres.length && (
        <div className="mt-5 rounded-2xl border bg-white p-10 text-center text-[var(--texto-suave)]">
          No hay cierres para el día seleccionado.
        </div>
      )}
    </div>
  );
}
