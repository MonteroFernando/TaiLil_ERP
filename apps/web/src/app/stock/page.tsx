"use client";

import { apiFetch } from "@/api";

import { FormEvent, useCallback, useEffect, useState } from "react";
import BuscadorArticulo from "@/components/BuscadorArticulo";
import type { ArticuloBuscado } from "@/components/BuscadorArticulo";
import { useRouter } from "next/navigation";
import type { Route } from "next";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
type Pestana =
  | "existencias"
  | "inventarios"
  | "ajuste"
  | "transferencia"
  | "movimientos";
type Almacen = {
  id: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
};
type Clasificador = {
  id: string;
  tipo: string;
  nombre: string;
  activo: boolean;
};
type Existencia = {
  articulo_id: string;
  articulo_codigo: string;
  articulo_descripcion: string;
  almacen_codigo: string;
  cantidad_fisica: string;
  cantidad_pedida: string;
  cantidad_reservada: string;
  cantidad_disponible: string;
  cantidad_disponible_futura: string;
};
type Detalle = {
  id: string;
  articulo_codigo: string;
  articulo_descripcion: string;
  almacen_codigo: string;
  cantidad_base: string;
  saldo_anterior: string;
  saldo_posterior: string;
};
type Movimiento = {
  id: string;
  numero: number;
  tipo: string;
  estado: string;
  observacion: string | null;
  usuario_nombre: string;
  movimiento_revertido_id: string | null;
  fecha_confirmacion: string;
  detalles: Detalle[];
};
type Inventario = {
  id: string;
  numero: number;
  almacen_codigo: string;
  estado: string;
  fecha_creacion: string;
  usuario_creacion: string;
  detalles: { cantidad_contada: string | null }[];
};

export default function PaginaStock() {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>("existencias");
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [clasificadores, setClasificadores] = useState<Clasificador[]>([]);
  const [existencias, setExistencias] = useState<Existencia[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [buscar, setBuscar] = useState("");
  const [almacenFiltro, setAlmacenFiltro] = useState("");
  const [articuloFiltro, setArticuloFiltro] = useState("");
  const [articuloMovimiento, setArticuloMovimiento] = useState("");
  const [almacenMovimiento, setAlmacenMovimiento] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    const parametros = new URLSearchParams();
    if (buscar) parametros.set("buscar", buscar);
    if (almacenFiltro) parametros.set("almacen_id", almacenFiltro);
    if (articuloFiltro) parametros.set("articulo_id", articuloFiltro);
    const [ra, re, rm, ri, rc] = await Promise.all([
      apiFetch(`${apiUrl}/articulos/almacenes`, { credentials: "include" }),
      apiFetch(`${apiUrl}/articulos/stock/existencias?${parametros}`, {
        credentials: "include",
      }),
      articuloMovimiento
        ? apiFetch(
            `${apiUrl}/articulos/stock/movimientos?articulo_id=${articuloMovimiento}${almacenMovimiento ? `&almacen_id=${almacenMovimiento}` : ""}`,
            { credentials: "include" },
          )
        : Promise.resolve(null),
      apiFetch(`${apiUrl}/articulos/stock/inventarios`, {
        credentials: "include",
      }),
      apiFetch(`${apiUrl}/articulos/clasificadores`, { credentials: "include" }),
    ]);
    if (ra.ok) setAlmacenes(await ra.json());
    if (re.ok) setExistencias(await re.json());
    if (rm?.ok) setMovimientos(await rm.json());
    if (!articuloMovimiento) setMovimientos([]);
    if (ri.ok) setInventarios(await ri.json());
    if (rc.ok) setClasificadores(await rc.json());
  }, [
    buscar,
    almacenFiltro,
    articuloFiltro,
    articuloMovimiento,
    almacenMovimiento,
  ]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 200);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  const tabs: [Pestana, string][] = [
    ["existencias", "Existencias"],
    ["inventarios", "Inventarios"],
    ["ajuste", "Nuevo ajuste"],
    ["transferencia", "Nueva transferencia"],
    ["movimientos", "Historial de movimientos"],
  ];
  return (
    <main className="p-6 sm:p-9">
      <header className="border-b border-[var(--borde)] pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
          Stock
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Control de stock</h1>
        <p className="mt-1 text-sm text-[var(--texto-suave)]">
          Existencias actuales e historial completo por articulo y almacen.
        </p>
      </header>
      {mensaje && (
        <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm">
          {mensaje}
        </p>
      )}
      <nav className="mt-5 flex flex-wrap gap-2">
        {tabs.map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${pestana === id ? "bg-[var(--marca)] text-white" : "border bg-white"}`}
          >
            {nombre}
          </button>
        ))}
      </nav>
      {pestana === "existencias" && (
        <Existencias
          buscar={buscar}
          setBuscar={setBuscar}
          almacen={almacenFiltro}
          setAlmacen={setAlmacenFiltro}
          setArticulo={setArticuloFiltro}
          almacenes={almacenes}
          filas={existencias}
        />
      )}
      {pestana === "ajuste" && (
        <FormularioMovimiento
          tipo="ajuste"
          almacenes={almacenes}
          completado={async (m) => {
            setMensaje(`Ajuste ${m.numero} confirmado`);
            setPestana("movimientos");
            await cargar();
          }}
        />
      )}
      {pestana === "inventarios" && (
        <Inventarios
          almacenes={almacenes}
          clasificadores={clasificadores}
          filas={inventarios}
          abrir={(id) => router.push(`/stock/inventarios/${id}` as Route)}
          creado={(id) => router.push(`/stock/inventarios/${id}` as Route)}
          eliminado={(id) =>
            setInventarios((actual) => actual.filter((x) => x.id !== id))
          }
        />
      )}
      {pestana === "transferencia" && (
        <FormularioMovimiento
          tipo="transferencia"
          almacenes={almacenes}
          completado={async (m) => {
            setMensaje(`Transferencia ${m.numero} confirmada`);
            setPestana("movimientos");
            await cargar();
          }}
        />
      )}
      {pestana === "movimientos" && (
        <Movimientos
          filas={movimientos}
          almacenes={almacenes}
          almacen={almacenMovimiento}
          seleccionarAlmacen={setAlmacenMovimiento}
          articuloSeleccionado={articuloMovimiento}
          seleccionarArticulo={setArticuloMovimiento}
        />
      )}
    </main>
  );
}

function Existencias({
  buscar,
  setBuscar,
  almacen,
  setAlmacen,
  setArticulo,
  almacenes,
  filas,
}: {
  buscar: string;
  setBuscar: (v: string) => void;
  almacen: string;
  setAlmacen: (v: string) => void;
  setArticulo: (v: string) => void;
  almacenes: Almacen[];
  filas: Existencia[];
}) {
  return (
    <section className="mt-5 rounded-2xl border bg-white p-5">
      <div className="grid gap-3 md:grid-cols-[1fr_280px]">
        <label className="text-sm font-semibold">
          Articulo
          <BuscadorArticulo
            seleccionar={(x) => setArticulo(x?.id ?? "")}
            cambiarTexto={setBuscar}
          />
        </label>
        <label className="text-sm font-semibold">
          Almacen
          <select
            className="mt-1 w-full rounded-xl border p-3"
            value={almacen}
            onChange={(e) => setAlmacen(e.target.value)}
          >
            <option value="">Todos los almacenes</option>
            {almacenes
              .filter((x) => x.activo)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} - {x.descripcion}
                </option>
              ))}
          </select>
        </label>
      </div>
      {buscar && (
        <small className="mt-2 block text-[var(--texto-suave)]">
          Filtro escrito: {buscar}
        </small>
      )}
      <div className="mt-4 overflow-x-auto">
        <table data-exportar-excel="true" className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--texto-suave)]">
              <th className="p-3">Articulo</th>
              <th>Almacen</th>
              <th>Fisico</th>
              <th>Pedido</th>
              <th>Reservado</th>
              <th>Disponible</th>
              <th>Disponible futuro</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x) => (
              <tr
                key={`${x.articulo_id}-${x.almacen_codigo}`}
                className="border-t"
              >
                <td className="p-3">
                  <b>{x.articulo_codigo}</b>
                  <small className="block">{x.articulo_descripcion}</small>
                </td>
                <td>{x.almacen_codigo}</td>
                <td>{x.cantidad_fisica}</td>
                <td>{x.cantidad_pedida}</td>
                <td>{x.cantidad_reservada}</td>
                <td>{x.cantidad_disponible}</td>
                <td>{x.cantidad_disponible_futura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Inventarios({
  almacenes,
  clasificadores,
  filas,
  abrir,
  creado,
  eliminado,
}: {
  almacenes: Almacen[];
  clasificadores: Clasificador[];
  filas: Inventario[];
  abrir: (id: string) => void;
  creado: (id: string) => void;
  eliminado: (id: string) => void;
}) {
  const [nuevo, setNuevo] = useState(false);
  const [almacen, setAlmacen] = useState("");
  const [clasificador, setClasificador] = useState("");
  const [seleccion, setSeleccion] = useState<ArticuloBuscado[]>([]);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  async function agregarClasificador(id: string) {
    setClasificador(id);
    if (!id) return;
    const r = await apiFetch(`${apiUrl}/articulos?clasificador_ids=${id}`, {
      credentials: "include",
    });
    if (!r.ok) {
      setError("No se pudieron cargar los productos del clasificador");
      return;
    }
    const articulos: ArticuloBuscado[] = await r.json();
    setSeleccion((actual) => [
      ...actual,
      ...articulos.filter(
        (x) => x.habilitado_inventario && !actual.some((a) => a.id === x.id),
      ),
    ]);
  }
  async function agregarTodos() {
    const r = await apiFetch(`${apiUrl}/articulos`, { credentials: "include" });
    if (!r.ok) {
      setError("No se pudieron cargar todos los articulos");
      return;
    }
    const articulos: ArticuloBuscado[] = await r.json();
    setSeleccion(articulos.filter((x) => x.habilitado_inventario));
    setError("");
  }
  async function crear(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch(`${apiUrl}/articulos/stock/inventarios`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        almacen_id: almacen,
        articulo_ids: seleccion.map((x) => x.id),
        observacion: observacion || null,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.detail ?? "No se pudo crear el inventario");
      return;
    }
    creado(d.id);
  }
  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este inventario sin iniciar?")) return;
    const r = await apiFetch(`${apiUrl}/articulos/stock/inventarios/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      eliminado(id);
      return;
    }
    const d = await r.json().catch(() => ({}));
    setError(d.detail ?? "No se pudo eliminar el inventario");
  }
  return (
    <section className="mt-5 space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setNuevo(!nuevo)}
          className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
        >
          Nuevo inventario
        </button>
      </div>
      {nuevo && (
        <form onSubmit={crear} className="rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Preparar conteo</h2>
            <button
              type="button"
              onClick={() => void agregarTodos()}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-[var(--marca)]"
            >
              Contar todos los articulos
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Seleccion
              titulo="Almacen"
              valor={almacen}
              cambiar={setAlmacen}
              opciones={almacenes
                .filter((x) => x.activo)
                .map((x) => [x.id, `${x.codigo} - ${x.descripcion}`])}
            />
            <label className="text-sm">
              Agregar por clasificador
              <select
                className="mt-1 w-full rounded-xl border p-3"
                value={clasificador}
                onChange={(e) => void agregarClasificador(e.target.value)}
              >
                <option value="">Seleccionar clasificador</option>
                {clasificadores
                  .filter((x) => x.activo)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.tipo}: {x.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Agregar un producto
              <BuscadorArticulo
                seleccionar={(x) => {
                  if (x && !seleccion.some((s) => s.id === x.id))
                    setSeleccion([...seleccion, x]);
                }}
              />
            </label>
          </div>
          <label className="mt-4 block text-sm">
            Observacion general
            <input
              className="mt-1 w-full rounded-xl border p-3"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </label>
          <div className="mt-5">
            <div className="mb-2 flex justify-between">
              <h3 className="font-semibold">Planilla de productos</h3>
              <span className="text-sm text-[var(--texto-suave)]">
                {seleccion.length} seleccionados
              </span>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="p-3">Codigo</th>
                    <th>Descripcion</th>
                    <th className="w-28">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {seleccion.map((x) => (
                    <tr key={x.id} className="border-t">
                      <td className="p-3 font-mono font-semibold">
                        {x.codigo}
                      </td>
                      <td>{x.descripcion}</td>
                      <td>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 px-3 py-2 text-red-700"
                          onClick={() =>
                            setSeleccion(seleccion.filter((s) => s.id !== x.id))
                          }
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!seleccion.length && (
                <p className="p-6 text-center text-sm text-[var(--texto-suave)]">
                  Seleccione un clasificador o agregue productos
                  individualmente.
                </p>
              )}
            </div>
          </div>
          <button
            disabled={!almacen || !seleccion.length}
            className="mt-4 rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            Crear planilla de inventario
          </button>
        </form>
      )}
      <div className="overflow-x-auto rounded-2xl border bg-white p-5">
        <table data-exportar-excel="true" className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Numero</th>
              <th>Fecha</th>
              <th>Almacen</th>
              <th>Productos</th>
              <th>Estado</th>
              <th>Usuario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="py-3 font-semibold">#{x.numero}</td>
                <td>{new Date(x.fecha_creacion).toLocaleString("es-AR")}</td>
                <td>{x.almacen_codigo}</td>
                <td>{x.detalles.length}</td>
                <td>{x.estado}</td>
                <td>{x.usuario_creacion}</td>
                <td>
                  <button
                    onClick={() => abrir(x.id)}
                    className="rounded-lg border px-3 py-2 font-semibold text-[var(--marca)]"
                  >
                    ⚙ Abrir
                  </button>
                  {x.estado === "PENDIENTE" &&
                    x.detalles.every((detalle) => detalle.cantidad_contada === null) && (
                      <button
                        onClick={() => void eliminar(x.id)}
                        className="ml-2 rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700"
                      >
                        Eliminar
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FormularioMovimiento({
  tipo,
  almacenes,
  completado,
}: {
  tipo: "ajuste" | "transferencia";
  almacenes: Almacen[];
  completado: (m: Movimiento) => void;
}) {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [articulo, setArticulo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");
  async function guardar(e: FormEvent) {
    e.preventDefault();
    const body =
      tipo === "ajuste"
        ? {
            almacen_id: origen,
            observacion,
            detalles: [{ articulo_id: articulo, cantidad }],
          }
        : {
            almacen_origen_id: origen,
            almacen_destino_id: destino,
            observacion: observacion || null,
            detalles: [{ articulo_id: articulo, cantidad }],
          };
    const r = await apiFetch(
      `${apiUrl}/articulos/stock/${tipo === "ajuste" ? "ajustes" : "transferencias"}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const d = await r.json();
    if (!r.ok) {
      setError(d.detail ?? "No se pudo confirmar");
      return;
    }
    completado(d);
  }
  return (
    <form
      onSubmit={guardar}
      className="mt-5 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"
    >
      <h2 className="sm:col-span-2 text-xl font-semibold">
        {tipo === "ajuste" ? "Ajuste manual" : "Transferencia entre almacenes"}
      </h2>
      {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      <Seleccion
        titulo={tipo === "ajuste" ? "Almacen" : "Almacen de origen"}
        valor={origen}
        cambiar={setOrigen}
        opciones={almacenes
          .filter((x) => x.activo)
          .map((x) => [x.id, `${x.codigo} - ${x.descripcion}`])}
      />
      {tipo === "transferencia" && (
        <Seleccion
          titulo="Almacen de destino"
          valor={destino}
          cambiar={setDestino}
          opciones={almacenes
            .filter((x) => x.activo && x.id !== origen)
            .map((x) => [x.id, `${x.codigo} - ${x.descripcion}`])}
        />
      )}
      <label className="text-sm">
        Articulo
        <BuscadorArticulo
          seleccionar={(x) => setArticulo(x?.id ?? "")}
          requerido
        />
      </label>
      <label className="text-sm">
        Cantidad {tipo === "ajuste" && "(positiva o negativa)"}
        <input
          className="mt-1 w-full rounded-xl border p-3"
          type="number"
          step="0.000001"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          required
        />
      </label>
      <label className="sm:col-span-2 text-sm">
        Motivo u observacion
        <textarea
          className="mt-1 w-full rounded-xl border p-3"
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          required={tipo === "ajuste"}
        />
      </label>
      <button
        disabled={!articulo}
        className="sm:col-span-2 justify-self-end rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white disabled:opacity-40"
      >
        Confirmar movimiento
      </button>
    </form>
  );
}

function Seleccion({
  titulo,
  valor,
  cambiar,
  opciones,
}: {
  titulo: string;
  valor: string;
  cambiar: (v: string) => void;
  opciones: string[][];
}) {
  return (
    <label className="text-sm">
      {titulo}
      <select
        className="mt-1 w-full rounded-xl border p-3"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        required
      >
        <option value="">Seleccionar</option>
        {opciones.map(([id, nombre]) => (
          <option key={id} value={id}>
            {nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function Movimientos({
  filas,
  almacenes,
  almacen,
  seleccionarAlmacen,
  articuloSeleccionado,
  seleccionarArticulo,
}: {
  filas: Movimiento[];
  almacenes: Almacen[];
  almacen: string;
  seleccionarAlmacen: (id: string) => void;
  articuloSeleccionado: string;
  seleccionarArticulo: (id: string) => void;
}) {
  return (
    <section className="mt-5 space-y-3">
      <div className="rounded-2xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <label className="block text-sm font-semibold">
            Buscar movimientos de un producto
            <BuscadorArticulo
              seleccionar={(x) => seleccionarArticulo(x?.id ?? "")}
            />
          </label>
          <label className="text-sm font-semibold">
            Filtrar por almacen
            <select
              className="mt-1 w-full rounded-xl border p-3"
              value={almacen}
              onChange={(e) => seleccionarAlmacen(e.target.value)}
            >
              <option value="">Todos los almacenes</option>
              {almacenes
                .filter((x) => x.activo)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo} - {x.descripcion}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--texto-suave)]">
          Busque por descripcion, codigo interno, barra o codigo de proveedor.
        </p>
      </div>
      {!articuloSeleccionado && (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-[var(--texto-suave)]">
          Seleccione un producto para consultar su historial de movimientos.
        </p>
      )}
      {articuloSeleccionado && !filas.length && (
        <p className="rounded-2xl border bg-white p-8 text-center text-sm text-[var(--texto-suave)]">
          El producto seleccionado no posee movimientos en el almacen elegido.
        </p>
      )}
      {articuloSeleccionado && filas.length > 0 && (
        <div className="max-h-[65vh] overflow-auto rounded-2xl border bg-white">
          <table data-exportar-excel="true" className="min-w-[1300px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-[var(--texto-suave)]">
              <tr>
                <th className="p-3">Fecha y hora</th>
                <th>Operacion</th>
                <th>Transaccion</th>
                <th>Usuario</th>
                <th>Motivo</th>
                <th>Accion</th>
                <th>Almacen</th>
                <th>Cantidad</th>
                <th>Anterior</th>
                <th>Posterior</th>
              </tr>
            </thead>
            <tbody>
              {filas.flatMap((m) =>
                m.detalles.map((d) => {
                  const cantidad = Number(d.cantidad_base);
                  const entrada = cantidad > 0;
                  const esControl = cantidad === 0;
                  return (
                    <tr key={d.id} className="border-t align-middle">
                      <td className="whitespace-nowrap p-3">
                        {new Date(m.fecha_confirmacion).toLocaleString("es-AR")}
                      </td>
                      <td className="font-semibold">{m.tipo}</td>
                      <td className="font-semibold">#{m.numero}</td>
                      <td>{m.usuario_nombre}</td>
                      <td
                        className="max-w-64 truncate"
                        title={m.observacion || "SIN OBSERVACION"}
                      >
                        {m.observacion || "SIN OBSERVACION"}
                      </td>
                      <td
                        className={`font-semibold ${esControl ? "text-blue-700" : entrada ? "text-green-700" : "text-red-700"}`}
                      >
                        {esControl ? "CONTEO OK" : entrada ? "ENTRADA" : "SALIDA"}
                      </td>
                      <td>{d.almacen_codigo}</td>
                      <td>
                        {entrada ? "+" : ""}
                        {d.cantidad_base}
                      </td>
                      <td>{d.saldo_anterior}</td>
                      <td>{d.saldo_posterior}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
