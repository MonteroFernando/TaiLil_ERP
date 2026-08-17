# Implementacion tecnica de etiquetas

La ruta web `/ventas/etiquetas` consulta la lista activa `GENERAL` y reutiliza `GET /api/v1/articulos/precios/listas/{lista_id}/articulos?articulo_id=...`. No persiste documentos ni modifica precios.

Las dimensiones se expresan en unidades CSS `cm`: 7×3, 5×5, 10×10 y 10×5 centímetros de ancho por alto. El usuario las selecciona en nomenclatura comercial alto × ancho. La hoja de impresion oculta la navegacion, elimina margenes de pagina y distribuye las copias sin alterar su tamaño fisico.
