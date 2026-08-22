"use client";

import { apiFetch } from "@/api";
import TablaOrdenable from "@/components/TablaOrdenable";
import { FormEvent, useCallback, useEffect, useState } from "react";
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Registro = {
  id: string;
  codigo?: string;
  activo: boolean;
  tipo?: string;
  nombre?: string;
  padre_id?: string | null;
  descripcion?: string;
  ubicacion?: string | null;
  es_predeterminado?: boolean;
};
export default function MaestroConfiguracionArticulos({
  modo,
}: {
  modo: "clasificadores" | "almacenes";
}) {
  const esClasificador = modo === "clasificadores";
  const [lista, setLista] = useState<Registro[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState<Registro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("");
  const [nombre, setNombre] = useState("");
  const [padre, setPadre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [activo, setActivo] = useState(true);
  const [predeterminado, setPredeterminado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const cargar = useCallback(async () => {
    const r = await apiFetch(`${apiUrl}/articulos/${modo}`, {
      credentials: "include",
    });
    if (r.ok) setLista(await r.json());
  }, [modo]);
  useEffect(() => {
    const t = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(t);
  }, [cargar]);
  function nuevo() {
    setActual(null);
    setCodigo("");
    setTipo("");
    setNombre("");
    setPadre("");
    setUbicacion("");
    setActivo(true);
    setPredeterminado(false);
    setAbierto(true);
  }
  function editar(x: Registro) {
    setActual(x);
    setCodigo(x.codigo ?? "");
    setTipo(x.tipo ?? "");
    setNombre(esClasificador ? (x.nombre ?? "") : (x.descripcion ?? ""));
    setPadre(x.padre_id ?? "");
    setUbicacion(x.ubicacion ?? "");
    setActivo(x.activo);
    setPredeterminado(x.es_predeterminado ?? false);
    setAbierto(true);
  }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    const body = esClasificador
      ? {
          tipo,
          nombre,
          padre_id: padre || null,
          ...(actual ? { activo } : {}),
        }
      : {
          codigo,
          descripcion: nombre,
          ubicacion: ubicacion || null,
          ...(actual ? { activo, es_predeterminado: predeterminado } : {}),
        };
    const r = await apiFetch(
      `${apiUrl}/articulos/${modo}${actual ? `/${actual.id}` : ""}`,
      {
        method: actual ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) {
      const d = await r.json();
      setMensaje(d.detail ?? "No se pudo guardar");
      return;
    }
    setAbierto(false);
    setMensaje(actual ? "Registro actualizado" : "Registro creado");
    await cargar();
  }
  async function eliminar(x:Registro){if(!window.confirm(`¿Eliminar ${esClasificador?x.nombre:x.descripcion}?`))return;const r=await apiFetch(`${apiUrl}/articulos/${modo}/${x.id}`,{method:"DELETE",credentials:"include"});if(!r.ok){const d=await r.json().catch(()=>null);setMensaje(d?.detail??"No se pudo eliminar");return}setMensaje("Registro eliminado");await cargar()}
  const titulo = esClasificador ? "Clasificadores de articulos" : "Almacenes";
  return (
    <main className="p-6 sm:p-9">
      <section>
        <header className="flex items-center justify-between border-b border-[var(--borde)] pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
              Datos maestros
            </p>
            <h1 className="mt-1 text-3xl font-semibold">{titulo}</h1>
            <p className="mt-1 text-sm text-[var(--texto-suave)]">
              {esClasificador
                ? "Categorias, subcategorias, marcas, rubros y nuevas jerarquias."
                : "Depositos fisicos en los que se controla el stock."}
            </p>
          </div>
          <button
            onClick={nuevo}
            className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
          >
            Nuevo {esClasificador ? "clasificador" : "almacen"}
          </button>
        </header>
        {mensaje && (
          <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">
            {mensaje}
          </p>
        )}
        <div className="mt-5 rounded-2xl border border-[var(--borde)] bg-white p-4">
          <TablaOrdenable className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-[var(--texto-suave)]">
                {!esClasificador && <th className="p-3">Codigo</th>}
                {esClasificador && <th className="p-3">Tipo</th>}
                <th>{esClasificador ? "Nombre" : "Descripcion"}</th>
                <th>{esClasificador ? "Clasificador padre" : "Ubicacion"}</th>
                <th>Estado</th>
                <th className="w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className="border-t border-[var(--borde)]">
                  {!esClasificador && <td className="p-3 font-mono font-semibold">{x.codigo}</td>}
                  {esClasificador && <td className="p-3 font-semibold">{x.tipo}</td>}
                  <td>
                    {esClasificador ? x.nombre : x.descripcion}
                    {x.es_predeterminado ? " · PREDETERMINADO" : ""}
                  </td>
                  <td>{esClasificador ? lista.find(p=>p.id===x.padre_id)?.nombre||"Sin padre" : x.ubicacion || "—"}</td>
                  <td>{x.activo ? "ACTIVO" : "INACTIVO"}</td>
                  <td className="flex gap-2 py-2">
                    <button
                      title="Editar"
                      onClick={() => editar(x)}
                      className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]"
                    >
                      ⚙ Editar
                    </button>
                    {x.activo&&<button onClick={()=>void eliminar(x)} className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700">Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaOrdenable>
        </div>
        {abierto && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAbierto(false);
            }}
          >
            <form
              onSubmit={guardar}
              className="w-full max-w-xl rounded-2xl bg-white p-6"
            >
              <div className="flex justify-between">
                <h2 className="text-xl font-semibold">
                  {actual ? "Editar" : "Nuevo"}{" "}
                  {esClasificador ? "clasificador" : "almacen"}
                </h2>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {esClasificador && (
                  <label className="text-sm">
                    Tipo
                    <input
                      className="mt-1 w-full rounded-xl border p-2"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      placeholder="Ej.: RUBRO"
                      required
                    />
                  </label>
                )}
                {!esClasificador && <label className="text-sm">
                  Codigo
                  <input
                    className="mt-1 w-full rounded-xl border p-2"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    required
                  />
                </label>}
                <label className="text-sm">
                  {esClasificador ? "Nombre" : "Descripcion"}
                  <input
                    className="mt-1 w-full rounded-xl border p-2"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </label>
                {esClasificador ? (
                  <>
                    <label className="text-sm">
                      Clasificador padre
                      <select
                        className="mt-1 w-full rounded-xl border p-2"
                        value={padre}
                        onChange={(e) => setPadre(e.target.value)}
                      >
                        <option value="">Sin padre</option>
                        {lista
                          .filter((x) => x.id !== actual?.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nombre}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <label className="text-sm sm:col-span-2">
                    Ubicacion (opcional)
                    <input
                      className="mt-1 w-full rounded-xl border p-2"
                      value={ubicacion}
                      onChange={(e) => setUbicacion(e.target.value)}
                    />
                  </label>
                )}
                {actual && (
                  <>
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) => setActivo(e.target.checked)}
                      />
                      Activo
                    </label>
                    {!esClasificador && (
                      <label className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={predeterminado}
                          onChange={(e) => setPredeterminado(e.target.checked)}
                        />
                        Almacen predeterminado
                      </label>
                    )}
                  </>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="px-4 py-2 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button className="rounded-xl bg-[var(--marca)] px-5 py-2 text-sm font-semibold text-white">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
