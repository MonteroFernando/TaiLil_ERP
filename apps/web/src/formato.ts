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

export function redondearCantidad(valor: ValorNumerico): number {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 1000) / 1000;
}

export function cantidadParaEntrada(valor: ValorNumerico): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return String(redondearCantidad(valor));
}

export function formatearCantidad(valor: ValorNumerico): string {
  const numero = Number(valor ?? 0);
  return formatoCantidad.format(Number.isFinite(numero) ? numero : 0);
}

export function formatearNumero(valor: ValorNumerico): string {
  return formatearCantidad(valor);
}

export function formatearMoneda(valor: ValorNumerico): string {
  const numero = Number(valor ?? 0);
  return formatoMoneda.format(Number.isFinite(numero) ? numero : 0);
}
