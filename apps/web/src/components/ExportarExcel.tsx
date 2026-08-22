"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type ValorExcel = string | number | boolean | Date | null | undefined;
export type FormatoExcel = "moneda" | "porcentaje" | "decimal" | "entero" | "fecha" | "texto";
export type CeldaExcel = { valor: ValorExcel; formato?: FormatoExcel };
export type ValorCeldaExcel = ValorExcel | CeldaExcel;
export type HojaExcel = { nombre: string; filas: ValorCeldaExcel[][] };

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
  else if (formato === "decimal") celda.numFmt = "#,##0.00######";
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
    const planilla = libro.addWorksheet(nombreSeguro(hoja.nombre, usados), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    planilla.addRows(hoja.filas.map((fila) => fila.map(valorPlano)));
    const encabezado = planilla.getRow(1);
    encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
    encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
    encabezado.alignment = { vertical: "middle" };
    encabezado.height = 24;
    planilla.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, encabezado.cellCount) } };
    planilla.eachRow((fila, numeroFila) => {
      if (numeroFila > 1 && numeroFila % 2 === 0) {
        fila.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F5FF" } };
      }
      fila.alignment = { vertical: "top" };
      fila.eachCell((celda, numeroColumna) => {
        const original = hoja.filas[numeroFila - 1]?.[numeroColumna - 1];
        const formato = original !== undefined && esCeldaExcel(original) ? original.formato : undefined;
        aplicarFormato(celda, formato);
        if (!formato && celda.value instanceof Date) celda.numFmt = "dd/mm/yyyy hh:mm";
        else if (!formato && typeof celda.value === "number") celda.numFmt = "#,##0.00######";
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

function tablaAHoja(tabla: HTMLTableElement, indice: number): HojaExcel {
  const contenedor = tabla.closest("section, article, div");
  const titulo = contenedor?.querySelector("h2, h3")?.textContent?.trim() || `Tabla ${indice + 1}`;
  const encabezados = Array.from(tabla.rows[0]?.cells ?? []).map(textoCelda);
  const filas = Array.from(tabla.rows).map((fila, numeroFila) => Array.from(fila.cells).map((celda, columna) =>
    numeroFila === 0 ? { valor: textoCelda(celda), formato: "texto" as const } : convertirCeldaTabla(celda, encabezados[columna] ?? ""),
  ));
  return { nombre: titulo, filas };
}

export default function ExportarTablasPagina() {
  const [exportando, setExportando] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const ruta = usePathname();
  const selectorTablasExportables = '.erp-contenido table[data-exportar-excel="true"]';
  useEffect(() => {
    const actualizar = () => setDisponible(Array.from(document.querySelectorAll<HTMLTableElement>(selectorTablasExportables)).some((tabla) => tabla.offsetParent !== null));
    const temporizador = window.setTimeout(actualizar, 0);
    const observador = new MutationObserver(actualizar);
    observador.observe(document.body, { childList:true, subtree:true });
    return () => { window.clearTimeout(temporizador); observador.disconnect(); };
  }, [ruta]);
  async function exportar() {
    const tablas = Array.from(document.querySelectorAll<HTMLTableElement>(selectorTablasExportables))
      .filter((tabla) => tabla.offsetParent !== null);
    if (!tablas.length) return;
    setExportando(true);
    try {
      const titulo = document.querySelector(".erp-contenido h1")?.textContent?.trim() || "TaiLil ERP";
      await descargarLibroExcel(`${titulo}-${new Date().toISOString().slice(0, 10)}`, tablas.map(tablaAHoja));
    } finally {
      setExportando(false);
    }
  }
  if (!disponible) return null;
  return <button type="button" onClick={()=>void exportar()} disabled={exportando} className="fixed bottom-5 right-5 z-40 rounded-xl border border-green-700 bg-white px-4 py-3 text-sm font-semibold text-green-800 shadow-lg disabled:opacity-50" title="Exporta los listados habilitados de esta pantalla">{exportando?"Generando Excel...":"Exportar listado · Excel"}</button>;
}
