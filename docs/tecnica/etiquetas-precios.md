# Implementacion tecnica de etiquetas

La ruta web `/ventas/etiquetas` consulta la lista activa `GENERAL` y reutiliza `GET /api/v1/articulos/precios/listas/{lista_id}/articulos?articulo_id=...`. Tambien consulta `GET /api/v1/articulos/precios/articulos/{articulo_id}/reglas` y obtiene el precio de cada lista alternativa activa para mostrar sus cambios por cantidad. El campo interno `precio_base_bruto` no forma parte del modelo visual de la etiqueta. La pantalla no persiste documentos ni modifica precios.

Las dimensiones se expresan en unidades CSS `cm`: 7×3, 5×5, 10×10 y 10×5 centímetros de ancho por alto. El usuario las selecciona en nomenclatura comercial alto × ancho. La hoja de impresion oculta la navegacion, elimina margenes de pagina y distribuye las copias sin alterar su tamaño fisico.
