"use client";

import { apiFetch } from "@/api";
/* eslint-disable @next/next/no-html-link-for-pages */
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const condiciones = [
  [1, "IVA RESPONSABLE INSCRIPTO"],
  [4, "IVA SUJETO EXENTO"],
  [5, "CONSUMIDOR FINAL"],
  [6, "RESPONSABLE MONOTRIBUTO"],
  [7, "SUJETO NO CATEGORIZADO"],
  [8, "PROVEEDOR DEL EXTERIOR"],
  [9, "CLIENTE DEL EXTERIOR"],
  [10, "IVA LIBERADO"],
  [13, "MONOTRIBUTISTA SOCIAL"],
  [15, "IVA NO ALCANZADO"],
  [16, "MONOTRIBUTO PROMOVIDO"],
] as const;
type Rol = "cliente" | "proveedor";
type Pestana =
  "general" | "fiscal" | "direcciones" | "agrupacion" | "cuenta_corriente";
type Socio = {
  id: string;
  codigo: string;
  razon_social: string;
  nombre_fantasia: string | null;
  tipo_persona: "fisica" | "juridica";
  tipo_documento: string;
  numero_documento: string;
  condicion_iva_codigo: number;
  condicion_iibb: string | null;
  numero_iibb: string | null;
  actividad_arca_codigo: string | null;
  actividad_arca_descripcion: string | null;
  es_cliente: boolean;
  es_proveedor: boolean;
  cuenta_padre_cliente_id: string | null;
  cuenta_padre_proveedor_id: string | null;
  activo: boolean;
};
type Domicilio = {
  id: string;
  rol: Rol;
  calle: string;
  numero: string;
  localidad: string;
  provincia: string;
  pais: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
};
type DomicilioBorrador = Omit<Domicilio, "id">;
export default function MaestroSociosNegocio({
  modo = "listado",
  registroId,
}: {
  modo?: "listado" | "ficha";
  registroId?: string;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<Socio[]>([]);
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [socio, setSocio] = useState<Socio | null>(null);
  const [pestana, setPestana] = useState<Pestana>("general");
  const [mensaje, setMensaje] = useState("");
  const [razon, setRazon] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [persona, setPersona] = useState<"fisica" | "juridica">("fisica");
  const [tipoDoc, setTipoDoc] = useState("DNI");
  const [documento, setDocumento] = useState("");
  const [iva, setIva] = useState(5);
  const [iibb, setIibb] = useState("");
  const [numeroIibb, setNumeroIibb] = useState("");
  const [actividad, setActividad] = useState("");
  const [actividadDetalle, setActividadDetalle] = useState("");
  const [cliente, setCliente] = useState(true);
  const [proveedor, setProveedor] = useState(false);
  const [activo, setActivo] = useState(true);
  const [domicilios, setDomicilios] = useState<Record<Rol, Domicilio[]>>({
    cliente: [],
    proveedor: [],
  });
  const [domiciliosBorrador, setDomiciliosBorrador] = useState<
    Record<Rol, DomicilioBorrador[]>
  >({ cliente: [], proveedor: [] });
  const [padreCliente, setPadreCliente] = useState("");
  const [padreProveedor, setPadreProveedor] = useState("");
  const [cuentaActiva, setCuentaActiva] = useState(false);
  const [limiteDeuda, setLimiteDeuda] = useState("0");
  const [limitePeriodo, setLimitePeriodo] = useState("0");
  const [temporalidad, setTemporalidad] = useState("mensual");
  const [diasDeuda, setDiasDeuda] = useState("0");
  const cargarLista = useCallback(async () => {
    const r = await apiFetch(
      `${apiUrl}/articulos/socios?rol=${filtro}&buscar=${encodeURIComponent(buscar)}`,
      { credentials: "include" },
    );
    if (r.ok) setLista(await r.json());
  }, [buscar, filtro]);
  useEffect(() => {
    const t = window.setTimeout(() => void cargarLista(), 250);
    return () => window.clearTimeout(t);
  }, [cargarLista]);
  const cargarDomicilios = useCallback(async (id: string, roles: Rol[]) => {
    const pares = await Promise.all(
      roles.map(async (rol) => {
        const r = await apiFetch(
          `${apiUrl}/articulos/socios/${id}/domicilios?rol=${rol}`,
          { credentials: "include" },
        );
        return [rol, r.ok ? await r.json() : []] as const;
      }),
    );
    setDomicilios((prev) => ({ ...prev, ...Object.fromEntries(pares) }));
  }, []);
  const completar = useCallback(
    (x: Socio) => {
      setSocio(x);
      setRazon(x.razon_social);
      setFantasia(x.nombre_fantasia ?? "");
      setPersona(x.tipo_persona);
      setTipoDoc(x.tipo_documento);
      setDocumento(x.numero_documento);
      setIva(x.condicion_iva_codigo);
      setIibb(x.condicion_iibb ?? "");
      setNumeroIibb(x.numero_iibb ?? "");
      setActividad(x.actividad_arca_codigo ?? "");
      setActividadDetalle(x.actividad_arca_descripcion ?? "");
      setCliente(x.es_cliente);
      setProveedor(x.es_proveedor);
      setActivo(x.activo);
      const roles: Rol[] = [];
      if (x.es_cliente) roles.push("cliente");
      if (x.es_proveedor) roles.push("proveedor");
      void cargarDomicilios(x.id, roles);
      if (x.es_cliente)
        void apiFetch(
          `${apiUrl}/articulos/socios/${x.id}/cuenta-corriente-ventas`,
          { credentials: "include" },
        ).then(async (r) => {
          if (r.ok) {
            const c = await r.json();
            setCuentaActiva(c.activa);
            setLimiteDeuda(String(c.limite_deuda));
            setLimitePeriodo(String(c.limite_periodo));
            setTemporalidad(c.temporalidad);
            setDiasDeuda(String(c.dias_maximos_deuda));
          }
        });
    },
    [cargarDomicilios],
  );
  useEffect(() => {
    if (!registroId) return;
    async function cargar() {
      const r = await apiFetch(`${apiUrl}/articulos/socios/${registroId}`, {
        credentials: "include",
      });
      if (r.ok) completar(await r.json());
      else setMensaje("No se pudo abrir el socio");
    }
    void cargar();
  }, [registroId, completar]);
  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    const body = {
      cuenta_padre_id: null,
      codigo: documento,
      razon_social: razon,
      nombre_fantasia: fantasia || null,
      tipo_persona: persona,
      tipo_documento: tipoDoc,
      numero_documento: documento,
      condicion_iva_codigo: iva,
      condicion_iibb: iibb || null,
      numero_iibb: numeroIibb || null,
      actividad_arca_codigo: actividad || null,
      actividad_arca_descripcion: actividadDetalle || null,
      es_cliente: cliente,
      es_proveedor: proveedor,
      ...(socio
        ? { activo }
        : {
            domicilios: [
              ...domiciliosBorrador.cliente,
              ...domiciliosBorrador.proveedor,
            ],
            cuenta_padre_cliente_id: padreCliente || null,
            cuenta_padre_proveedor_id: padreProveedor || null,
            cuenta_corriente_ventas:
              cliente &&
              (cuentaActiva ||
                Number(limiteDeuda) > 0 ||
                Number(limitePeriodo) > 0 ||
                Number(diasDeuda) > 0)
                ? {
                    activa: cuentaActiva,
                    limite_deuda: limiteDeuda,
                    limite_periodo: limitePeriodo,
                    temporalidad,
                    dias_maximos_deuda: Number(diasDeuda),
                  }
                : null,
          }),
    };
    const r = await apiFetch(
      `${apiUrl}/articulos/socios${socio ? `/${socio.id}` : ""}`,
      {
        method: socio ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const d = await r.json();
    if (!r.ok) {
      setMensaje(d.detail ?? "No se pudo guardar");
      return;
    }
    completar(d);
    setMensaje(
      socio
        ? "Socio actualizado"
        : "Socio, direcciones y vinculaciones creados",
    );
    if (!socio) router.replace(`/socios-negocio/${d.id}` as Route);
  }
  async function eliminarSocio(registro: Socio) {
    if (!window.confirm(`¿Eliminar el socio ${registro.razon_social}?`)) return;
    const r = await apiFetch(`${apiUrl}/articulos/socios/${registro.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setMensaje(d?.detail ?? "No se pudo eliminar el socio");
      return;
    }
    setMensaje("Socio eliminado");
    await cargarLista();
  }
  if (modo === "listado")
    return (
      <main className="p-6 sm:p-9">
        <section>
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--borde)] pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
                Datos maestros
              </p>
              <h1 className="mt-1 text-3xl font-semibold">Socios de negocio</h1>
              <p className="mt-1 text-sm text-[var(--texto-suave)]">
                Clientes y proveedores en un único maestro.
              </p>
            </div>
            <a
              href="/socios-negocio/nuevo"
              className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
            >
              Nuevo socio
            </a>
          </header>
          <section className="mt-5 rounded-2xl border border-[var(--borde)] bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <label className="text-sm font-semibold">
                Buscar
                <input
                  autoFocus
                  className="mt-2 w-full rounded-xl border p-3"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Nombre, DNI/CUIT o palabra clave"
                />
              </label>
              <label className="text-sm font-semibold">
                Mostrar
                <select
                  className="mt-2 w-full rounded-xl border p-3"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="cliente">Clientes</option>
                  <option value="proveedor">Proveedores</option>
                  <option value="ambos">Cliente y proveedor</option>
                </select>
              </label>
            </div>
            <div className="mt-5 space-y-2">
              {lista.map((x) => (
                <div
                  key={x.id}
                  className="group flex items-center justify-between rounded-xl bg-[var(--fondo)] p-4 hover:bg-[var(--marca-clara)]"
                >
                  <span>
                    <b>{x.razon_social}</b>
                    <small className="mt-1 block text-[var(--texto-suave)]">
                      {x.tipo_documento} {x.numero_documento}
                    </small>
                  </span>
                  <span className="flex items-center gap-2">
                    {x.es_cliente && <Insignia texto="CLIENTE" />}
                    {x.es_proveedor && <Insignia texto="PROVEEDOR" />}
                    <a
                      href={`/socios-negocio/${x.id}`}
                      className="ml-2 rounded-lg border border-[var(--borde)] bg-white px-3 py-2 text-sm font-semibold text-[var(--marca)]"
                    >
                      ⚙ Editar
                    </a>
                    {x.activo && (
                      <button
                        onClick={() => void eliminarSocio(x)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700"
                      >
                        Eliminar
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    );
  const tabs: [Pestana, string][] = [
    ["general", "Datos generales"],
    ["fiscal", "Datos fiscales"],
    ["direcciones", "Direcciones"],
    ["agrupacion", "Cuentas agrupadoras"],
    ["cuenta_corriente", "Cuenta corriente"],
  ];
  return (
    <main className="p-6 sm:p-9">
      <section>
        <a
          href="/socios-negocio"
          className="mb-4 inline-block text-sm font-semibold text-[var(--marca)]"
        >
          ← Volver al listado
        </a>
        <header className="rounded-2xl border border-[var(--borde)] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--marca)]">
            {socio ? "Socio de negocio" : "Nuevo socio de negocio"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {razon || "Complete los datos"}
            </h1>
            {cliente && <Insignia texto="CLIENTE" />}
            {proveedor && <Insignia texto="PROVEEDOR" />}
          </div>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            {documento ? `${tipoDoc} ${documento}` : "Todavia no guardado"}
          </p>
          <nav className="mt-5 flex flex-wrap gap-1 border-t pt-4">
            {tabs
              .filter(([id]) => id !== "cuenta_corriente" || cliente)
              .map(([id, n]) => (
                <button
                  key={id}
                  onClick={() => setPestana(id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${pestana === id ? "bg-[var(--marca)] text-white" : "hover:bg-[var(--fondo)]"}`}
                >
                  {n}
                </button>
              ))}
          </nav>
        </header>
        {mensaje && (
          <p className="mt-4 rounded-xl bg-[var(--marca-clara)] p-3 text-sm text-[var(--marca)]">
            {mensaje}
          </p>
        )}
        <section className="mt-5 rounded-2xl border bg-white p-6">
          {(pestana === "general" || pestana === "fiscal") && (
            <form onSubmit={guardar}>
              {pestana === "general" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo
                    titulo="Razon social o nombre"
                    valor={razon}
                    cambiar={setRazon}
                  />
                  <Campo
                    titulo="Nombre fantasia"
                    valor={fantasia}
                    cambiar={setFantasia}
                    opcional
                  />
                  <Seleccion
                    titulo="Tipo de persona"
                    valor={persona}
                    cambiar={(v) => setPersona(v as "fisica" | "juridica")}
                    opciones={[
                      ["fisica", "FISICA"],
                      ["juridica", "JURIDICA"],
                    ]}
                  />
                  <Seleccion
                    titulo="Tipo de documento"
                    valor={tipoDoc}
                    cambiar={setTipoDoc}
                    opciones={["CUIT", "CUIL", "DNI", "CDI", "PASAPORTE"].map(
                      (x) => [x, x],
                    )}
                  />
                  <Campo
                    titulo="Numero de documento"
                    valor={documento}
                    cambiar={setDocumento}
                  />
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-semibold">
                      Roles del socio
                    </legend>
                    <div className="flex gap-5">
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={cliente}
                          onChange={(e) => setCliente(e.target.checked)}
                        />
                        Cliente
                      </label>
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={proveedor}
                          onChange={(e) => setProveedor(e.target.checked)}
                        />
                        Proveedor
                      </label>
                      {socio && (
                        <label className="flex gap-2">
                          <input
                            type="checkbox"
                            checked={activo}
                            onChange={(e) => setActivo(e.target.checked)}
                          />
                          Activo
                        </label>
                      )}
                    </div>
                  </fieldset>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm sm:col-span-2">
                    Condicion frente al IVA
                    <select
                      className="mt-1 w-full rounded-xl border p-3"
                      value={iva}
                      onChange={(e) => setIva(Number(e.target.value))}
                    >
                      {condiciones.map(([v, n]) => (
                        <option key={v} value={v}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Campo
                    titulo="Condicion IIBB"
                    valor={iibb}
                    cambiar={setIibb}
                    opcional
                  />
                  <Campo
                    titulo="Numero IIBB"
                    valor={numeroIibb}
                    cambiar={setNumeroIibb}
                    opcional
                  />
                  <Campo
                    titulo="Codigo actividad ARCA"
                    valor={actividad}
                    cambiar={setActividad}
                    opcional
                  />
                  <Campo
                    titulo="Descripcion actividad"
                    valor={actividadDetalle}
                    cambiar={setActividadDetalle}
                    opcional
                  />
                </div>
              )}
              <div className="mt-7 flex justify-end">
                <button className="rounded-xl bg-[var(--marca)] px-5 py-2.5 text-sm font-semibold text-white">
                  {socio ? "Guardar modificaciones" : "Crear socio"}
                </button>
              </div>
            </form>
          )}
          {pestana === "direcciones" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {cliente &&
                (socio ? (
                  <Direcciones
                    rol="cliente"
                    socio={socio}
                    items={domicilios.cliente}
                    recargar={cargarDomicilios}
                    informar={setMensaje}
                  />
                ) : (
                  <DireccionesBorrador
                    rol="cliente"
                    items={domiciliosBorrador.cliente}
                    cambiar={(items) =>
                      setDomiciliosBorrador((actual) => ({
                        ...actual,
                        cliente: items,
                      }))
                    }
                  />
                ))}{" "}
              {proveedor &&
                (socio ? (
                  <Direcciones
                    rol="proveedor"
                    socio={socio}
                    items={domicilios.proveedor}
                    recargar={cargarDomicilios}
                    informar={setMensaje}
                  />
                ) : (
                  <DireccionesBorrador
                    rol="proveedor"
                    items={domiciliosBorrador.proveedor}
                    cambiar={(items) =>
                      setDomiciliosBorrador((actual) => ({
                        ...actual,
                        proveedor: items,
                      }))
                    }
                  />
                ))}
            </div>
          )}
          {pestana === "agrupacion" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {cliente &&
                (socio ? (
                  <Agrupacion
                    rol="cliente"
                    socio={socio}
                    lista={lista}
                    informar={setMensaje}
                  />
                ) : (
                  <AgrupacionBorrador
                    rol="cliente"
                    valor={padreCliente}
                    cambiar={setPadreCliente}
                    lista={lista}
                  />
                ))}{" "}
              {proveedor &&
                (socio ? (
                  <Agrupacion
                    rol="proveedor"
                    socio={socio}
                    lista={lista}
                    informar={setMensaje}
                  />
                ) : (
                  <AgrupacionBorrador
                    rol="proveedor"
                    valor={padreProveedor}
                    cambiar={setPadreProveedor}
                    lista={lista}
                  />
                ))}
            </div>
          )}
          {pestana === "cuenta_corriente" && cliente && (
            <CuentaCorrienteVentas
              socio={socio}
              activa={cuentaActiva}
              setActiva={setCuentaActiva}
              limiteDeuda={limiteDeuda}
              setLimiteDeuda={setLimiteDeuda}
              limitePeriodo={limitePeriodo}
              setLimitePeriodo={setLimitePeriodo}
              temporalidad={temporalidad}
              setTemporalidad={setTemporalidad}
              diasDeuda={diasDeuda}
              setDiasDeuda={setDiasDeuda}
              informar={setMensaje}
            />
          )}
          {!socio &&
            (pestana === "direcciones" ||
              pestana === "agrupacion" ||
              pestana === "cuenta_corriente") && (
              <div className="mt-7 flex justify-end border-t pt-5">
                <button
                  onClick={() => void guardar()}
                  className="rounded-xl bg-[var(--marca)] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Crear socio con toda la ficha
                </button>
              </div>
            )}
        </section>
      </section>
    </main>
  );
}
function Insignia({ texto }: { texto: string }) {
  return (
    <span className="rounded-full bg-[var(--marca-clara)] px-3 py-1 text-xs font-bold text-[var(--marca)]">
      {texto}
    </span>
  );
}
function Campo({
  titulo,
  valor,
  cambiar,
  opcional = false,
}: {
  titulo: string;
  valor: string;
  cambiar: (v: string) => void;
  opcional?: boolean;
}) {
  return (
    <label className="text-sm">
      {titulo}
      <input
        required={!opcional}
        className="mt-1 w-full rounded-xl border p-3 uppercase"
        value={valor}
        onChange={(e) => cambiar(e.target.value.toUpperCase())}
      />
    </label>
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
      >
        {opciones.map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
function CuentaCorrienteVentas({
  socio,
  activa,
  setActiva,
  limiteDeuda,
  setLimiteDeuda,
  limitePeriodo,
  setLimitePeriodo,
  temporalidad,
  setTemporalidad,
  diasDeuda,
  setDiasDeuda,
  informar,
}: {
  socio: Socio | null;
  activa: boolean;
  setActiva: (v: boolean) => void;
  limiteDeuda: string;
  setLimiteDeuda: (v: string) => void;
  limitePeriodo: string;
  setLimitePeriodo: (v: string) => void;
  temporalidad: string;
  setTemporalidad: (v: string) => void;
  diasDeuda: string;
  setDiasDeuda: (v: string) => void;
  informar: (m: string) => void;
}) {
  async function guardar() {
    if (!socio) return;
    const r = await apiFetch(
      `${apiUrl}/articulos/socios/${socio.id}/cuenta-corriente-ventas`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activa,
          limite_deuda: limiteDeuda,
          limite_periodo: limitePeriodo,
          temporalidad,
          dias_maximos_deuda: Number(diasDeuda),
        }),
      },
    );
    const d = await r.json().catch(() => null);
    informar(
      r.ok
        ? "Cuenta corriente de ventas actualizada"
        : (d?.detail ?? "No tiene permiso para modificar la cuenta corriente"),
    );
  }
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Cuenta corriente de ventas</h2>
          <p className="mt-1 text-sm text-[var(--texto-suave)]">
            Condiciones para autorizar ventas financiadas al cliente.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-[var(--fondo)] px-4 py-3 font-semibold">
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
          />
          {activa ? "ACTIVA" : "INACTIVA"}
        </label>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Limite maximo de deuda
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-xl border p-3"
            value={limiteDeuda}
            onChange={(e) => setLimiteDeuda(e.target.value)}
          />
          <small className="mt-1 block text-[var(--texto-suave)]">
            Saldo total que nunca podra superarse.
          </small>
        </label>
        <label className="text-sm">
          Limite por temporalidad
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-xl border p-3"
            value={limitePeriodo}
            onChange={(e) => setLimitePeriodo(e.target.value)}
          />
          <small className="mt-1 block text-[var(--texto-suave)]">
            Nunca puede superar el limite total.
          </small>
        </label>
        <label className="text-sm">
          Temporalidad
          <select
            className="mt-1 w-full rounded-xl border p-3"
            value={temporalidad}
            onChange={(e) => setTemporalidad(e.target.value)}
          >
            <option value="diaria">DIARIA</option>
            <option value="semanal">SEMANAL</option>
            <option value="mensual">MENSUAL</option>
          </select>
        </label>
        <label className="text-sm">
          Dias maximos de deuda
          <input
            type="number"
            min="0"
            max="3650"
            className="mt-1 w-full rounded-xl border p-3"
            value={diasDeuda}
            onChange={(e) => setDiasDeuda(e.target.value)}
          />
          <small className="mt-1 block text-[var(--texto-suave)]">
            Se evaluara contra la deuda impaga mas antigua.
          </small>
        </label>
      </div>
      {socio ? (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => void guardar()}
            className="rounded-xl bg-[var(--marca)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Guardar condiciones
          </button>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          Estas condiciones se guardaran junto con el nuevo socio.
        </p>
      )}
    </section>
  );
}
function DireccionesBorrador({
  rol,
  items,
  cambiar,
}: {
  rol: Rol;
  items: DomicilioBorrador[];
  cambiar: (items: DomicilioBorrador[]) => void;
}) {
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  function agregar(e: FormEvent) {
    e.preventDefault();
    cambiar([
      ...items,
      {
        rol,
        calle,
        numero,
        localidad,
        provincia,
        pais: "ARGENTINA",
        contacto: contacto || null,
        telefono: telefono || null,
        email: email.trim().toLowerCase() || null,
      },
    ]);
    setCalle("");
    setNumero("");
    setLocalidad("");
    setProvincia("");
    setContacto("");
    setTelefono("");
    setEmail("");
  }
  return (
    <section className="rounded-xl bg-[var(--fondo)] p-4">
      <h2 className="font-semibold">Direcciones de {rol}</h2>
      <p className="mt-1 text-xs text-[var(--texto-suave)]">
        Se guardaran junto con el nuevo socio.
      </p>
      <div className="mt-3 space-y-2">
        {items.map((d, i) => (
          <div
            key={`${d.calle}-${d.numero}-${i}`}
            className="flex justify-between rounded-lg bg-white p-3 text-sm"
          >
            <span>
              <b>
                {d.calle} {d.numero}
              </b>
              <small className="block">
                {d.localidad}, {d.provincia}
              </small>
            </span>
            <button
              type="button"
              onClick={() => cambiar(items.filter((_, indice) => indice !== i))}
              className="text-red-700"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={agregar} className="mt-4 grid gap-2 sm:grid-cols-2">
        <Campo titulo="Calle" valor={calle} cambiar={setCalle} />
        <Campo titulo="Numero" valor={numero} cambiar={setNumero} />
        <Campo titulo="Localidad" valor={localidad} cambiar={setLocalidad} />
        <Campo titulo="Provincia" valor={provincia} cambiar={setProvincia} />
        <Campo
          titulo="Contacto"
          valor={contacto}
          cambiar={setContacto}
          opcional
        />
        <Campo
          titulo="Telefono"
          valor={telefono}
          cambiar={setTelefono}
          opcional
        />
        <label className="text-sm sm:col-span-2">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-xl border p-3 lowercase"
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
          />
        </label>
        <button className="rounded-xl border border-[var(--marca)] p-2 text-sm font-semibold text-[var(--marca)] sm:col-span-2">
          Agregar a la ficha
        </button>
      </form>
    </section>
  );
}
function AgrupacionBorrador({
  rol,
  valor,
  cambiar,
  lista,
}: {
  rol: Rol;
  valor: string;
  cambiar: (v: string) => void;
  lista: Socio[];
}) {
  const candidatos = lista.filter((x) =>
    rol === "cliente" ? x.es_cliente : x.es_proveedor,
  );
  return (
    <section className="rounded-xl bg-[var(--fondo)] p-4">
      <h2 className="font-semibold">Agrupacion de {rol}</h2>
      <p
        className={`mt-3 rounded-lg p-3 text-sm ${valor ? "bg-[var(--marca-clara)]" : "bg-amber-50"}`}
      >
        {valor
          ? `Se vinculara con ${candidatos.find((x) => x.id === valor)?.razon_social ?? "la cuenta seleccionada"}.`
          : "No esta relacionado con ninguna cuenta agrupadora."}
      </p>
      <select
        className="mt-3 w-full rounded-xl border p-3"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
      >
        <option value="">Sin cuenta agrupadora</option>
        {candidatos.map((x) => (
          <option key={x.id} value={x.id}>
            {x.razon_social}
          </option>
        ))}
      </select>
      <a
        href="/socios-negocio/nuevo"
        className="mt-3 inline-block text-sm font-semibold text-[var(--marca)]"
      >
        Crear otra cuenta padre
      </a>
    </section>
  );
}
function Direcciones({
  rol,
  socio,
  items,
  recargar,
  informar,
}: {
  rol: Rol;
  socio: Socio;
  items: Domicilio[];
  recargar: (id: string, roles: Rol[]) => Promise<void>;
  informar: (m: string) => void;
}) {
  const [calle, setCalle] = useState("");
  const [numero, setNumero] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  async function agregar(e: FormEvent) {
    e.preventDefault();
    const r = await apiFetch(`${apiUrl}/articulos/socios/${socio.id}/domicilios`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rol,
        tipo: "comercial",
        calle,
        numero,
        localidad,
        provincia,
        pais: "ARGENTINA",
        codigo_postal: null,
        contacto: null,
        telefono: null,
        email: null,
        es_principal: items.length === 0,
      }),
    });
    if (!r.ok) {
      const d = await r.json();
      informar(d.detail ?? "No se pudo guardar");
      return;
    }
    setCalle("");
    setNumero("");
    setLocalidad("");
    setProvincia("");
    await recargar(socio.id, [rol]);
  }
  async function eliminar(d: Domicilio) {
    if (!confirm(`¿Eliminar ${d.calle} ${d.numero}?`)) return;
    const r = await apiFetch(
      `${apiUrl}/articulos/socios/${socio.id}/domicilios/${d.id}`,
      { method: "DELETE", credentials: "include" },
    );
    if (r.ok) await recargar(socio.id, [rol]);
  }
  return (
    <section className="rounded-xl bg-[var(--fondo)] p-4">
      <h2 className="font-semibold">Direcciones de {rol}</h2>
      <div className="mt-3 space-y-2">
        {items.map((d) => (
          <div
            key={d.id}
            className="flex justify-between rounded-lg bg-white p-3 text-sm"
          >
            <span>
              <b>
                {d.calle} {d.numero}
              </b>
              <small className="block">
                {d.localidad}, {d.provincia}
              </small>
            </span>
            <button onClick={() => void eliminar(d)} className="text-red-700">
              Eliminar
            </button>
          </div>
        ))}
        {!items.length && (
          <p className="text-sm text-[var(--texto-suave)]">
            Sin direcciones de {rol}.
          </p>
        )}
      </div>
      <form onSubmit={agregar} className="mt-4 grid gap-2 sm:grid-cols-2">
        <Campo titulo="Calle" valor={calle} cambiar={setCalle} />
        <Campo titulo="Numero" valor={numero} cambiar={setNumero} />
        <Campo titulo="Localidad" valor={localidad} cambiar={setLocalidad} />
        <Campo titulo="Provincia" valor={provincia} cambiar={setProvincia} />
        <button className="rounded-xl bg-[var(--marca)] p-2 text-sm font-semibold text-white sm:col-span-2">
          Agregar direccion
        </button>
      </form>
    </section>
  );
}
function Agrupacion({
  rol,
  socio,
  lista,
  informar,
}: {
  rol: Rol;
  socio: Socio;
  lista: Socio[];
  informar: (m: string) => void;
}) {
  const inicial =
    rol === "cliente"
      ? socio.cuenta_padre_cliente_id
      : socio.cuenta_padre_proveedor_id;
  const [padre, setPadre] = useState(inicial ?? "");
  const candidatos = lista.filter(
    (x) =>
      x.id !== socio.id && (rol === "cliente" ? x.es_cliente : x.es_proveedor),
  );
  async function guardar() {
    const r = await apiFetch(
      `${apiUrl}/articulos/socios/${socio.id}/cuenta-padre`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol, cuenta_padre_id: padre || null }),
      },
    );
    if (!r.ok) {
      const d = await r.json();
      informar(d.detail ?? "No se pudo vincular");
      return;
    }
    informar(
      padre ? `Cuenta de ${rol} vinculada` : `Sin cuenta agrupadora de ${rol}`,
    );
  }
  return (
    <section className="rounded-xl bg-[var(--fondo)] p-4">
      <h2 className="font-semibold">Agrupacion de {rol}</h2>
      <p
        className={`mt-3 rounded-lg p-3 text-sm ${padre ? "bg-[var(--marca-clara)]" : "bg-amber-50"}`}
      >
        {padre
          ? `Vinculado con ${candidatos.find((x) => x.id === padre)?.razon_social ?? "cuenta seleccionada"}`
          : "No esta relacionado con ninguna cuenta agrupadora."}
      </p>
      <select
        className="mt-3 w-full rounded-xl border p-3"
        value={padre}
        onChange={(e) => setPadre(e.target.value)}
      >
        <option value="">Sin cuenta agrupadora</option>
        {candidatos.map((x) => (
          <option key={x.id} value={x.id}>
            {x.razon_social}
          </option>
        ))}
      </select>
      <div className="mt-3 flex justify-between">
        <a
          href="/socios-negocio/nuevo"
          className="text-sm font-semibold text-[var(--marca)]"
        >
          Crear cuenta padre
        </a>
        <button
          onClick={() => void guardar()}
          className="rounded-xl bg-[var(--marca)] px-4 py-2 text-sm font-semibold text-white"
        >
          Guardar
        </button>
      </div>
    </section>
  );
}
