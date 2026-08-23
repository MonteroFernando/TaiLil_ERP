"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export type ValorExcel = string | number | boolean | Date | null | undefined;
export type FormatoExcel = "moneda" | "porcentaje" | "decimal" | "entero" | "fecha" | "texto";
export type CeldaExcel = { valor: ValorExcel; formato?: FormatoExcel };
export type ValorCeldaExcel = ValorExcel | CeldaExcel;
export type HojaExcel = {
  nombre: string;
  filas: ValorCeldaExcel[][];
  titulo?: string;
  subtitulo?: string;
  metadatos?: [string, ValorCeldaExcel][];
};

export function IconoExcel() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M5 3.5h9l5 5v12H5z" fill="currentColor" opacity=".2"/><path d="M14 3.5v5h5M8 10l4 7m0-7-4 7m7-5h2m-2 3h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

const formatoMoneda = '"$"#,##0.00;[Red]-"$"#,##0.00';

export function monedaExcel(valor: string | number | null | undefined): CeldaExcel {
  const numero = valor === null || valor === undefined || valor === "" ? null : Number(valor);
  return { valor: numero !== null && Number.isFinite(numero) ? numero : null, formato: "moneda" };
}

export function porcentajeExcel(valor: string | number | null | undefined): CeldaExcel {
  const numero = valor === null || valor === undefined || valor === "" ? null : Number(valor);
  return { valor: numero !== null && Number.isFinite(numero) ? numero / 100 : null, formato: "porcentaje" };
}

function esCeldaExcel(valor: ValorCeldaExcel): valor is CeldaExcel {
  return typeof valor === "object" && valor !== null && !(valor instanceof Date) && "valor" in valor;
}

function valorPlano(valor: ValorCeldaExcel): ValorExcel {
  return esCeldaExcel(valor) ? valor.valor : valor;
}

function aplicarFormato(celda: { numFmt: string }, formato?: FormatoExcel) {
  if (formato === "moneda") celda.numFmt = formatoMoneda;
  else if (formato === "porcentaje") celda.numFmt = "0.00%";
  else if (formato === "entero") celda.numFmt = "#,##0";
  else if (formato === "decimal") celda.numFmt = "#,##0.###";
  else if (formato === "fecha") celda.numFmt = "dd/mm/yyyy hh:mm";
  else if (formato === "texto") celda.numFmt = "@";
}

function nombreSeguro(nombre: string, usados: Set<string>) {
  const base = (nombre.replace(/[\\/*?:[\]]/g, " ").trim() || "Datos").slice(0, 31);
  let resultado = base;
  let numero = 2;
  while (usados.has(resultado)) {
    const sufijo = ` ${numero++}`;
    resultado = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
  }
  usados.add(resultado);
  return resultado;
}

export async function descargarLibroExcel(nombreArchivo: string, hojas: HojaExcel[]) {
  const ExcelJS = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  libro.creator = "TaiLil ERP";
  libro.created = new Date();
  const usados = new Set<string>();

  for (const hoja of hojas.filter((x) => x.filas.length)) {
    const cantidadColumnas = Math.max(1, ...hoja.filas.map((fila) => fila.length));
    const preambulo: ValorCeldaExcel[][] = [];
    if (hoja.titulo) preambulo.push([hoja.titulo]);
    if (hoja.subtitulo) preambulo.push([hoja.subtitulo]);
    if (hoja.metadatos?.length) preambulo.push(...hoja.metadatos.map(([campo, valor]) => [campo, valor]));
    if (preambulo.length) preambulo.push([]);
    const filaEncabezado = preambulo.length + 1;
    const planilla = libro.addWorksheet(nombreSeguro(hoja.nombre, usados), {
      views: [{ state: "frozen", ySplit: filaEncabezado }],
    });
    planilla.addRows([...preambulo, ...hoja.filas].map((fila) => fila.map(valorPlano)));
    if (hoja.titulo) {
      const filaTitulo = planilla.getRow(1);
      if (cantidadColumnas > 1) planilla.mergeCells(1, 1, 1, cantidadColumnas);
      filaTitulo.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
      filaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF064B33" } };
      filaTitulo.height = 28;
    }
    if (hoja.subtitulo) planilla.getRow(2).font = { italic: true, color: { argb: "FF5F7068" } };
    const encabezado = planilla.getRow(filaEncabezado);
    encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
    encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF39735A" } };
    encabezado.alignment = { vertical: "middle" };
    encabezado.height = 24;
    planilla.autoFilter = { from: { row: filaEncabezado, column: 1 }, to: { row: filaEncabezado, column: Math.max(1, encabezado.cellCount) } };
    planilla.eachRow((fila, numeroFila) => {
      if (numeroFila > filaEncabezado && (numeroFila - filaEncabezado) % 2 === 0) {
        fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F5FF" } };
      }
      fila.alignment = { vertical: "top" };
      fila.eachCell((celda, numeroColumna) => {
        const indiceDatos = numeroFila - filaEncabezado;
        const original = indiceDatos >= 0 ? hoja.filas[indiceDatos]?.[numeroColumna - 1] : undefined;
        const formato = original !== undefined && esCeldaExcel(original) ? original.formato : undefined;
        aplicarFormato(celda, formato);
        if (!formato && celda.value instanceof Date) celda.numFmt = "dd/mm/yyyy hh:mm";
        else if (!formato && typeof celda.value === "number") celda.numFmt = "#,##0.###";
      });
    });
    planilla.columns.forEach((columna) => {
      let ancho = 10;
      columna.eachCell?.({ includeEmpty: true }, (celda) => {
        const longitud = String(celda.value ?? "").length + 2;
        ancho = Math.max(ancho, Math.min(longitud, 45));
      });
      columna.width = ancho;
    });
  }
  if (!libro.worksheets.length) throw new Error("No hay tablas visibles para exportar");
  const contenido = await libro.xlsx.writeBuffer();
  const blob = new Blob([contenido], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `${nombreArchivo.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+$/g, "") || "TaiLil-ERP"}.xlsx`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

function textoCelda(celda: HTMLTableCellElement) {
  const controles = Array.from(celda.querySelectorAll("input, select, textarea"));
  if (controles.length) {
    return controles.map((control) => {
      if (control instanceof HTMLSelectElement) return control.selectedOptions[0]?.text ?? "";
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return control.value;
      return "";
    }).join(" · ");
  }
  return (celda.innerText || celda.textContent || "").replace(/\s+/g, " ").trim();
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function numeroDesdeTexto(texto: string): number | null {
  const candidato = texto.replace(/\bARS\b/gi, "").replace(/[$%]/g, "").trim();
  if (/[^0-9\s,.+()\-]/.test(candidato)) return null;
  const negativoPorParentesis = /^\(.*\)$/.test(candidato);
  const limpio = candidato.replace(/[()\s]/g, "");
  if (!limpio || !/[0-9]/.test(limpio)) return null;
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado = limpio;
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    const decimal = ultimaComa > ultimoPunto ? "," : ".";
    const miles = decimal === "," ? /\./g : /,/g;
    normalizado = limpio.replace(miles, "").replace(decimal, ".");
  } else if (ultimaComa >= 0) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    normalizado = limpio.replace(/,/g, "");
  }
  const numero = Number(normalizado) * (negativoPorParentesis ? -1 : 1);
  return Number.isFinite(numero) ? numero : null;
}

function fechaDesdeTexto(texto: string): Date | null {
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const fechaIso = new Date(
      Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]),
      Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0),
    );
    return Number.isNaN(fechaIso.getTime()) ? null : fechaIso;
  }
  const coincidencia = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!coincidencia) return null;
  const anioCorto = Number(coincidencia[3]);
  const fecha = new Date(
    anioCorto < 100 ? 2000 + anioCorto : anioCorto,
    Number(coincidencia[2]) - 1,
    Number(coincidencia[1]),
    Number(coincidencia[4] ?? 0),
    Number(coincidencia[5] ?? 0),
    Number(coincidencia[6] ?? 0),
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function convertirCeldaTabla(celda: HTMLTableCellElement, encabezado: string): ValorCeldaExcel {
  const texto = textoCelda(celda);
  const titulo = normalizar(encabezado);
  const tipoDeclarado = celda.dataset.excelTipo as FormatoExcel | undefined;
  const esIdentificador = /(^|\b)(codigo|cod\.?|documento|comprobante|cuit|cuil|dni|referencia|transaccion|telefono|numero|nro\.?)(\b|$)/.test(titulo);
  const esFecha = tipoDeclarado === "fecha" || /(^|\b)(fecha|fecha y hora)(\b|$)/.test(titulo);
  const esPorcentaje = tipoDeclarado === "porcentaje" || titulo.includes("%") || titulo.includes("porcentaje");
  const esMoneda = tipoDeclarado === "moneda" || /\$|\bARS\b/i.test(texto) || /(^|\b)(importe|precio|costo|venta|ventas|cobro|cobros|pago|pagos|saldo|deuda|efectivo|total bruto|total neto|margen bruto)(\b|$)/.test(titulo);
  if (tipoDeclarado === "texto" || esIdentificador) return { valor: texto, formato: "texto" };
  if (esFecha) {
    const fecha = fechaDesdeTexto(texto);
    return fecha ? { valor: fecha, formato: "fecha" } : texto;
  }
  const controlNumerico = celda.querySelector<HTMLInputElement>('input[type="number"]');
  const numero = controlNumerico && controlNumerico.value !== "" && Number.isFinite(controlNumerico.valueAsNumber)
    ? controlNumerico.valueAsNumber
    : numeroDesdeTexto(texto);
  if (numero === null) return esMoneda || esPorcentaje ? null : texto;
  if (esPorcentaje) return { valor: numero / 100, formato: "porcentaje" };
  if (esMoneda) return { valor: numero, formato: "moneda" };
  const entero = Number.isInteger(numero);
  return { valor: numero, formato: tipoDeclarado ?? (entero ? "entero" : "decimal") };
}

function visible(elemento: HTMLElement | null): elemento is HTMLElement {
  return Boolean(elemento && elemento.offsetParent !== null && getComputedStyle(elemento).visibility !== "hidden");
}

function textoControl(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control instanceof HTMLSelectElement) return Array.from(control.selectedOptions).map((opcion) => opcion.text).join(" · ");
  if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) return control.checked ? "SI" : "NO";
  return control.value;
}

function valorControlExcel(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): ValorCeldaExcel {
  const texto = textoControl(control);
  if (control instanceof HTMLInputElement && control.type === "number" && texto !== "" && Number.isFinite(control.valueAsNumber)) {
    return { valor: control.valueAsNumber, formato: Number.isInteger(control.valueAsNumber) ? "entero" : "decimal" };
  }
  if (control instanceof HTMLInputElement && (control.type === "date" || control.type === "datetime-local")) {
    const valor = fechaDesdeTexto(texto);
    return valor ? { valor, formato: "fecha" } : texto;
  }
  return texto;
}

function valorResumenExcel(texto: string): ValorCeldaExcel {
  const numero = numeroDesdeTexto(texto);
  if (numero === null) return texto;
  if (/\$|\bARS\b/i.test(texto)) return { valor: numero, formato: "moneda" };
  if (texto.includes("%")) return { valor: numero / 100, formato: "porcentaje" };
  return { valor: numero, formato: Number.isInteger(numero) ? "entero" : "decimal" };
}

function tituloControl(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, indice: number) {
  const etiqueta = control.closest("label");
  if (etiqueta) {
    const copia = etiqueta.cloneNode(true) as HTMLElement;
    copia.querySelectorAll("input,select,textarea,button,small").forEach((elemento) => elemento.remove());
    const texto = (copia.innerText || copia.textContent || "").replace(/\s+/g, " ").trim();
    if (texto) return texto;
  }
  return control.getAttribute("aria-label") || control.getAttribute("placeholder") || control.name || `Campo ${indice + 1}`;
}

function resumenPagina(principal: HTMLElement, titulo: string, subtitulo: string): HojaExcel {
  const filas: ValorCeldaExcel[][] = [["Tipo", "Título", "Valor"]];
  const agregados = new Set<string>();
  const agregar = (tipo: string, nombre: string, valor: ValorCeldaExcel) => {
    const clave = `${tipo}|${nombre}|${String(valorPlano(valor) ?? "")}`;
    if (!nombre || agregados.has(clave)) return;
    agregados.add(clave);
    filas.push([tipo, nombre, valor]);
  };
  principal.querySelectorAll<HTMLElement>("h2,h3").forEach((elemento) => {
    if (visible(elemento) && !elemento.closest("table,[role='dialog']")) agregar("Sección", (elemento.innerText || elemento.textContent || "").trim(), "");
  });
  principal.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea").forEach((control, indice) => {
    if (!visible(control) || control.type === "password" || control.type === "hidden" || control.closest("[role='dialog']")) return;
    agregar("Filtro / campo", tituloControl(control, indice), valorControlExcel(control));
  });
  principal.querySelectorAll<HTMLElement>("article,[class~='rounded-xl'],[class~='rounded-2xl']").forEach((tarjeta, indice) => {
    if (!visible(tarjeta) || tarjeta.querySelector("table,form") || tarjeta.closest("[role='dialog']")) return;
    const textoTarjeta = (tarjeta.innerText || tarjeta.textContent || "").replace(/\s+/g, " ").trim();
    if (!textoTarjeta || textoTarjeta.length > 260) return;
    const nombre = tarjeta.querySelector<HTMLElement>("h2,h3,small,p")?.innerText?.replace(/\s+/g, " ").trim() || `Indicador ${indice + 1}`;
    const valores = Array.from(tarjeta.querySelectorAll<HTMLElement>("strong,b")).filter(visible).map((elemento) => elemento.innerText.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (valores.length) agregar("Indicador", nombre, valores.length===1?valorResumenExcel(valores[0]):valores.join(" · "));
  });
  return {
    nombre: "Vista general",
    titulo,
    subtitulo,
    metadatos: [["Exportado", new Date()]],
    filas,
  };
}

function tituloTabla(tabla: HTMLTableElement, indice: number) {
  const filaDetalle = tabla.closest<HTMLTableRowElement>('tr[data-exportar-ignorar="true"]');
  const comprobante = filaDetalle?.previousElementSibling?.textContent?.replace(/\s+/g," ").trim();
  if (comprobante) return `Líneas · ${comprobante.slice(0,80)}`;
  let contenedor: HTMLElement|null = tabla.parentElement;
  while (contenedor && contenedor.tagName !== "MAIN") {
    const encabezado = Array.from(contenedor.querySelectorAll<HTMLElement>("h2,h3")).find((elemento)=>!elemento.closest("table"));
    const titulo = encabezado?.textContent?.trim();
    if (titulo) return titulo;
    contenedor = contenedor.parentElement;
  }
  return `Tabla ${indice + 1}`;
}

function tablaAHoja(tabla: HTMLTableElement, indice: number, tituloPagina: string, subtitulo: string, metadatos: [string, ValorCeldaExcel][]): HojaExcel {
  const titulo = tituloTabla(tabla,indice);
  const filaEncabezado = tabla.tHead?.rows[0] ?? null;
  const cantidadColumnas = Math.max(0, ...Array.from(tabla.rows).map((fila) => fila.cells.length));
  const encabezadosOriginales = filaEncabezado ? Array.from(filaEncabezado.cells).map(textoCelda) : Array.from({length:cantidadColumnas},(_,columna)=>`Columna ${columna+1}`);
  const columnasDatos = encabezadosOriginales.map((encabezado,columna)=>({encabezado,columna})).filter(({encabezado})=>encabezado && !/^(acción|accion|acciones)$/i.test(encabezado));
  const filasDatos = Array.from(tabla.tBodies).flatMap((cuerpo)=>Array.from(cuerpo.rows)).filter((fila) => !fila.hasAttribute("data-exportar-ignorar"));
  const filas: ValorCeldaExcel[][] = [columnasDatos.map(({encabezado})=>({valor:encabezado,formato:"texto" as const})),...filasDatos.map((fila)=>columnasDatos.map(({encabezado,columna})=>fila.cells[columna]?convertirCeldaTabla(fila.cells[columna],encabezado):null))];
  return { nombre: titulo, titulo: `${tituloPagina} · ${titulo}`, subtitulo, metadatos, filas };
}

export default function ExportarTablasPagina() {
  const [exportando, setExportando] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const [encabezado, setEncabezado] = useState<HTMLElement|null>(null);
  const ruta = usePathname();
  const selectorTablasExportables = ".erp-contenido main table";
  useEffect(() => {
    const actualizar = () => {
      const principal = document.querySelector<HTMLElement>(".erp-contenido > main");
      const cabecera = document.querySelector<HTMLElement>(".erp-contenido > main > header, .erp-contenido > main > section > header") ?? principal?.querySelector<HTMLElement>("header") ?? null;
      const exportadorPropio = cabecera?.querySelector(".erp-exportar-excel-encabezado:not([data-exportador-global])");
      setDisponible(Boolean(visible(principal) && cabecera && !exportadorPropio));
      setEncabezado(cabecera);
    };
    const temporizador = window.setTimeout(actualizar, 0);
    const observador = new MutationObserver(actualizar);
    observador.observe(document.body, { childList:true, subtree:true });
    return () => { window.clearTimeout(temporizador); observador.disconnect(); };
  }, [ruta]);
  async function exportar() {
    const principal = document.querySelector<HTMLElement>(".erp-contenido > main");
    if (!principal) return;
    const tablas = Array.from(document.querySelectorAll<HTMLTableElement>(selectorTablasExportables))
      .filter(visible);
    setExportando(true);
    try {
      const titulo = document.querySelector(".erp-contenido h1")?.textContent?.trim() || "TaiLil ERP";
      const subtitulo = encabezado?.querySelector("p:last-of-type")?.textContent?.trim() || "Reporte completo de pantalla";
      const controles = Array.from(principal.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea")).filter((control)=>visible(control)&&control.type!=="password"&&control.type!=="hidden"&&!control.closest("[role='dialog']"));
      const metadatos: [string,ValorCeldaExcel][] = controles.slice(0,12).map((control,indice)=>[tituloControl(control,indice),valorControlExcel(control)]);
      const hojas = [resumenPagina(principal,titulo,subtitulo),...tablas.map((tabla,indice)=>tablaAHoja(tabla,indice,titulo,subtitulo,metadatos))];
      await descargarLibroExcel(`${titulo}-${new Date().toISOString().slice(0, 10)}`, hojas);
    } finally {
      setExportando(false);
    }
  }
  if (!disponible || !encabezado) return null;
  return createPortal(<button type="button" data-exportador-global="true" onClick={()=>void exportar()} disabled={exportando} className="erp-exportar-excel-encabezado" title={exportando?"Generando Excel...":"Exportar pantalla completa a Excel"} aria-label={exportando?"Generando Excel":"Exportar pantalla completa a Excel"}><IconoExcel/></button>,encabezado);
}
