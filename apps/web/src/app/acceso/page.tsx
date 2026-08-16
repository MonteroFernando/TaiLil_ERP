"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default function Acceso() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("admin");
  const [contrasena, setContrasena] = useState("");
  const [contrasenaNueva, setContrasenaNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [requiereCambio, setRequiereCambio] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setMensaje("");
    try {
      const respuesta = await fetch(`${apiUrl}/autenticacion/iniciar-sesion`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_usuario: usuario, contrasena }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detail ?? "No fue posible iniciar sesion");
      if (datos.usuario.debe_cambiar_contrasena) {
        setRequiereCambio(true);
        setMensaje("Por seguridad, reemplaza la contraseña inicial.");
      } else {
        router.push("/panel");
      }
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarContrasena(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (contrasenaNueva !== confirmacion) {
      setMensaje("La confirmacion no coincide con la contraseña nueva.");
      return;
    }
    setEnviando(true);
    setMensaje("");
    try {
      const respuesta = await fetch(`${apiUrl}/autenticacion/cambiar-contrasena`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contrasena_actual: contrasena,
          contrasena_nueva: contrasenaNueva,
        }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detail ?? "No fue posible cambiar la contraseña");
      router.push("/panel");
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "Ocurrio un error inesperado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border border-[var(--borde)] bg-white p-8 shadow-[0_24px_70px_rgba(21,35,27,0.10)] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--marca)]">
          Sistema de gestion
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">TaiLil ERP</h1>
        <p className="mt-3 leading-7 text-[var(--texto-suave)]">
          {requiereCambio
            ? "Define una contraseña personal para continuar."
            : "Ingresa con tu usuario para acceder al sistema."}
        </p>

        {!requiereCambio ? (
          <form className="mt-8 space-y-5" onSubmit={iniciarSesion}>
            <Campo etiqueta="Usuario" valor={usuario} cambiar={setUsuario} autoComplete="username" />
            <Campo
              etiqueta="Contraseña"
              valor={contrasena}
              cambiar={setContrasena}
              tipo="password"
              autoComplete="current-password"
            />
            <Boton enviando={enviando} texto="Ingresar" />
          </form>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={cambiarContrasena}>
            <Campo
              etiqueta="Contraseña nueva"
              valor={contrasenaNueva}
              cambiar={setContrasenaNueva}
              tipo="password"
              autoComplete="new-password"
            />
            <Campo
              etiqueta="Confirmar contraseña"
              valor={confirmacion}
              cambiar={setConfirmacion}
              tipo="password"
              autoComplete="new-password"
            />
            <p className="text-sm text-[var(--texto-suave)]">Debe contener al menos 10 caracteres.</p>
            <Boton enviando={enviando} texto="Guardar y continuar" />
          </form>
        )}

        {mensaje && (
          <p className="mt-5 rounded-xl bg-[var(--marca-clara)] px-4 py-3 text-sm text-[var(--marca)]">
            {mensaje}
          </p>
        )}
      </section>
    </main>
  );
}

function Campo({
  etiqueta,
  valor,
  cambiar,
  tipo = "text",
  autoComplete,
}: {
  etiqueta: string;
  valor: string;
  cambiar: (valor: string) => void;
  tipo?: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{etiqueta}</span>
      <input
        className="w-full rounded-xl border border-[var(--borde)] bg-white px-4 py-3 outline-none transition focus:border-[var(--marca)] focus:ring-3 focus:ring-[var(--marca-clara)]"
        value={valor}
        onChange={(evento) => cambiar(evento.target.value)}
        type={tipo}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}

function Boton({ enviando, texto }: { enviando: boolean; texto: string }) {
  return (
    <button
      className="w-full rounded-xl bg-[var(--marca)] px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      disabled={enviando}
      type="submit"
    >
      {enviando ? "Procesando..." : texto}
    </button>
  );
}
