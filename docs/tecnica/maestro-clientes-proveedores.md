# Socios comerciales: clientes y proveedores

## Modelo

`socios` centraliza identidad, datos fiscales y los indicadores `es_proveedor` y `es_cliente`. `socios_domicilios` contiene la coleccion de domicilios con sus contactos y una columna `rol` obligatoria. La API exige y filtra ese rol para impedir que una direccion de cliente aparezca en proveedor o viceversa. `articulos_proveedores.proveedor_id` conserva su nombre por compatibilidad, pero ahora referencia `socios.id`.

`socios.cuenta_padre_cliente_id` y `socios.cuenta_padre_proveedor_id` son claves foraneas autorreferenciadas y opcionales. El servicio valida que el padre tenga el mismo rol, además de autorreferencias y ciclos. Tesorería resuelve la raíz de cada jerarquía por rol y publica el saldo consolidado una sola vez en esa raíz, sin mezclar clientes y proveedores. Los documentos conservan el `socio_id` que los originó y el cálculo operativo de crédito del POS continúa consultando exclusivamente ese socio. `cuenta_padre_id` queda transitoriamente por compatibilidad con migraciones anteriores.

La condicion frente al IVA usa los codigos publicados por el servicio de facturacion electronica de ARCA: 1, 4, 5, 6, 7, 8, 9, 10, 13, 15 y 16.

## API

```text
GET/POST /api/v1/articulos/proveedores
PUT      /api/v1/articulos/proveedores/{id}
GET/POST /api/v1/articulos/clientes
PUT      /api/v1/articulos/clientes/{id}
GET/POST /api/v1/articulos/socios/{id}/domicilios
PUT      /api/v1/articulos/socios/{id}/domicilios/{domicilio_id}
GET      /api/v1/articulos/socios
PUT      /api/v1/articulos/socios/{id}/cuenta-padre
```

Todas las escrituras se normalizan en mayusculas, excepto secretos y valores tecnicos excluidos por la regla transversal.
