export type RequisitoManual =
  | { tipo: "publico" }
  | { tipo: "administrador" }
  | { tipo: "alguno"; permisos: string[] }
  | { tipo: "todos"; permisos: string[] };

export type SeccionManual = {
  id: string;
  orden: number;
  modulo: string;
  titulo: string;
  icono: string;
  resumen: string;
  paraQueSirve: string;
  ruta?: string;
  vista: "inicio" | "maestros" | "stock" | "compras" | "pos" | "notas" | "tesoreria" | "informes" | "accesos" | "impresion";
  requisito: RequisitoManual;
  pasos: string[];
  consejos: string[];
  palabrasClave: string[];
};

export const SECCIONES_MANUAL: SeccionManual[] = [
  {
    id: "primeros-pasos", orden: 1, modulo: "Introducción", titulo: "Primeros pasos", icono: "01",
    resumen: "Cómo ingresar, reconocer la pantalla y moverse sin perder información.",
    paraQueSirve: "El ERP reúne ventas, compras, stock, tesorería e informes. Cada persona ve solamente las opciones que tiene autorizadas.",
    ruta: "/panel", vista: "inicio", requisito: { tipo: "publico" },
    pasos: [
      "Ingrese con el usuario y la contraseña entregados por el administrador.",
      "Use el menú izquierdo para abrir un módulo. La opción marcada indica dónde se encuentra.",
      "Pulse el sol o la luna para cambiar entre tema claro y oscuro.",
      "Use el botón Manual para volver a esta ayuda desde cualquier pantalla.",
      "Al terminar, pulse Cerrar sesión para proteger su cuenta.",
    ],
    consejos: ["No comparta su contraseña.", "Si una opción no aparece, solicite el permiso correspondiente al administrador."],
    palabrasClave: ["ingresar", "login", "menú", "tema", "salir", "contraseña"],
  },
  {
    id: "panel", orden: 2, modulo: "Inicio", titulo: "Panel principal", icono: "02",
    resumen: "Resumen rápido de la actividad que puede consultar el usuario.",
    paraQueSirve: "Permite comenzar el trabajo y ver indicadores generales sin recorrer cada módulo.",
    ruta: "/panel", vista: "inicio", requisito: { tipo: "publico" },
    pasos: ["Abra Panel principal.", "Revise las tarjetas visibles.", "Cada tarjeta depende de sus permisos y muestra información actualizada del módulo."],
    consejos: ["El panel no modifica datos: es una pantalla de consulta."],
    palabrasClave: ["inicio", "dashboard", "resumen", "tarjetas"],
  },
  {
    id: "socios-articulos", orden: 3, modulo: "Datos maestros", titulo: "Clientes, proveedores y artículos", icono: "03",
    resumen: "Alta, búsqueda y mantenimiento de los datos principales del negocio.",
    paraQueSirve: "Los maestros evitan volver a escribir la misma información en cada operación y conservan el historial de cada entidad.",
    ruta: "/socios-negocio", vista: "maestros", requisito: { tipo: "alguno", permisos: ["datos_maestros.gestionar"] },
    pasos: [
      "Entre a Socios de negocio o Artículos.",
      "Busque por cualquier palabra, código, documento, código de barras o código de proveedor.",
      "Pulse Nuevo para dar de alta o abra una fila para modificarla.",
      "Complete los campos obligatorios y revise las pestañas de la ficha.",
      "Guarde y confirme el mensaje de resultado.",
    ],
    consejos: ["En artículos puede informar stock inicial; el movimiento queda registrado en el histórico.", "No cree duplicados: busque antes por nombre, documento y código."],
    palabrasClave: ["cliente", "proveedor", "artículo", "producto", "alta", "buscar", "stock inicial"],
  },
  {
    id: "stock-inventario", orden: 4, modulo: "Stock", titulo: "Stock, movimientos e inventarios", icono: "04",
    resumen: "Consulta existencias, registra conteos y explica diferencias de inventario.",
    paraQueSirve: "Permite saber qué hay en cada almacén y conservar la trazabilidad de ingresos, egresos, transferencias y ajustes.",
    ruta: "/stock", vista: "stock", requisito: { tipo: "alguno", permisos: ["inventario.gestionar"] },
    pasos: [
      "Seleccione el almacén y busque el artículo.",
      "Revise stock actual, reservado, disponible y movimientos históricos.",
      "Para contar mercadería, cree un inventario y agregue los artículos.",
      "Ingrese la cantidad contada y finalice cuando el conteo esté completo.",
      "El sistema registra el conteo incluso cuando la diferencia es cero.",
    ],
    consejos: ["No finalice un inventario sin verificar el almacén.", "Los históricos se muestran por fecha y hora en orden ascendente."],
    palabrasClave: ["stock", "inventario", "conteo", "diferencia", "almacén", "movimiento"],
  },
  {
    id: "compras", orden: 5, modulo: "Compras", titulo: "Compras, ingresos y reposición", icono: "05",
    resumen: "Registra la entrada de mercadería, las facturas y la sugerencia de compra.",
    paraQueSirve: "Separa el ingreso físico de la factura del proveedor y ayuda a reponer productos según su rotación real.",
    ruta: "/compras", vista: "compras", requisito: { tipo: "alguno", permisos: ["compras.gestionar"] },
    pasos: [
      "Registre el ingreso cuando llega la mercadería.",
      "Busque artículos por palabras, código interno, proveedor o código de barras.",
      "Cuando llegue la factura, vincúlela con el ingreso pendiente.",
      "Revise cantidades, costos y totales antes de confirmar.",
      "En Rotación y reposición elija período de análisis y días proyectados para obtener la compra sugerida.",
    ],
    consejos: ["El costo de compra es interno y no se muestra en el POS.", "La sugerencia MRP usa ventas de días en los que el artículo tuvo stock."],
    palabrasClave: ["compra", "ingreso", "factura proveedor", "costo", "rotación", "MRP", "reposición"],
  },
  {
    id: "punto-venta", orden: 6, modulo: "Ventas", titulo: "Punto de venta", icono: "06",
    resumen: "Carga productos, selecciona cliente, cobra y emite el comprobante.",
    paraQueSirve: "Es la pantalla de trabajo del cajero. Mantiene el total y el cobro visibles aunque la venta tenga muchas líneas.",
    ruta: "/ventas/pos", vista: "pos", requisito: { tipo: "alguno", permisos: ["ventas.caja.operar"] },
    pasos: [
      "Abra una caja y verifique el punto de venta y el almacén.",
      "Escanee el código de barras y pulse Enter; el foco queda listo para continuar.",
      "Seleccione un cliente si no corresponde Consumidor final.",
      "Revise cantidades, precios y total.",
      "Pulse Cobrar, elija expresamente uno o más medios y confirme.",
      "Si corresponde, active Impresión directa para imprimir y enviar el corte automáticamente.",
    ],
    consejos: ["F2 vuelve al campo de producto, F3 consulta precios y F10 abre el cobro.", "La cuenta corriente debe elegirse expresamente; un medio faltante impide confirmar."],
    palabrasClave: ["POS", "venta", "escanear", "código de barras", "cobrar", "ticket", "F2", "F3", "F10"],
  },
  {
    id: "cierre-caja", orden: 7, modulo: "Caja", titulo: "Arqueo y cierre de caja", icono: "07",
    resumen: "Controla los medios cobrados y cierra la caja propia al terminar el turno.",
    paraQueSirve: "Compara lo esperado por el sistema con lo declarado por el cajero, registra diferencias y conserva el cierre en el calendario histórico.",
    ruta: "/ventas/pos", vista: "tesoreria", requisito: { tipo: "alguno", permisos: ["ventas.caja.cerrar"] },
    pasos: [
      "Abra Caja y arqueo desde el acceso disponible en su operación.",
      "Revise ventas, cobros y total esperado por cada medio.",
      "Cuente el efectivo e informe las cantidades declaradas.",
      "Explique cualquier diferencia antes de confirmar.",
      "Cierre la caja y verifique que aparezca en el histórico del período.",
    ],
    consejos: ["El cajero solo puede controlar y cerrar su propia caja.", "Un cierre no borra ventas ni cobros: guarda una fotografía histórica del turno."],
    palabrasClave: ["caja", "arqueo", "cierre", "turno", "declarado", "esperado", "diferencia"],
  },
  {
    id: "notas-credito", orden: 8, modulo: "Ventas y compras", titulo: "Notas de crédito", icono: "08",
    resumen: "Revierte total o parcialmente un comprobante y conserva su vínculo.",
    paraQueSirve: "Corrige devoluciones o diferencias de precio sin borrar la factura original y recalcula importes, costo y margen.",
    ruta: "/notas-credito", vista: "notas", requisito: { tipo: "alguno", permisos: ["ventas.notas_credito.emitir", "compras.gestionar"] },
    pasos: [
      "Abra Notas de crédito desde el POS o el módulo autorizado.",
      "Busque y seleccione la factura que se corregirá.",
      "Elija devolución de artículos o nota narrativa por diferencia de precio.",
      "Indique cantidades, importe, motivo y caja cuando corresponda.",
      "Revise la factura vinculada y confirme.",
    ],
    consejos: ["La autorización para emitir notas de clientes es independiente del permiso de cajero.", "Nunca se elimina la factura original."],
    palabrasClave: ["nota de crédito", "devolución", "diferencia precio", "factura vinculada", "anular"],
  },
  {
    id: "tesoreria", orden: 9, modulo: "Tesorería", titulo: "Cuentas corrientes y conciliaciones", icono: "09",
    resumen: "Administra deudas, anticipos, cobros, pagos y aplicaciones entre documentos.",
    paraQueSirve: "Muestra quién debe, quién tiene saldo a favor y cómo se relaciona cada cobro o pago con sus facturas.",
    ruta: "/tesoreria", vista: "tesoreria", requisito: { tipo: "alguno", permisos: ["tesoreria.gestionar"] },
    pasos: [
      "Elija Clientes / cobros o Proveedores / pagos.",
      "Busque en el listado general y pulse Abrir cuenta.",
      "Revise deuda, saldo a favor y documentos pendientes en el modal.",
      "Registre el cobro o pago e indique cuánto aplicar a cada documento.",
      "Use Historial y conciliación para revisar aplicaciones anteriores.",
      "En Caja y arqueo declare valores y cierre el período operativo.",
    ],
    consejos: ["Un pago puede aplicarse a varias facturas y una factura a varios pagos.", "Si el saldo pendiente es cero, no existe importe para imputar."],
    palabrasClave: ["tesorería", "cuenta corriente", "deuda", "saldo a favor", "conciliar", "cobro", "pago", "cierre"],
  },
  {
    id: "informes", orden: 10, modulo: "Informes", titulo: "Informes, ventas y márgenes", icono: "10",
    resumen: "Consulta flujo de dinero, comprobantes, costos, margen monetario y porcentaje.",
    paraQueSirve: "Ayuda a controlar el negocio con filtros por fecha, cliente, producto, caja y tipo de comprobante.",
    ruta: "/informes", vista: "informes", requisito: { tipo: "alguno", permisos: ["informes.ver"] },
    pasos: [
      "Seleccione fecha desde y hasta.",
      "Abra Flujo de dinero o Ventas y márgenes.",
      "Aplique filtros de cliente, producto, caja o comprobante.",
      "Seleccione facturas y notas de crédito para ver rentabilidad combinada.",
      "Pulse el icono de Excel del encabezado para descargar valores numéricos calculables.",
    ],
    consejos: ["El precio de compra no se muestra en consultas comerciales; solo se utiliza internamente para el margen.", "El porcentaje de margen se calcula sobre el importe neto del comprobante."],
    palabrasClave: ["informe", "ventas", "margen", "rentabilidad", "flujo dinero", "Excel", "costo"],
  },
  {
    id: "impresion", orden: 11, modulo: "Impresión", titulo: "Tickets, etiquetas y archivos", icono: "11",
    resumen: "Elige vista previa o impresión directa y descarga información para trabajar fuera del ERP.",
    paraQueSirve: "Permite imprimir comprobantes y etiquetas con corte, o exportar listados habilitados a Excel.",
    ruta: "/ventas/etiquetas", vista: "impresion", requisito: { tipo: "alguno", permisos: ["ventas.caja.operar"] },
    pasos: [
      "En el POS elija Vista previa o Impresión directa.",
      "En impresión directa, confirme que la impresora y el corte estén configurados.",
      "Para etiquetas, seleccione tamaño, márgenes, artículos y cantidades.",
      "Use el icono verde de Excel únicamente en pantallas que muestran tablas exportables.",
    ],
    consejos: ["Realice una prueba antes de usar una nueva impresora.", "Los importes exportados son números con formato de moneda, nunca texto."],
    palabrasClave: ["imprimir", "ticket", "corte", "etiqueta", "Excel", "descargar"],
  },
  {
    id: "usuarios-permisos", orden: 12, modulo: "Administración", titulo: "Usuarios, perfiles y permisos", icono: "12",
    resumen: "Define qué puede ver y operar cada persona.",
    paraQueSirve: "Protege las funciones sensibles y simplifica el menú de cada usuario mostrando solamente lo necesario.",
    ruta: "/configuracion/accesos", vista: "accesos", requisito: { tipo: "administrador" },
    pasos: [
      "Abra Accesos y cree o seleccione un usuario.",
      "Asigne perfiles para tareas habituales y permisos individuales para excepciones.",
      "Guarde y solicite al usuario que vuelva a ingresar para verificar el menú.",
      "Use el perfil Cajero para operar POS, caja y cierre; otorgue notas de crédito solamente si corresponde.",
    ],
    consejos: ["Informes y notas de crédito tienen permisos independientes.", "Un módulo sin permiso no aparece en el menú y su ruta directa también queda protegida."],
    palabrasClave: ["usuario", "perfil", "permiso", "cajero", "administrador", "acceso"],
  },
];

export function puedeVerSeccion(
  requisito: RequisitoManual,
  permisos: string[],
  administrador: boolean,
) {
  if (administrador) return true;
  if (requisito.tipo === "publico") return true;
  if (requisito.tipo === "administrador") return false;
  if (requisito.tipo === "alguno") return requisito.permisos.some((permiso) => permisos.includes(permiso));
  return requisito.permisos.every((permiso) => permisos.includes(permiso));
}
