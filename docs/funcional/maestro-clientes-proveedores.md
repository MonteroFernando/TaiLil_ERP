# Maestro compartido de clientes y proveedores

El menu presenta un único modulo denominado **Socios de negocio**. El listado permite mostrar todos los socios, solamente clientes o solamente proveedores. Por defecto muestra todos y cada fila identifica sus roles con insignias visibles.

Durante un alta, todas las pestañas permanecen disponibles. El usuario puede completar datos generales, fiscales, direcciones de cada rol y cuentas agrupadoras antes de confirmar. El sistema crea la ficha completa en una unica transaccion; si algun dato es invalido, no guarda parcialmente el socio.

## Concepto

Clientes y proveedores son socios comerciales y comparten una unica identidad fiscal. Una persona o empresa puede cumplir ambos roles sin duplicar documento ni razon social. Los datos operativos, como domicilios y cuentas agrupadoras, conservan el rol desde el cual fueron cargados y no se mezclan.

## Identificacion y datos fiscales

- Razon social y nombre de fantasia.
- Persona fisica o juridica.
- Tipo de documento: CUIT, CUIL, DNI, CDI o pasaporte.
- Numero de documento, unico en el sistema.
- Condicion frente al IVA identificada con el codigo utilizado por ARCA.
- Condicion y numero de Ingresos Brutos.
- Codigo y descripcion de actividad declarada ante ARCA.
- Roles de proveedor y/o cliente.
- Estado activo o inactivo.

El DNI, CUIT u otro documento funciona como identificador visible del socio. No se solicita un codigo interno adicional. La columna tecnica `codigo` se conserva por compatibilidad y replica el documento.

Si se intenta registrar como cliente un documento que ya pertenece a un proveedor, o viceversa, se agrega el nuevo rol al mismo registro y se conserva el mismo `id` fiscal.

Cada domicilio esta vinculado mediante `socio_id` a un unico socio y además declara su rol `cliente` o `proveedor`. La ficha muestra solamente las direcciones de su propio rol. Puede tener varios domicilios y cada fila ofrece una accion **Eliminar** con confirmacion.

La ficha también informa si el registro no posee cuenta agrupadora. La vinculacion se realiza dentro de la misma ficha y solo permite elegir cuentas del rol actual. Cliente y proveedor pueden tener cuentas padre diferentes. Si la cuenta padre no existe, se puede iniciar su alta desde esa seccion.

Al iniciar un cliente nuevo, el sistema propone persona fisica, documento `DNI` y condicion `Consumidor Final`. Estos valores pueden modificarse si el cliente informa CUIT u otra condicion fiscal.

## Domicilios y contactos

Cada socio admite varios domicilios. En cada uno se registra tipo, calle, numero, localidad, provincia, pais, codigo postal, contacto, telefono y correo electronico. Puede señalarse un unico domicilio principal.

Los proveedores anteriores se conservan. Como no tenian documento fiscal, quedan identificados temporalmente como `PENDIENTE-{codigo}` para que el administrador complete el dato real.

## Cuenta padre y saldos agrupados

Un socio puede vincularse opcionalmente con otro socio que actua como cuenta padre. Los comprobantes siguen identificando al cliente o proveedor que los originó, pero Tesorería agrupa la deuda, los cobros, los pagos y los saldos disponibles en la cuenta padre. Al abrir la cuenta padre se ven y se pueden conciliar los documentos de todo el grupo; al abrir una hija se ve únicamente su actividad.

En clientes, la autorización para comprar a cuenta corriente permanece en cada cuenta hija: su límite total, límite por período, vencimiento y crédito ocupado se controlan con la deuda individual de ese cliente. La vinculación con una cuenta padre no comparte ni amplía esos límites.

La agrupación es reversible. Al desvincular una cuenta hija, sus comprobantes y su deuda dejan de incluirse en la cuenta padre y vuelven a presentarse automáticamente en la cuenta individual. No se trasladan ni duplican movimientos durante la vinculación o desvinculación.

No se permite que un socio sea su propio padre ni que se formen ciclos. Una cuenta padre puede agrupar clientes, proveedores o socios que cumplan ambos roles.
