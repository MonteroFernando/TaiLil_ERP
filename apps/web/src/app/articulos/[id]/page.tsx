"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type Unidad = { id: string; codigo: string; nombre: string; simbolo: string };
type AlicuotaIva = {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje: string;
};
type Presentacion = {
  id: string;
  unidad_medida_id: string;
  nombre_presentacion: string;
  factor_a_base: string;
  es_unidad_base: boolean;
  es_unidad_alternativa: boolean;
  activa: boolean;
};
type CodigoBarra = {
  id: string;
  codigo: string;
  modo_contenido: "cantidad" | "unidad";
  cantidad: string;
  articulo_unidad_id: string | null;
  cantidad_base_resuelta: string;
  principal: boolean;
  activo: boolean;
};
type Proveedor = {
  id: string;
  codigo?: string;
  razon_social: string;
  activo: boolean;
};
type RelacionProveedor = {
  id: string;
  proveedor_id: string;
  razon_social: string;
  codigo_proveedor: string;
  principal: boolean;
  activo: boolean;
};
type Clasificador = {
  id: string;
  tipo: string;
  nombre: string;
  padre_id: string | null;
  activo: boolean;
};
type Stock = {
  almacen_id: string;
  almacen_codigo: string;
  almacen_descripcion: string;
  cantidad_fisica: string;
  cantidad_pedida: string;
  cantidad_reservada: string;
  cantidad_disponible: string;
  cantidad_disponible_futura: string;
};
type Articulo = {
  id: string;
  codigo: string;
  tipo_articulo: "producto" | "servicio";
  descripcion: string;
  descripcion_ampliada: string | null;
  habilitado: boolean;
  habilitado_venta: boolean;
  habilitado_compra: boolean;
  habilitado_inventario: boolean;
  es_pesable: boolean;
  clasificador_ids: string[];
  unidad_base: Unidad;
  alicuota_iva: AlicuotaIva;
  unidades: Presentacion[];
  codigos_barra: CodigoBarra[];
  proveedores: RelacionProveedor[];
  stocks: Stock[];
};

async function detalleError(respuesta: Response, predeterminado: string) {
  try {
    const datos = await respuesta.json();
    return datos.detail ?? predeterminado;
  } catch {
    return predeterminado;
  }
}

export default function DetalleArticulo() {
  const parametros = useParams<{ id: string }>();
  const [articulo, setArticulo] = useState<Articulo | null>(null);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [alicuotasIva, setAlicuotasIva] = useState<AlicuotaIva[]>([]);
  const [clasificadores, setClasificadores] = useState<Clasificador[]>([]);
  const [editandoArticulo, setEditandoArticulo] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    const [rArticulo, rUnidades, rProveedores, rIva, rClasificadores] =
      await Promise.all([
        fetch(`${apiUrl}/articulos/${parametros.id}`, {
          credentials: "include",
        }),
        fetch(`${apiUrl}/articulos/unidades-medida`, {
          credentials: "include",
        }),
        fetch(`${apiUrl}/articulos/proveedores`, { credentials: "include" }),
        fetch(`${apiUrl}/articulos/alicuotas-iva`, { credentials: "include" }),
        fetch(`${apiUrl}/articulos/clasificadores`, { credentials: "include" }),
      ]);
    if (!rArticulo.ok) {
      setMensaje("No fue posible cargar el articulo.");
      return;
    }
    setArticulo(await rArticulo.json());
    if (rUnidades.ok) setUnidades(await rUnidades.json());
    if (rProveedores.ok) setProveedores(await rProveedores.json());
    if (rIva.ok) setAlicuotasIva(await rIva.json());
    if (rClasificadores.ok) setClasificadores(await rClasificadores.json());
  }, [parametros.id]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  if (!articulo) {
    return (
      <main className="grid min-h-screen place-items-center">
        {mensaje || "Cargando articulo..."}
      </main>
    );
  }
  return (
    <main className="min-h-screen px-5 py-8 sm:px-10">
      <section className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--borde)] pb-7">
          <div>
            <p className="font-mono text-sm font-semibold text-[var(--marca)]">
              {articulo.codigo}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              {articulo.descripcion}
            </h1>
            <p className="mt-2 text-[var(--texto-suave)]">
              Unidad base: {articulo.unidad_base.nombre} ·{" "}
              {articulo.es_pesable ? "Producto pesable" : "Producto no pesable"}
            </p>
          </div>
          <button
            onClick={() => setEditandoArticulo(true)}
            className="rounded-xl border border-[var(--borde)] bg-white px-4 py-2 text-sm font-semibold"
          >
            ⚙ Detalles del articulo
          </button>
        </header>
        {mensaje && (
          <p className="mt-5 rounded-xl bg-[var(--marca-clara)] p-4 text-[var(--marca)]">
            {mensaje}
          </p>
        )}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <SeccionPresentaciones
            articulo={articulo}
            unidades={unidades}
            recargar={cargar}
            informar={setMensaje}
          />
          <SeccionCodigos
            articulo={articulo}
            recargar={cargar}
            informar={setMensaje}
          />
          <SeccionProveedores
            articulo={articulo}
            proveedores={proveedores}
            recargar={cargar}
            informar={setMensaje}
          />
        </div>
        <SeccionStocks stocks={articulo.stocks} />
        <ReglasPrecios articuloId={articulo.id} informar={setMensaje} />
        {editandoArticulo && (
          <EditarArticulo
            articulo={articulo}
            alicuotas={alicuotasIva}
            clasificadores={clasificadores}
            cerrar={() => setEditandoArticulo(false)}
            guardado={async () => {
              setEditandoArticulo(false);
              setMensaje("Articulo actualizado");
              await cargar();
            }}
            informar={setMensaje}
          />
        )}
      </section>
    </main>
  );
}

function SeccionStocks({ stocks }: { stocks: Stock[] }) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--borde)] bg-white p-6">
      <h2 className="text-xl font-semibold">Stock por almacen</h2>
      <p className="mt-1 text-sm text-[var(--texto-suave)]">
        Disponible = fisico - reservado. Futuro = fisico + pedido - reservado.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-[var(--texto-suave)]">
              <th className="p-2">Almacen</th>
              <th>Fisico</th>
              <th>Pedido</th>
              <th>Reservado</th>
              <th>Disponible</th>
              <th>Disponible futuro</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr key={s.almacen_id} className="border-t border-[var(--borde)]">
                <td className="p-2">
                  <b>{s.almacen_codigo}</b> · {s.almacen_descripcion}
                </td>
                <td>{s.cantidad_fisica}</td>
                <td>{s.cantidad_pedida}</td>
                <td>{s.cantidad_reservada}</td>
                <td>{s.cantidad_disponible}</td>
                <td>{s.cantidad_disponible_futura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ListaPrecio = { id:string; nombre:string; es_base:boolean; activa:boolean };
type ReglaPrecio = { id:string; lista_precio_id:string; lista_nombre:string; cantidad_minima:string; activa:boolean };
function ReglasPrecios({articuloId,informar}:{articuloId:string;informar:(m:string)=>void}){
  const[listas,setListas]=useState<ListaPrecio[]>([]),[reglas,setReglas]=useState<ReglaPrecio[]>([]),[lista,setLista]=useState(""),[cantidad,setCantidad]=useState("");
  const cargar=useCallback(async()=>{const[rl,rr]=await Promise.all([fetch(`${apiUrl}/articulos/precios/listas`,{credentials:"include"}),fetch(`${apiUrl}/articulos/precios/articulos/${articuloId}/reglas`,{credentials:"include"})]);if(rl.ok)setListas(await rl.json());if(rr.ok)setReglas(await rr.json())},[articuloId]);
  useEffect(()=>{const t=window.setTimeout(()=>void cargar(),0);return()=>window.clearTimeout(t)},[cargar]);
  async function agregar(e:FormEvent){e.preventDefault();const r=await fetch(`${apiUrl}/articulos/precios/articulos/${articuloId}/reglas`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({lista_precio_id:lista,cantidad_minima:cantidad})});const d=await r.json();if(!r.ok){informar(d.detail??"No se pudo crear la regla");return}setLista("");setCantidad("");informar("Regla de precio creada");await cargar()}
  async function quitar(id:string){const r=await fetch(`${apiUrl}/articulos/precios/articulos/${articuloId}/reglas/${id}`,{method:"DELETE",credentials:"include"});if(r.ok){informar("Regla eliminada");await cargar()}}
  return <section className="mt-8 rounded-2xl border bg-white p-5"><h2 className="text-xl font-semibold">Cambio automatico de lista por cantidad</h2><p className="mt-1 text-sm text-[var(--texto-suave)]">Cuando la cantidad supera el umbral en unidad base, se utiliza la lista indicada. Si coinciden varias reglas, se aplica el umbral mas alto.</p><form onSubmit={agregar} className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]"><label className="text-sm">Lista de destino<select className="mt-1 w-full rounded-xl border p-3" value={lista} onChange={e=>setLista(e.target.value)} required><option value="">Seleccionar</option>{listas.filter(x=>!x.es_base&&x.activa&&!reglas.some(r=>r.lista_precio_id===x.id)).map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label><label className="text-sm">Supera cantidad base<input className="mt-1 w-full rounded-xl border p-3" type="number" min="0.000001" step="0.000001" value={cantidad} onChange={e=>setCantidad(e.target.value)} required/></label><button className="self-end rounded-xl bg-[var(--marca)] px-4 py-3 font-semibold text-white">Agregar regla</button></form><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Lista</th><th>Cantidad base</th><th></th></tr></thead><tbody>{reglas.map(x=><tr key={x.id} className="border-t"><td className="py-3 font-semibold">{x.lista_nombre}</td><td>Mayor a {x.cantidad_minima}</td><td className="text-right"><button onClick={()=>void quitar(x.id)} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Quitar</button></td></tr>)}</tbody></table></div></section>
}

function EditarArticulo({
  articulo,
  alicuotas,
  clasificadores,
  cerrar,
  guardado,
  informar,
}: {
  articulo: Articulo;
  alicuotas: AlicuotaIva[];
  clasificadores: Clasificador[];
  cerrar: () => void;
  guardado: () => void;
  informar: (m: string) => void;
}) {
  const [descripcion, setDescripcion] = useState(articulo.descripcion);
  const [ampliada, setAmpliada] = useState(articulo.descripcion_ampliada ?? "");
  const [iva, setIva] = useState(articulo.alicuota_iva.id);
  const [habilitado, setHabilitado] = useState(articulo.habilitado);
  const [venta, setVenta] = useState(articulo.habilitado_venta);
  const [compra, setCompra] = useState(articulo.habilitado_compra);
  const [inventario, setInventario] = useState(articulo.habilitado_inventario);
  const [pesable, setPesable] = useState(articulo.es_pesable);
  const [seleccion, setSeleccion] = useState(articulo.clasificador_ids);
  const [buscarClasificador, setBuscarClasificador] = useState("");
  function cambiarClasificador(id: string, marcado: boolean) {
    if (marcado) {
      setSeleccion((actual) => (actual.includes(id) ? actual : [...actual, id]));
      return;
    }
    const retirar = new Set([id]);
    let agregados = true;
    while (agregados) {
      agregados = false;
      for (const item of clasificadores) {
        if (item.padre_id && retirar.has(item.padre_id) && !retirar.has(item.id)) {
          retirar.add(item.id);
          agregados = true;
        }
      }
    }
    setSeleccion((actual) => actual.filter((x) => !retirar.has(x)));
  }
  const terminoClasificador = buscarClasificador.trim().toUpperCase();
  const clasificadoresVisibles = clasificadores.filter((x) => {
    const coincide = `${x.tipo} ${x.nombre}`.toUpperCase().includes(terminoClasificador);
    const habilitadoPorJerarquia =
      !x.padre_id || seleccion.includes(x.padre_id) || seleccion.includes(x.id);
    return (x.activo || seleccion.includes(x.id)) && coincide && habilitadoPorJerarquia;
  });
  async function guardar(e: FormEvent) {
    e.preventDefault();
    const r = await fetch(`${apiUrl}/articulos/${articulo.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_articulo: articulo.tipo_articulo,
        codigo_alternativo:
          articulo.tipo_articulo === "servicio" ? articulo.codigo : null,
        descripcion,
        descripcion_ampliada: ampliada || null,
        unidad_base_id: articulo.unidad_base.id,
        alicuota_iva_id: iva,
        habilitado,
        habilitado_venta: venta,
        habilitado_compra: compra,
        habilitado_inventario: inventario,
        es_pesable: pesable,
        clasificador_ids: seleccion,
      }),
    });
    if (!r.ok) {
      informar(await detalleError(r, "No se pudo actualizar el articulo"));
      return;
    }
    await guardado();
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <form
        onSubmit={guardar}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6"
      >
        <div className="flex justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Detalles del articulo {articulo.codigo}
            </h2>
            <p className="text-sm text-[var(--texto-suave)]">
              Configuracion general y operativa completa.
            </p>
          </div>
          <button type="button" onClick={cerrar} className="text-2xl">
            ×
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Descripcion
            <input
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Descripcion ampliada
            <textarea
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={ampliada}
              onChange={(e) => setAmpliada(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Unidad base
            <input
              disabled
              className="mt-1 w-full rounded-xl border border-[var(--borde)] bg-gray-100 p-2"
              value={articulo.unidad_base.nombre}
            />
          </label>
          <label className="text-sm">
            IVA
            <select
              className="mt-1 w-full rounded-xl border border-[var(--borde)] p-2"
              value={iva}
              onChange={(e) => setIva(e.target.value)}
            >
              {alicuotas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">
              Clasificadores
            </legend>
            <input
              className="mb-3 w-full rounded-xl border border-[var(--borde)] p-2"
              value={buscarClasificador}
              onChange={(e) => setBuscarClasificador(e.target.value)}
              placeholder="Buscar por tipo o nombre del clasificador"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {clasificadoresVisibles.map((x) => (
                  <label
                    key={x.id}
                    className="flex gap-2 rounded-lg bg-[var(--fondo)] p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={seleccion.includes(x.id)}
                      onChange={(e) => cambiarClasificador(x.id, e.target.checked)}
                    />
                    {x.tipo}: {x.nombre}
                  </label>
                ))}
            </div>
            {!clasificadoresVisibles.length && (
              <p className="mt-2 text-sm text-[var(--texto-suave)]">
                No hay clasificadores disponibles para esta seleccion.
              </p>
            )}
          </fieldset>
          <section
            className={`sm:col-span-2 rounded-2xl border-2 p-4 ${
              habilitado
                ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
            }`}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={habilitado}
                onChange={(e) => {
                  const activo = e.target.checked;
                  setHabilitado(activo);
                  if (!activo) {
                    setVenta(false);
                    setCompra(false);
                    setInventario(false);
                  }
                }}
              />
              <span>
                <b className="block text-base">
                  Articulo {habilitado ? "ACTIVO" : "INACTIVO"}
                </b>
                <small className="mt-1 block text-sm text-[var(--texto-suave)]">
                  Al desactivarlo deja de estar disponible para venta, compra,
                  inventario y todas las busquedas operativas. Su historial se
                  conserva.
                </small>
              </span>
            </label>
          </section>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">
              Habilitaciones operativas
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Habilitado para venta", venta, setVenta],
                ["Habilitado para compra", compra, setCompra],
                ["Controla inventario", inventario, setInventario],
                ["Producto pesable", pesable, setPesable],
              ].map(([n, v, s]) => (
                <label key={n as string} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={v as boolean}
                    disabled={
                      !habilitado ||
                      (articulo.tipo_articulo === "servicio" &&
                        (n === "Controla inventario" || n === "Producto pesable"))
                    }
                    onChange={(e) =>
                      (s as (v: boolean) => void)(e.target.checked)
                    }
                  />
                  {n as string}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={cerrar}
            className="px-4 py-2 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button className="rounded-xl bg-[var(--marca)] px-5 py-2 text-sm font-semibold text-white">
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}

function SeccionPresentaciones({
  articulo,
  unidades,
  recargar,
  informar,
}: {
  articulo: Articulo;
  unidades: Unidad[];
  recargar: () => Promise<void>;
  informar: (m: string) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [unidadId, setUnidadId] = useState("");
  const [nombre, setNombre] = useState("");
  const [factor, setFactor] = useState("1");
  const [esAlternativa, setEsAlternativa] = useState(false);

  function limpiar() {
    setEditando(null);
    setUnidadId("");
    setNombre("");
    setFactor("1");
    setEsAlternativa(false);
  }
  function editar(item: Presentacion) {
    setEditando(item.id);
    setUnidadId(item.unidad_medida_id);
    setNombre(item.nombre_presentacion);
    setFactor(item.factor_a_base);
    setEsAlternativa(item.es_unidad_alternativa);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const url = editando
      ? `${apiUrl}/articulos/${articulo.id}/unidades/${editando}`
      : `${apiUrl}/articulos/${articulo.id}/unidades`;
    const respuesta = await fetch(url, {
      method: editando ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unidad_medida_id: unidadId,
        nombre_presentacion: nombre,
        factor_a_base: factor,
        es_unidad_alternativa: esAlternativa,
        activa: true,
      }),
    });
    if (!respuesta.ok) {
      informar(
        await detalleError(respuesta, "No se pudo guardar la presentacion"),
      );
      return;
    }
    informar(editando ? "Presentacion modificada" : "Presentacion agregada");
    limpiar();
    await recargar();
  }

  async function eliminar(item: Presentacion) {
    if (
      !window.confirm(`¿Eliminar la presentacion ${item.nombre_presentacion}?`)
    )
      return;
    const respuesta = await fetch(
      `${apiUrl}/articulos/${articulo.id}/unidades/${item.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!respuesta.ok) {
      informar(
        await detalleError(respuesta, "No se pudo eliminar la presentacion"),
      );
      return;
    }
    informar("Presentacion eliminada");
    if (editando === item.id) limpiar();
    await recargar();
  }

  async function cambiarUnidadAlternativa(
    item: Presentacion,
    marcada: boolean,
  ) {
    const respuesta = await fetch(
      `${apiUrl}/articulos/${articulo.id}/unidades/${item.id}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidad_medida_id: item.unidad_medida_id,
          nombre_presentacion: item.nombre_presentacion,
          factor_a_base: item.factor_a_base,
          es_unidad_alternativa: marcada,
          activa: item.activa,
        }),
      },
    );
    if (!respuesta.ok) {
      informar(
        await detalleError(
          respuesta,
          "No se pudo cambiar la unidad alternativa",
        ),
      );
      return;
    }
    informar(
      marcada
        ? `${item.nombre_presentacion} seleccionada como unidad alternativa`
        : "Unidad alternativa desmarcada",
    );
    await recargar();
  }

  return (
    <section className="rounded-2xl border border-[var(--borde)] bg-white p-6">
      <h2 className="text-xl font-semibold">Unidades y presentaciones</h2>
      <div className="mt-4 space-y-2">
        {articulo.unidades.map((item) => (
          <div
            className="rounded-xl bg-[var(--fondo)] p-3 text-sm"
            key={item.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong>{item.nombre_presentacion}</strong>
                <p className="text-[var(--texto-suave)]">
                  {item.factor_a_base} unidades base
                  {item.es_unidad_base ? " · Base protegida" : ""}
                </p>
              </div>
              {!item.es_unidad_base && (
                <label
                  className="flex shrink-0 cursor-pointer items-center gap-2"
                  title="Se usará cuando un movimiento active la unidad alternativa"
                >
                  <input
                    type="checkbox"
                    checked={item.es_unidad_alternativa}
                    onChange={(evento) =>
                      void cambiarUnidadAlternativa(item, evento.target.checked)
                    }
                  />
                  <span>Alternativa</span>
                </label>
              )}
            </div>
            {!item.es_unidad_base && (
              <div className="mt-2 flex gap-3">
                <button
                  className="font-semibold text-[var(--marca)]"
                  onClick={() => editar(item)}
                >
                  Editar
                </button>
                <button
                  className="font-semibold text-red-700"
                  onClick={() => void eliminar(item)}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-5 space-y-3 border-t border-[var(--borde)] pt-5"
        onSubmit={guardar}
      >
        <p className="text-sm font-semibold">
          {editando ? "Modificar presentacion" : "Nueva presentacion"}
        </p>
        <select
          className="w-full rounded-xl border border-[var(--borde)] bg-white px-3 py-2"
          value={unidadId}
          onChange={(e) => setUnidadId(e.target.value)}
          required
        >
          <option value="">Unidad</option>
          {unidades.map((unidad) => (
            <option value={unidad.id} key={unidad.id}>
              {unidad.nombre}
            </option>
          ))}
        </select>
        <input
          className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
          placeholder="Ej. Caja x 12"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
          type="number"
          min="0.000001"
          step="0.000001"
          value={factor}
          onChange={(e) => setFactor(e.target.value)}
          required
        />
        <div className="flex gap-3">
          <button className="rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white">
            {editando ? "Guardar cambios" : "Agregar presentacion"}
          </button>
          {editando && (
            <button
              className="font-semibold text-[var(--texto-suave)]"
              type="button"
              onClick={limpiar}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function SeccionCodigos({
  articulo,
  recargar,
  informar,
}: {
  articulo: Articulo;
  recargar: () => Promise<void>;
  informar: (m: string) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [modo, setModo] = useState<"cantidad" | "unidad">("cantidad");
  const [cantidad, setCantidad] = useState("1");
  const [presentacionId, setPresentacionId] = useState("");

  function limpiar() {
    setEditando(null);
    setCodigo("");
    setModo("cantidad");
    setCantidad("1");
    setPresentacionId("");
  }
  function editar(item: CodigoBarra) {
    setEditando(item.id);
    setCodigo(item.codigo);
    setModo(item.modo_contenido);
    setCantidad(item.cantidad);
    setPresentacionId(item.articulo_unidad_id ?? "");
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const url = editando
      ? `${apiUrl}/articulos/${articulo.id}/codigos-barra/${editando}`
      : `${apiUrl}/articulos/${articulo.id}/codigos-barra`;
    const respuesta = await fetch(url, {
      method: editando ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo,
        modo_contenido: modo,
        cantidad,
        articulo_unidad_id: modo === "unidad" ? presentacionId : null,
        principal: editando
          ? (articulo.codigos_barra.find((item) => item.id === editando)
              ?.principal ?? false)
          : articulo.codigos_barra.length === 0,
        activo: true,
      }),
    });
    if (!respuesta.ok) {
      informar(await detalleError(respuesta, "No se pudo guardar el codigo"));
      return;
    }
    informar(
      editando ? "Codigo de barras modificado" : "Codigo de barras agregado",
    );
    limpiar();
    await recargar();
  }

  async function eliminar(item: CodigoBarra) {
    if (!window.confirm(`¿Eliminar el codigo ${item.codigo}?`)) return;
    const respuesta = await fetch(
      `${apiUrl}/articulos/${articulo.id}/codigos-barra/${item.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!respuesta.ok) {
      informar(await detalleError(respuesta, "No se pudo eliminar el codigo"));
      return;
    }
    informar("Codigo de barras eliminado");
    if (editando === item.id) limpiar();
    await recargar();
  }

  return (
    <section className="rounded-2xl border border-[var(--borde)] bg-white p-6">
      <h2 className="text-xl font-semibold">Codigos de barras</h2>
      <div className="mt-4 space-y-2">
        {articulo.codigos_barra.map((item) => (
          <div
            className="rounded-xl bg-[var(--fondo)] p-3 text-sm"
            key={item.id}
          >
            <strong className="font-mono">{item.codigo}</strong>
            <p className="text-[var(--texto-suave)]">
              Descuenta {item.cantidad_base_resuelta} unidades base
            </p>
            <div className="mt-2 flex gap-3">
              <button
                className="font-semibold text-[var(--marca)]"
                onClick={() => editar(item)}
              >
                Editar
              </button>
              <button
                className="font-semibold text-red-700"
                onClick={() => void eliminar(item)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {!articulo.codigos_barra.length && (
          <p className="text-sm text-[var(--texto-suave)]">
            Sin codigos registrados.
          </p>
        )}
      </div>
      <form
        className="mt-5 space-y-3 border-t border-[var(--borde)] pt-5"
        onSubmit={guardar}
      >
        <p className="text-sm font-semibold">
          {editando ? "Modificar codigo" : "Nuevo codigo"}
        </p>
        <input
          className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
          placeholder="Codigo de barras"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
        />
        <select
          className="w-full rounded-xl border border-[var(--borde)] bg-white px-3 py-2"
          value={modo}
          onChange={(e) => setModo(e.target.value as "cantidad" | "unidad")}
        >
          <option value="cantidad">Cantidad directa</option>
          <option value="unidad">Presentacion vinculada</option>
        </select>
        {modo === "cantidad" ? (
          <input
            className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
            type="number"
            min="0.000001"
            step="0.000001"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        ) : (
          <select
            className="w-full rounded-xl border border-[var(--borde)] bg-white px-3 py-2"
            value={presentacionId}
            onChange={(e) => setPresentacionId(e.target.value)}
            required
          >
            <option value="">Seleccionar presentacion</option>
            {articulo.unidades.map((item) => (
              <option value={item.id} key={item.id}>
                {item.nombre_presentacion} ({item.factor_a_base})
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-3">
          <button className="rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white">
            {editando ? "Guardar cambios" : "Agregar codigo"}
          </button>
          {editando && (
            <button
              className="font-semibold text-[var(--texto-suave)]"
              type="button"
              onClick={limpiar}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function SeccionProveedores({
  articulo,
  proveedores,
  recargar,
  informar,
}: {
  articulo: Articulo;
  proveedores: Proveedor[];
  recargar: () => Promise<void>;
  informar: (m: string) => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [proveedorId, setProveedorId] = useState("");
  const [codigoProveedor, setCodigoProveedor] = useState("");
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevaRazonSocial, setNuevaRazonSocial] = useState("");

  function limpiar() {
    setEditando(null);
    setProveedorId("");
    setCodigoProveedor("");
  }
  function editar(item: RelacionProveedor) {
    setEditando(item.id);
    setProveedorId(item.proveedor_id);
    setCodigoProveedor(item.codigo_proveedor);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const url = editando
      ? `${apiUrl}/articulos/${articulo.id}/proveedores/${editando}`
      : `${apiUrl}/articulos/${articulo.id}/proveedores`;
    const respuesta = await fetch(url, {
      method: editando ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedor_id: proveedorId,
        codigo_proveedor: codigoProveedor,
        principal: editando
          ? (articulo.proveedores.find((item) => item.id === editando)
              ?.principal ?? false)
          : articulo.proveedores.length === 0,
        activo: true,
      }),
    });
    if (!respuesta.ok) {
      informar(
        await detalleError(respuesta, "No se pudo guardar el proveedor"),
      );
      return;
    }
    informar(
      editando ? "Codigo de proveedor modificado" : "Proveedor vinculado",
    );
    limpiar();
    await recargar();
  }

  async function eliminar(item: RelacionProveedor) {
    if (!window.confirm(`¿Quitar a ${item.razon_social} del articulo?`)) return;
    const respuesta = await fetch(
      `${apiUrl}/articulos/${articulo.id}/proveedores/${item.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!respuesta.ok) {
      informar(await detalleError(respuesta, "No se pudo quitar el proveedor"));
      return;
    }
    informar("Proveedor desvinculado");
    if (editando === item.id) limpiar();
    await recargar();
  }

  async function crearProveedor(evento: FormEvent) {
    evento.preventDefault();
    const respuesta = await fetch(`${apiUrl}/articulos/proveedores`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: nuevoCodigo,
        razon_social: nuevaRazonSocial,
      }),
    });
    if (!respuesta.ok) {
      informar(await detalleError(respuesta, "No se pudo crear el proveedor"));
      return;
    }
    setNuevoCodigo("");
    setNuevaRazonSocial("");
    informar("Proveedor creado; ya puedes vincularlo");
    await recargar();
  }

  return (
    <section className="rounded-2xl border border-[var(--borde)] bg-white p-6">
      <h2 className="text-xl font-semibold">Proveedores</h2>
      <div className="mt-4 space-y-2">
        {articulo.proveedores.map((item) => (
          <div
            className="rounded-xl bg-[var(--fondo)] p-3 text-sm"
            key={item.id}
          >
            <strong>{item.razon_social}</strong>
            <p className="text-[var(--texto-suave)]">
              Codigo: {item.codigo_proveedor}
              {item.principal ? " · Principal" : ""}
            </p>
            <div className="mt-2 flex gap-3">
              <button
                className="font-semibold text-[var(--marca)]"
                onClick={() => editar(item)}
              >
                Editar codigo
              </button>
              <button
                className="font-semibold text-red-700"
                onClick={() => void eliminar(item)}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-5 space-y-3 border-t border-[var(--borde)] pt-5"
        onSubmit={crearProveedor}
      >
        <p className="text-sm font-semibold">Alta rapida de proveedor</p>
        <input
          className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
          placeholder="Codigo"
          value={nuevoCodigo}
          onChange={(e) => setNuevoCodigo(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
          placeholder="Razon social"
          value={nuevaRazonSocial}
          onChange={(e) => setNuevaRazonSocial(e.target.value)}
          required
        />
        <button className="rounded-xl border border-[var(--marca)] px-4 py-2 font-semibold text-[var(--marca)]">
          Crear proveedor
        </button>
      </form>
      {proveedores.length > 0 && (
        <form
          className="mt-5 space-y-3 border-t border-[var(--borde)] pt-5"
          onSubmit={guardar}
        >
          <p className="text-sm font-semibold">
            {editando ? "Modificar vinculo" : "Vincular proveedor"}
          </p>
          <select
            className="w-full rounded-xl border border-[var(--borde)] bg-white px-3 py-2"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            required
          >
            <option value="">Seleccionar proveedor</option>
            {proveedores.map((item) => (
              <option value={item.id} key={item.id}>
                {item.razon_social}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-xl border border-[var(--borde)] px-3 py-2"
            placeholder="Codigo interno del proveedor"
            value={codigoProveedor}
            onChange={(e) => setCodigoProveedor(e.target.value)}
            required
          />
          <div className="flex gap-3">
            <button className="rounded-xl bg-[var(--marca)] px-4 py-2 font-semibold text-white">
              {editando ? "Guardar cambios" : "Vincular proveedor"}
            </button>
            {editando && (
              <button
                className="font-semibold text-[var(--texto-suave)]"
                type="button"
                onClick={limpiar}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
