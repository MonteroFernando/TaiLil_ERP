const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

let renovacionEnCurso: Promise<boolean> | null = null;

function esEndpointDeAutenticacion(url: string): boolean {
  return [
    "/autenticacion/iniciar-sesion",
    "/autenticacion/renovar",
    "/autenticacion/cerrar-sesion",
  ].some((endpoint) => url.includes(endpoint));
}

async function renovarSesion(): Promise<boolean> {
  if (!renovacionEnCurso) {
    renovacionEnCurso = fetch(`${apiUrl}/autenticacion/renovar`, {
      method: "POST",
      credentials: "include",
    })
      .then((respuesta) => respuesta.ok)
      .catch(() => false)
      .finally(() => {
        renovacionEnCurso = null;
      });
  }

  return renovacionEnCurso;
}

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const solicitud = new Request(input, {
    ...init,
    credentials: init.credentials ?? "include",
  });
  const reintento = solicitud.clone();
  const respuesta = await fetch(solicitud);

  if (respuesta.status !== 401 || esEndpointDeAutenticacion(solicitud.url)) {
    return respuesta;
  }

  await renovarSesion();

  // El reintento tambien cubre una renovacion hecha en paralelo por otra pestana.
  return fetch(reintento);
}
