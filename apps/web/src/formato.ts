export type ValorNumerico = string | number | null | undefined;

const formatoCantidad = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
  useGrouping: true,
});

const formatoMoneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function convertirNumero(valor: ValorNumerico): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (valor === null || valor === undefined || valor === "") return 0;
  const limpio = String(valor).trim().replace(/ARS|\$/gi, "").replaceAll(" ", "");
  const ultimaComa = limpio.lastIndexOf(",");
  const ultimoPunto = limpio.lastIndexOf(".");
  let normalizado = limpio;
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    normalizado = ultimaComa > ultimoPunto
      ? limpio.replaceAll(".", "").replace(",", ".")
      : limpio.replaceAll(",", "");
  } else if (ultimaComa >= 0) {
    normalizado = limpio.replace(",", ".");
  }
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

export function redondearCantidad(valor: ValorNumerico): number {
  const numero = convertirNumero(valor);
  return Math.round(numero * 1000) / 1000;
}

export function cantidadParaEntrada(valor: ValorNumerico): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return String(redondearCantidad(valor));
}

export function formatearCantidad(valor: ValorNumerico): string {
  return formatoCantidad.format(convertirNumero(valor));
}

export function formatearNumero(valor: ValorNumerico): string {
  return formatearCantidad(valor);
}

export function formatearMoneda(valor: ValorNumerico): string {
  return formatoMoneda.format(convertirNumero(valor));
}
