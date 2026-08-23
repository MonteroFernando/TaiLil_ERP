"use client";

import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  ReactElement,
  ReactNode,
  TableHTMLAttributes,
  useState,
} from "react";

type Direccion = "asc" | "desc" | null;
type ElementoConHijos = ReactElement<{ children?: ReactNode; className?: string; value?: unknown }>;

const comparadorTexto = new Intl.Collator("es-AR", { numeric: true, sensitivity: "base" });

function textoNodo(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoNodo).join(" ");
  if (!isValidElement(nodo)) return "";
  const elemento = nodo as ElementoConHijos;
  if (elemento.type === "input" || elemento.type === "select") return String(elemento.props.value ?? "");
  return textoNodo(elemento.props.children);
}

function fechaLocal(texto: string): number | null {
  const partes = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i);
  if (!partes) return null;
  let hora = Number(partes[4] ?? 0);
  const periodo = (partes[7] ?? "").toLowerCase().replaceAll(" ", "").replaceAll(".", "");
  if (periodo === "pm" && hora < 12) hora += 12;
  if (periodo === "am" && hora === 12) hora = 0;
  const anio = Number(partes[3]);
  return new Date(anio < 100 ? 2000 + anio : anio, Number(partes[2]) - 1, Number(partes[1]), hora, Number(partes[5] ?? 0), Number(partes[6] ?? 0)).getTime();
}

function numeroLocal(texto: string): number | null {
  const limpio = texto.trim().replace(/ARS|\$|%/gi, "").replaceAll(" ", "");
  if (!limpio || /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(limpio)) return null;
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado = limpio;
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    normalizado = ultimaComa > ultimoPunto
      ? limpio.replaceAll(".", "").replace(",", ".")
      : limpio.replaceAll(",", "");
  } else if (ultimaComa >= 0) {
    normalizado = limpio.replaceAll(".", "").replace(",", ".");
  } else if ((limpio.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normalizado = limpio.replaceAll(".", "");
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function comparar(a: string, b: string): number {
  const vacioA = !a || a === "—";
  const vacioB = !b || b === "—";
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1;
  const fechaA = fechaLocal(a), fechaB = fechaLocal(b);
  if (fechaA !== null && fechaB !== null) return fechaA - fechaB;
  const numeroA = numeroLocal(a), numeroB = numeroLocal(b);
  if (numeroA !== null && numeroB !== null) return numeroA - numeroB;
  return comparadorTexto.compare(a, b);
}

function valoresOrdenFila(fila: ReactNode): string[] {
  if (!isValidElement(fila)) return [];
  const propiedades = fila.props as { "data-valores-orden"?: string; valoresOrden?: unknown[] };
  if (propiedades.valoresOrden) return propiedades.valoresOrden.map((valor) => String(valor ?? ""));
  const atributo = propiedades["data-valores-orden"];
  if (atributo) {
    try { return (JSON.parse(atributo) as unknown[]).map((valor) => String(valor ?? "")); }
    catch { return []; }
  }
  const hijos = Children.toArray((fila as ElementoConHijos).props.children);
  if (fila.type === Fragment) {
    const principal = hijos.find((hijo) => isValidElement(hijo) && hijo.type === "tr");
    return valoresOrdenFila(principal);
  }
  return hijos.map((celda) => textoNodo(celda).trim());
}

export default function TablaOrdenable({ children, ...propiedades }: TableHTMLAttributes<HTMLTableElement>) {
  const [columna, setColumna] = useState<number | null>(null);
  const [direccion, setDireccion] = useState<Direccion>(null);
  const elementos = Children.toArray(children);
  const encabezado = elementos.find((item) => isValidElement(item) && item.type === "thead") as ElementoConHijos | undefined;
  const cuerpo = elementos.find((item) => isValidElement(item) && item.type === "tbody") as ElementoConHijos | undefined;

  const filasOrdenadas = (() => {
    const filas = Children.toArray(cuerpo?.props.children);
    if (columna === null || direccion === null) return filas;
    return filas.map((fila, indice) => ({ fila, indice })).sort((a, b) => {
      if (!isValidElement(a.fila) || !isValidElement(b.fila)) return a.indice - b.indice;
      const celdasA = valoresOrdenFila(a.fila);
      const celdasB = valoresOrdenFila(b.fila);
      const resultado = comparar(celdasA[columna] ?? "", celdasB[columna] ?? "");
      return (direccion === "asc" ? resultado : -resultado) || a.indice - b.indice;
    }).map(({ fila }) => fila);
  })();

  function cambiarOrden(indice: number) {
    if (columna !== indice) { setColumna(indice); setDireccion("asc"); return; }
    if (direccion === "asc") { setDireccion("desc"); return; }
    if (direccion === "desc") { setColumna(null); setDireccion(null); return; }
    setDireccion("asc");
  }

  let encabezadoOrdenable = encabezado;
  if (encabezado) {
    const filasCabecera = Children.toArray(encabezado.props.children);
    encabezadoOrdenable = cloneElement(encabezado, {}, filasCabecera.map((fila) => {
      if (!isValidElement(fila)) return fila;
      const filaElemento = fila as ElementoConHijos;
      const celdas = Children.toArray(filaElemento.props.children);
      return cloneElement(filaElemento, {}, celdas.map((celda, indice) => {
        if (!isValidElement(celda)) return celda;
        const celdaElemento = celda as ElementoConHijos;
        const titulo = textoNodo(celdaElemento.props.children).trim();
        const esAccion = !titulo || /^(acción|accion|acciones)$/i.test(titulo);
        if (esAccion) return celda;
        const activa = columna === indice && direccion !== null;
        return cloneElement(celdaElemento, {
          className: `${celdaElemento.props.className ?? ""} tabla-ordenable-cabecera`.trim(),
          "aria-sort": activa ? (direccion === "asc" ? "ascending" : "descending") : "none",
        } as typeof celdaElemento.props, <button type="button" onClick={() => cambiarOrden(indice)} title={`Ordenar por ${titulo}`}><span>{celdaElemento.props.children}</span><i aria-hidden="true">{activa ? (direccion === "asc" ? "▲" : "▼") : "↕"}</i></button>);
      }));
    }));
  }

  const hijos = elementos.map((elemento) => elemento === encabezado
    ? encabezadoOrdenable
    : elemento === cuerpo && cuerpo ? cloneElement(cuerpo, {}, filasOrdenadas) : elemento);

  return <table {...propiedades}>{hijos}</table>;
}
