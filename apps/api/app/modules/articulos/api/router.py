from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Sequence, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.normalizacion import normalizar_mayusculas
from app.infrastructure.database.sesion import obtener_sesion
from app.modules.articulos.api.schemas import (
    AjusteStockCrear,
    AlicuotaIvaVista,
    AlmacenActualizar,
    AlmacenCrear,
    AlmacenVista,
    ArticuloActualizar,
    ArticuloCrear,
    ArticuloDetalle,
    ArticuloIvaActualizar,
    ArticuloProveedorActualizar,
    ArticuloProveedorCrear,
    ArticuloProveedorVista,
    ArticuloResumen,
    ArticuloUnidadActualizar,
    ArticuloUnidadCrear,
    ArticuloUnidadVista,
    ClasificadorActualizar,
    ClasificadorCrear,
    ClasificadorVista,
    ClienteCrear,
    CodigoBarraActualizar,
    CodigoBarraCrear,
    CodigoBarraVista,
    CuentaCorrienteVentasConfigurar,
    CuentaCorrienteVentasVista,
    CuentaPadreSocioActualizar,
    DomicilioTerceroActualizar,
    DomicilioTerceroCrear,
    DomicilioTerceroVista,
    ExistenciaStockVista,
    InventarioConteoGuardar,
    InventarioStockCrear,
    InventarioStockDetalleVista,
    InventarioStockVista,
    ListaPrecioActualizar,
    ListaPrecioCrear,
    ListaPrecioVista,
    MovimientoStockDetalleVista,
    MovimientoStockVista,
    PosVentaCrear,
    PosVentaLineaVista,
    PosVentaVista,
    PrecioArticuloListaVista,
    PrecioBaseActualizar,
    PrecioListaArticuloActualizar,
    ProveedorActualizar,
    ProveedorCrear,
    ProveedorVista,
    ReglaListaPrecioCrear,
    ReglaListaPrecioVista,
    SocioNegocioActualizar,
    SocioNegocioAltaCompleta,
    StockArticuloVista,
    TerceroActualizar,
    TerceroVista,
    TransferenciaStockCrear,
    UnidadMedidaVista,
)
from app.modules.articulos.infrastructure.models import (
    AlicuotaIva,
    Almacen,
    Articulo,
    ArticuloClasificador,
    ArticuloProveedor,
    ArticuloUnidad,
    ClasificadorArticulo,
    CobroDocumento,
    CobroMedioPago,
    CodigoBarraArticulo,
    CuentaCorrienteVenta,
    DomicilioTercero,
    ImputacionCobroVenta,
    InventarioStock,
    InventarioStockDetalle,
    ListaPrecio,
    MovimientoStock,
    MovimientoStockDetalle,
    PrecioArticuloBase,
    PrecioArticuloLista,
    ReglaListaPrecioArticulo,
    StockArticuloAlmacen,
    Tercero,
    UnidadMedida,
    VentaDocumento,
    VentaDocumentoDetalle,
)
from app.modules.usuarios.api.dependencias import obtener_usuario_actual, requerir_permiso
from app.modules.usuarios.application.permisos import obtener_codigos_permisos
from app.modules.usuarios.infrastructure.models import Usuario

router = APIRouter(prefix="/articulos", tags=["Maestro de articulos"])


def unidad_vista(unidad: UnidadMedida) -> UnidadMedidaVista:
    return UnidadMedidaVista(
        id=unidad.id,
        codigo=unidad.codigo,
        nombre=unidad.nombre,
        simbolo=unidad.simbolo,
        admite_decimales=unidad.admite_decimales,
    )


def alicuota_iva_vista(alicuota: AlicuotaIva) -> AlicuotaIvaVista:
    return AlicuotaIvaVista(
        id=alicuota.id,
        codigo=alicuota.codigo,
        nombre=alicuota.nombre,
        porcentaje=alicuota.porcentaje,
    )


async def obtener_articulo_o_404(articulo_id: UUID, sesion: AsyncSession) -> Articulo:
    articulo = await sesion.get(Articulo, articulo_id)
    if articulo is None:
        raise HTTPException(status_code=404, detail="Articulo no encontrado")
    return articulo


async def validar_cuenta_padre(
    socio_id: UUID | None,
    cuenta_padre_id: UUID | None,
    sesion: AsyncSession,
    rol: str | None = None,
) -> None:
    """Impide padres inexistentes, autorreferencias y ciclos jerarquicos."""
    if cuenta_padre_id is None:
        return
    if socio_id == cuenta_padre_id:
        raise HTTPException(status_code=400, detail="Un socio no puede ser su propia cuenta padre")
    actual = await sesion.get(Tercero, cuenta_padre_id)
    if actual is None:
        raise HTTPException(status_code=400, detail="La cuenta padre no existe")
    if rol == "cliente" and not actual.es_cliente:
        raise HTTPException(status_code=400, detail="La cuenta padre no tiene rol de cliente")
    if rol == "proveedor" and not actual.es_proveedor:
        raise HTTPException(status_code=400, detail="La cuenta padre no tiene rol de proveedor")
    visitados: set[UUID] = set()
    campo_padre = f"cuenta_padre_{rol}_id" if rol else "cuenta_padre_id"
    siguiente_id = getattr(actual, campo_padre)
    while siguiente_id is not None:
        if actual.id in visitados or siguiente_id == socio_id:
            raise HTTPException(status_code=400, detail="La cuenta padre generaria un ciclo")
        visitados.add(actual.id)
        siguiente = await sesion.get(Tercero, siguiente_id)
        if siguiente is None:
            break
        actual = siguiente
        siguiente_id = getattr(actual, campo_padre)


async def construir_resumen(articulo: Articulo, sesion: AsyncSession) -> ArticuloResumen:
    unidad = await sesion.get(UnidadMedida, articulo.unidad_base_id)
    if unidad is None:
        raise RuntimeError("El articulo no tiene una unidad base valida")
    alicuota = await sesion.get(AlicuotaIva, articulo.alicuota_iva_id)
    if alicuota is None:
        raise RuntimeError("El articulo no tiene una alicuota de IVA valida")
    clasificador_ids = list(
        await sesion.scalars(
            select(ArticuloClasificador.clasificador_id).where(
                ArticuloClasificador.articulo_id == articulo.id
            )
        )
    )
    return ArticuloResumen(
        id=articulo.id,
        codigo=articulo.codigo,
        tipo_articulo=articulo.tipo_articulo,
        descripcion=articulo.descripcion,
        habilitado=articulo.habilitado,
        habilitado_venta=articulo.habilitado_venta,
        habilitado_compra=articulo.habilitado_compra,
        habilitado_inventario=articulo.habilitado_inventario,
        es_pesable=articulo.es_pesable,
        unidad_base=unidad_vista(unidad),
        alicuota_iva=alicuota_iva_vista(alicuota),
        clasificador_ids=clasificador_ids,
    )


@router.get(
    "/alicuotas-iva",
    response_model=list[AlicuotaIvaVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_alicuotas_iva(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[AlicuotaIva]:
    return list(
        await sesion.scalars(
            select(AlicuotaIva).where(AlicuotaIva.activa.is_(True)).order_by(AlicuotaIva.porcentaje)
        )
    )


@router.get(
    "/unidades-medida",
    response_model=list[UnidadMedidaVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_unidades(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[UnidadMedidaVista]:
    unidades = await sesion.scalars(
        select(UnidadMedida).where(UnidadMedida.activa.is_(True)).order_by(UnidadMedida.nombre)
    )
    return [unidad_vista(unidad) for unidad in unidades]


@router.get(
    "/proveedores",
    response_model=list[ProveedorVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_proveedores(
    buscar: str | None = Query(default=None, max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[Tercero]:
    consulta = (
        select(Tercero)
        .where(Tercero.es_proveedor.is_(True))
        .order_by(Tercero.razon_social)
        .limit(200)
    )
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Tercero.codigo.ilike(patron),
                    Tercero.razon_social.ilike(patron),
                    Tercero.nombre_fantasia.ilike(patron),
                    Tercero.numero_documento.ilike(patron),
                )
            )
    return list(await sesion.scalars(consulta))


@router.post(
    "/proveedores",
    response_model=ProveedorVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_proveedor(
    datos: ProveedorCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> Tercero:
    await validar_cuenta_padre(None, datos.cuenta_padre_id, sesion)
    documento = normalizar_mayusculas(datos.numero_documento)
    socio = await sesion.scalar(select(Tercero).where(Tercero.numero_documento == documento))
    if socio:
        if socio.es_proveedor:
            raise HTTPException(status_code=409, detail="El proveedor ya existe")
        socio.es_proveedor = True
        await sesion.commit()
        return socio
    codigo = datos.codigo.strip().upper()
    if await sesion.scalar(select(Tercero).where(Tercero.codigo == codigo)):
        raise HTTPException(status_code=409, detail="El codigo de proveedor ya existe")
    proveedor = Tercero(
        **datos.model_dump(exclude={"codigo", "numero_documento"}),
        codigo=codigo,
        numero_documento=documento,
        es_proveedor=True,
        es_cliente=False,
        activo=True,
    )
    sesion.add(proveedor)
    await sesion.commit()
    await sesion.refresh(proveedor)
    return proveedor


@router.get(
    "/proveedores/{proveedor_id}",
    response_model=ProveedorVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def obtener_proveedor(
    proveedor_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Tercero:
    proveedor = await sesion.get(Tercero, proveedor_id)
    if proveedor is None or not proveedor.es_proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return proveedor


@router.put(
    "/proveedores/{proveedor_id}",
    response_model=ProveedorVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_proveedor(
    proveedor_id: UUID,
    datos: ProveedorActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Tercero:
    proveedor = await sesion.get(Tercero, proveedor_id)
    if proveedor is None:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    await validar_cuenta_padre(proveedor_id, datos.cuenta_padre_id, sesion)
    codigo = normalizar_mayusculas(datos.codigo)
    codigo_repetido = await sesion.scalar(
        select(Tercero).where(Tercero.codigo == codigo, Tercero.id != proveedor_id)
    )
    if codigo_repetido:
        raise HTTPException(status_code=409, detail="El codigo de proveedor ya existe")
    documento = normalizar_mayusculas(datos.numero_documento)
    documento_repetido = await sesion.scalar(
        select(Tercero).where(Tercero.numero_documento == documento, Tercero.id != proveedor_id)
    )
    if documento_repetido:
        raise HTTPException(status_code=409, detail="El documento ya se encuentra registrado")
    for campo, valor in datos.model_dump(exclude={"activo", "numero_documento"}).items():
        setattr(proveedor, campo, valor)
    proveedor.codigo = codigo
    proveedor.numero_documento = documento
    proveedor.activo = datos.activo
    await sesion.commit()
    return proveedor


@router.get(
    "/clientes",
    response_model=list[TerceroVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_clientes(
    buscar: str | None = Query(default=None, max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[Tercero]:
    consulta = (
        select(Tercero)
        .where(Tercero.es_cliente.is_(True))
        .order_by(Tercero.razon_social)
        .limit(200)
    )
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Tercero.codigo.ilike(patron),
                    Tercero.razon_social.ilike(patron),
                    Tercero.nombre_fantasia.ilike(patron),
                    Tercero.numero_documento.ilike(patron),
                )
            )
    return list(await sesion.scalars(consulta))


@router.post(
    "/clientes",
    response_model=TerceroVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_cliente(
    datos: ClienteCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Tercero:
    await validar_cuenta_padre(None, datos.cuenta_padre_id, sesion)
    documento = normalizar_mayusculas(datos.numero_documento)
    tercero = await sesion.scalar(select(Tercero).where(Tercero.numero_documento == documento))
    if tercero:
        if tercero.es_cliente:
            raise HTTPException(status_code=409, detail="El cliente ya existe")
        tercero.es_cliente = True
        await sesion.commit()
        return tercero
    codigo = normalizar_mayusculas(datos.codigo)
    if await sesion.scalar(select(Tercero).where(Tercero.codigo == codigo)):
        raise HTTPException(status_code=409, detail="El codigo ya existe")
    tercero = Tercero(
        **datos.model_dump(exclude={"codigo", "numero_documento"}),
        codigo=codigo,
        numero_documento=documento,
        es_proveedor=False,
        es_cliente=True,
        activo=True,
    )
    sesion.add(tercero)
    await sesion.commit()
    await sesion.refresh(tercero)
    return tercero


@router.put(
    "/clientes/{cliente_id}",
    response_model=TerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_cliente(
    cliente_id: UUID,
    datos: TerceroActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Tercero:
    cliente = await sesion.get(Tercero, cliente_id)
    if cliente is None or not cliente.es_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await validar_cuenta_padre(cliente_id, datos.cuenta_padre_id, sesion)
    documento = normalizar_mayusculas(datos.numero_documento)
    codigo = documento
    repetido = await sesion.scalar(
        select(Tercero).where(
            or_(Tercero.codigo == codigo, Tercero.numero_documento == documento),
            Tercero.id != cliente_id,
        )
    )
    if repetido:
        raise HTTPException(status_code=409, detail="El codigo o documento ya existe")
    for campo, valor in datos.model_dump(exclude={"codigo", "numero_documento"}).items():
        setattr(cliente, campo, valor)
    cliente.codigo = codigo
    cliente.numero_documento = documento
    await sesion.commit()
    return cliente


@router.get(
    "/clientes/{cliente_id}",
    response_model=TerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def obtener_cliente(
    cliente_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Tercero:
    cliente = await sesion.get(Tercero, cliente_id)
    if cliente is None or not cliente.es_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.get(
    "/socios",
    response_model=list[TerceroVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_socios(
    buscar: str | None = Query(default=None, max_length=100),
    rol: str = Query(default="todos", pattern="^(todos|cliente|proveedor|ambos)$"),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[Tercero]:
    consulta = select(Tercero).order_by(Tercero.razon_social).limit(500)
    if rol == "cliente":
        consulta = consulta.where(Tercero.es_cliente.is_(True))
    elif rol == "proveedor":
        consulta = consulta.where(Tercero.es_proveedor.is_(True))
    elif rol == "ambos":
        consulta = consulta.where(Tercero.es_cliente.is_(True), Tercero.es_proveedor.is_(True))
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Tercero.codigo.ilike(patron),
                    Tercero.razon_social.ilike(patron),
                    Tercero.nombre_fantasia.ilike(patron),
                    Tercero.numero_documento.ilike(patron),
                )
            )
    return list(await sesion.scalars(consulta))


@router.post(
    "/socios",
    response_model=TerceroVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_socio_negocio(
    datos: SocioNegocioAltaCompleta,
    sesion: AsyncSession = Depends(obtener_sesion),
    usuario: Usuario = Depends(obtener_usuario_actual),
) -> Tercero:
    await validar_cuenta_padre(None, datos.cuenta_padre_id, sesion)
    await validar_cuenta_padre(None, datos.cuenta_padre_cliente_id, sesion, "cliente")
    await validar_cuenta_padre(None, datos.cuenta_padre_proveedor_id, sesion, "proveedor")
    documento = normalizar_mayusculas(datos.numero_documento)
    codigo = documento
    repetido = await sesion.scalar(
        select(Tercero).where(or_(Tercero.codigo == codigo, Tercero.numero_documento == documento))
    )
    if repetido:
        raise HTTPException(status_code=409, detail="El codigo o documento ya existe")
    valores = datos.model_dump(
        exclude={
            "codigo",
            "numero_documento",
            "domicilios",
            "cuenta_padre_cliente_id",
            "cuenta_padre_proveedor_id",
            "cuenta_corriente_ventas",
        }
    )
    socio = Tercero(
        **valores,
        codigo=codigo,
        numero_documento=documento,
        cuenta_padre_cliente_id=datos.cuenta_padre_cliente_id,
        cuenta_padre_proveedor_id=datos.cuenta_padre_proveedor_id,
        activo=True,
    )
    sesion.add(socio)
    await sesion.flush()
    for domicilio in datos.domicilios:
        if domicilio.rol == "cliente" and not datos.es_cliente:
            raise HTTPException(status_code=400, detail="Domicilio de cliente sin rol de cliente")
        if domicilio.rol == "proveedor" and not datos.es_proveedor:
            raise HTTPException(
                status_code=400,
                detail="Domicilio de proveedor sin rol de proveedor",
            )
        sesion.add(DomicilioTercero(tercero_id=socio.id, **domicilio.model_dump(), activo=True))
    if datos.cuenta_corriente_ventas is not None:
        permisos = set(await obtener_codigos_permisos(usuario, sesion))
        if not usuario.es_administrador and "ventas.cuenta_corriente.configurar" not in permisos:
            raise HTTPException(
                status_code=403,
                detail="Falta el permiso para configurar la cuenta corriente de ventas",
            )
        if not datos.es_cliente:
            raise HTTPException(
                status_code=400,
                detail="La cuenta corriente requiere rol de cliente",
            )
        sesion.add(
            CuentaCorrienteVenta(
                socio_id=socio.id,
                **datos.cuenta_corriente_ventas.model_dump(),
            )
        )
    await sesion.commit()
    await sesion.refresh(socio)
    return socio


@router.get(
    "/socios/{socio_id}",
    response_model=TerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def obtener_socio_negocio(
    socio_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Tercero:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None:
        raise HTTPException(status_code=404, detail="Socio de negocio no encontrado")
    return socio


@router.put(
    "/socios/{socio_id}",
    response_model=TerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_socio_negocio(
    socio_id: UUID,
    datos: SocioNegocioActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Tercero:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None:
        raise HTTPException(status_code=404, detail="Socio de negocio no encontrado")
    documento = normalizar_mayusculas(datos.numero_documento)
    codigo = documento
    repetido = await sesion.scalar(
        select(Tercero).where(
            or_(Tercero.codigo == codigo, Tercero.numero_documento == documento),
            Tercero.id != socio_id,
        )
    )
    if repetido:
        raise HTTPException(status_code=409, detail="El codigo o documento ya existe")
    for campo, valor in datos.model_dump(exclude={"codigo", "numero_documento"}).items():
        setattr(socio, campo, valor)
    socio.codigo = codigo
    socio.numero_documento = documento
    await sesion.commit()
    return socio


@router.delete(
    "/socios/{socio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_socio_negocio(
    socio_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Response:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None:
        raise HTTPException(status_code=404, detail="Socio de negocio no encontrado")
    socio.activo = False
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/socios/{socio_id}/cuenta-corriente-ventas",
    response_model=CuentaCorrienteVentasVista,
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def obtener_cuenta_corriente_ventas(
    socio_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> CuentaCorrienteVentasVista:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None or not socio.es_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cuenta = await sesion.scalar(
        select(CuentaCorrienteVenta).where(CuentaCorrienteVenta.socio_id == socio_id)
    )
    if cuenta is None:
        return CuentaCorrienteVentasVista(socio_id=socio_id)
    return CuentaCorrienteVentasVista(
        socio_id=socio_id,
        activa=cuenta.activa,
        limite_deuda=cuenta.limite_deuda,
        limite_periodo=cuenta.limite_periodo,
        temporalidad=cuenta.temporalidad,
        dias_maximos_deuda=cuenta.dias_maximos_deuda,
    )


@router.put(
    "/socios/{socio_id}/cuenta-corriente-ventas",
    response_model=CuentaCorrienteVentasVista,
    dependencies=[Depends(requerir_permiso("ventas.cuenta_corriente.configurar"))],
)
async def configurar_cuenta_corriente_ventas(
    socio_id: UUID,
    datos: CuentaCorrienteVentasConfigurar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> CuentaCorrienteVentasVista:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None or not socio.es_cliente:
        raise HTTPException(status_code=400, detail="El socio debe tener rol de cliente")
    cuenta = await sesion.scalar(
        select(CuentaCorrienteVenta).where(CuentaCorrienteVenta.socio_id == socio_id)
    )
    if cuenta is None:
        cuenta = CuentaCorrienteVenta(socio_id=socio_id, **datos.model_dump())
        sesion.add(cuenta)
    else:
        for campo, valor in datos.model_dump().items():
            setattr(cuenta, campo, valor)
    await sesion.commit()
    return CuentaCorrienteVentasVista(socio_id=socio_id, **datos.model_dump())


@router.put(
    "/socios/{socio_id}/cuenta-padre",
    response_model=TerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_cuenta_padre(
    socio_id: UUID,
    datos: CuentaPadreSocioActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Tercero:
    socio = await sesion.get(Tercero, socio_id)
    if socio is None:
        raise HTTPException(status_code=404, detail="Socio no encontrado")
    await validar_cuenta_padre(socio_id, datos.cuenta_padre_id, sesion, datos.rol)
    setattr(socio, f"cuenta_padre_{datos.rol}_id", datos.cuenta_padre_id)
    await sesion.commit()
    return socio


@router.get(
    "/socios/{tercero_id}/domicilios",
    response_model=list[DomicilioTerceroVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_domicilios(
    tercero_id: UUID,
    rol: str = Query(pattern="^(cliente|proveedor)$"),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[DomicilioTercero]:
    return list(
        await sesion.scalars(
            select(DomicilioTercero)
            .where(
                DomicilioTercero.tercero_id == tercero_id,
                DomicilioTercero.rol == rol,
            )
            .order_by(DomicilioTercero.es_principal.desc(), DomicilioTercero.tipo)
        )
    )


@router.post(
    "/socios/{tercero_id}/domicilios",
    response_model=DomicilioTerceroVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_domicilio(
    tercero_id: UUID,
    datos: DomicilioTerceroCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> DomicilioTercero:
    socio = await sesion.get(Tercero, tercero_id)
    if socio is None:
        raise HTTPException(status_code=404, detail="Tercero no encontrado")
    if datos.rol == "cliente" and not socio.es_cliente:
        raise HTTPException(status_code=400, detail="El socio no tiene rol de cliente")
    if datos.rol == "proveedor" and not socio.es_proveedor:
        raise HTTPException(status_code=400, detail="El socio no tiene rol de proveedor")
    if datos.es_principal:
        await sesion.execute(
            update(DomicilioTercero)
            .where(DomicilioTercero.tercero_id == tercero_id)
            .values(es_principal=False)
        )
    domicilio = DomicilioTercero(tercero_id=tercero_id, **datos.model_dump(), activo=True)
    sesion.add(domicilio)
    await sesion.commit()
    await sesion.refresh(domicilio)
    return domicilio


@router.put(
    "/socios/{tercero_id}/domicilios/{domicilio_id}",
    response_model=DomicilioTerceroVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_domicilio(
    tercero_id: UUID,
    domicilio_id: UUID,
    datos: DomicilioTerceroActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> DomicilioTercero:
    domicilio = await sesion.get(DomicilioTercero, domicilio_id)
    if domicilio is None or domicilio.tercero_id != tercero_id:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")
    if datos.es_principal:
        await sesion.execute(
            update(DomicilioTercero)
            .where(
                DomicilioTercero.tercero_id == tercero_id,
                DomicilioTercero.id != domicilio_id,
            )
            .values(es_principal=False)
        )
    for campo, valor in datos.model_dump().items():
        setattr(domicilio, campo, valor)
    await sesion.commit()
    return domicilio


@router.delete(
    "/socios/{tercero_id}/domicilios/{domicilio_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_domicilio(
    tercero_id: UUID,
    domicilio_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Response:
    domicilio = await sesion.get(DomicilioTercero, domicilio_id)
    if domicilio is None or domicilio.tercero_id != tercero_id:
        raise HTTPException(status_code=404, detail="Domicilio no encontrado")
    await sesion.delete(domicilio)
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/clasificadores",
    response_model=list[ClasificadorVista],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_clasificadores(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[ClasificadorArticulo]:
    return list(
        await sesion.scalars(
            select(ClasificadorArticulo).order_by(
                ClasificadorArticulo.tipo, ClasificadorArticulo.nombre
            )
        )
    )


@router.post(
    "/clasificadores",
    response_model=ClasificadorVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_clasificador(
    datos: ClasificadorCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> ClasificadorArticulo:
    if datos.padre_id and await sesion.get(ClasificadorArticulo, datos.padre_id) is None:
        raise HTTPException(status_code=400, detail="Clasificador padre inexistente")
    item = ClasificadorArticulo(**datos.model_dump(), activo=True)
    sesion.add(item)
    await sesion.commit()
    await sesion.refresh(item)
    return item


@router.put(
    "/clasificadores/{clasificador_id}",
    response_model=ClasificadorVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_clasificador(
    clasificador_id: UUID,
    datos: ClasificadorActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ClasificadorArticulo:
    item = await sesion.get(ClasificadorArticulo, clasificador_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Clasificador no encontrado")
    if datos.padre_id == item.id:
        raise HTTPException(status_code=400, detail="No puede ser su propio padre")
    for campo, valor in datos.model_dump().items():
        setattr(item, campo, valor)
    await sesion.commit()
    return item


@router.delete(
    "/clasificadores/{clasificador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_clasificador(
    clasificador_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Response:
    item = await sesion.get(ClasificadorArticulo, clasificador_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Clasificador no encontrado")
    item.activo = False
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/almacenes",
    response_model=list[AlmacenVista],
    dependencies=[Depends(requerir_permiso("inventario.ver"))],
)
async def listar_almacenes(sesion: AsyncSession = Depends(obtener_sesion)) -> list[Almacen]:
    return list(await sesion.scalars(select(Almacen).order_by(Almacen.codigo)))


@router.post(
    "/almacenes",
    response_model=AlmacenVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def crear_almacen(
    datos: AlmacenCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> Almacen:
    codigo = normalizar_mayusculas(datos.codigo)
    if await sesion.scalar(select(Almacen).where(Almacen.codigo == codigo)):
        raise HTTPException(status_code=409, detail="El codigo de almacen ya existe")
    almacen = Almacen(
        **datos.model_dump(exclude={"codigo"}), codigo=codigo, es_predeterminado=False, activo=True
    )
    sesion.add(almacen)
    await sesion.flush()
    articulos = list(await sesion.scalars(select(Articulo.id)))
    sesion.add_all([StockArticuloAlmacen(articulo_id=i, almacen_id=almacen.id) for i in articulos])
    await sesion.commit()
    await sesion.refresh(almacen)
    return almacen


@router.put(
    "/almacenes/{almacen_id}",
    response_model=AlmacenVista,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def actualizar_almacen(
    almacen_id: UUID, datos: AlmacenActualizar, sesion: AsyncSession = Depends(obtener_sesion)
) -> Almacen:
    almacen = await sesion.get(Almacen, almacen_id)
    if almacen is None:
        raise HTTPException(status_code=404, detail="Almacen no encontrado")
    if almacen.es_predeterminado and not datos.es_predeterminado:
        raise HTTPException(status_code=400, detail="Seleccione otro almacen predeterminado antes")
    if datos.es_predeterminado:
        await sesion.execute(
            update(Almacen).where(Almacen.id != almacen.id).values(es_predeterminado=False)
        )
    for campo, valor in datos.model_dump().items():
        setattr(almacen, campo, valor)
    await sesion.commit()
    return almacen


@router.delete(
    "/almacenes/{almacen_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def eliminar_almacen(
    almacen_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Response:
    almacen = await sesion.get(Almacen, almacen_id)
    if almacen is None:
        raise HTTPException(status_code=404, detail="Almacen no encontrado")
    if almacen.es_predeterminado:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar el almacen predeterminado",
        )
    almacen.activo = False
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def aplicar_impacto_stock(
    sesion: AsyncSession,
    movimiento: MovimientoStock,
    articulo: Articulo,
    almacen_id: UUID,
    cantidad: Decimal,
) -> None:
    stock = await sesion.scalar(
        select(StockArticuloAlmacen)
        .where(
            StockArticuloAlmacen.articulo_id == articulo.id,
            StockArticuloAlmacen.almacen_id == almacen_id,
        )
        .with_for_update()
    )
    if stock is None:
        stock = StockArticuloAlmacen(articulo_id=articulo.id, almacen_id=almacen_id)
        sesion.add(stock)
        await sesion.flush()
    anterior = stock.cantidad_fisica
    posterior = anterior + cantidad
    if posterior < 0:
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente para {articulo.codigo} - {articulo.descripcion}",
        )
    stock.cantidad_fisica = posterior
    sesion.add(
        MovimientoStockDetalle(
            movimiento_id=movimiento.id,
            articulo_id=articulo.id,
            almacen_id=almacen_id,
            cantidad_base=cantidad,
            unidad_medida_id=articulo.unidad_base_id,
            factor_conversion=Decimal("1"),
            saldo_anterior=anterior,
            saldo_posterior=posterior,
        )
    )


async def movimiento_stock_vista(
    movimiento: MovimientoStock,
    sesion: AsyncSession,
    articulo_id: UUID | None = None,
    almacen_id: UUID | None = None,
) -> MovimientoStockVista:
    usuario = await sesion.get(Usuario, movimiento.usuario_id)
    consulta_detalles = (
        select(MovimientoStockDetalle, Articulo, Almacen)
        .join(Articulo, Articulo.id == MovimientoStockDetalle.articulo_id)
        .join(Almacen, Almacen.id == MovimientoStockDetalle.almacen_id)
        .where(MovimientoStockDetalle.movimiento_id == movimiento.id)
    )
    if articulo_id:
        consulta_detalles = consulta_detalles.where(
            MovimientoStockDetalle.articulo_id == articulo_id
        )
    if almacen_id:
        consulta_detalles = consulta_detalles.where(MovimientoStockDetalle.almacen_id == almacen_id)
    filas = (await sesion.execute(consulta_detalles.order_by(MovimientoStockDetalle.id))).all()
    return MovimientoStockVista(
        id=movimiento.id,
        numero=movimiento.numero,
        tipo=movimiento.tipo,
        estado=movimiento.estado,
        almacen_origen_id=movimiento.almacen_origen_id,
        almacen_destino_id=movimiento.almacen_destino_id,
        observacion=movimiento.observacion,
        usuario_nombre=usuario.nombre_usuario if usuario else "USUARIO DESCONOCIDO",
        movimiento_revertido_id=movimiento.movimiento_revertido_id,
        fecha_confirmacion=movimiento.fecha_confirmacion,
        detalles=[
            MovimientoStockDetalleVista(
                id=detalle.id,
                articulo_id=articulo.id,
                articulo_codigo=articulo.codigo,
                articulo_descripcion=articulo.descripcion,
                almacen_id=almacen.id,
                almacen_codigo=almacen.codigo,
                cantidad_base=detalle.cantidad_base,
                saldo_anterior=detalle.saldo_anterior,
                saldo_posterior=detalle.saldo_posterior,
            )
            for detalle, articulo, almacen in filas
        ],
    )


async def nuevo_movimiento(
    sesion: AsyncSession,
    usuario: Usuario,
    tipo: str,
    observacion: str | None,
    almacen_origen_id: UUID | None = None,
    almacen_destino_id: UUID | None = None,
    movimiento_revertido_id: UUID | None = None,
) -> MovimientoStock:
    numero = await sesion.scalar(select(Sequence("secuencia_movimientos_stock").next_value()))
    movimiento = MovimientoStock(
        numero=numero,
        tipo=tipo,
        estado="CONFIRMADO",
        observacion=observacion,
        usuario_id=usuario.id,
        almacen_origen_id=almacen_origen_id,
        almacen_destino_id=almacen_destino_id,
        movimiento_revertido_id=movimiento_revertido_id,
    )
    sesion.add(movimiento)
    await sesion.flush()
    return movimiento


@router.get(
    "/stock/existencias",
    response_model=list[ExistenciaStockVista],
    dependencies=[Depends(requerir_permiso("inventario.ver"))],
)
async def listar_existencias_stock(
    almacen_id: UUID | None = None,
    articulo_id: UUID | None = None,
    buscar: str | None = Query(default=None, max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[ExistenciaStockVista]:
    consulta = (
        select(StockArticuloAlmacen, Articulo, Almacen)
        .join(Articulo, Articulo.id == StockArticuloAlmacen.articulo_id)
        .join(Almacen, Almacen.id == StockArticuloAlmacen.almacen_id)
        .where(Articulo.habilitado.is_(True))
        .order_by(Articulo.codigo, Almacen.codigo)
    )
    if almacen_id:
        consulta = consulta.where(StockArticuloAlmacen.almacen_id == almacen_id)
    if articulo_id:
        consulta = consulta.where(StockArticuloAlmacen.articulo_id == articulo_id)
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Articulo.codigo.ilike(patron),
                    Articulo.descripcion.ilike(patron),
                    Articulo.descripcion_ampliada.ilike(patron),
                    select(CodigoBarraArticulo.id)
                    .where(
                        CodigoBarraArticulo.articulo_id == Articulo.id,
                        CodigoBarraArticulo.codigo.ilike(patron),
                        CodigoBarraArticulo.activo.is_(True),
                    )
                    .exists(),
                    select(ArticuloProveedor.id)
                    .where(
                        ArticuloProveedor.articulo_id == Articulo.id,
                        ArticuloProveedor.codigo_proveedor.ilike(patron),
                        ArticuloProveedor.activo.is_(True),
                    )
                    .exists(),
                )
            )
    filas = (await sesion.execute(consulta.limit(500))).all()
    return [
        ExistenciaStockVista(
            articulo_id=articulo.id,
            articulo_codigo=articulo.codigo,
            articulo_descripcion=articulo.descripcion,
            almacen_id=almacen.id,
            almacen_codigo=almacen.codigo,
            almacen_descripcion=almacen.descripcion,
            cantidad_fisica=stock.cantidad_fisica,
            cantidad_pedida=stock.cantidad_pedida,
            cantidad_reservada=stock.cantidad_reservada,
            cantidad_disponible=stock.cantidad_fisica - stock.cantidad_reservada,
            cantidad_disponible_futura=(
                stock.cantidad_fisica + stock.cantidad_pedida - stock.cantidad_reservada
            ),
        )
        for stock, articulo, almacen in filas
    ]


@router.post(
    "/stock/ajustes",
    response_model=MovimientoStockVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def crear_ajuste_stock(
    datos: AjusteStockCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> MovimientoStockVista:
    almacen = await sesion.get(Almacen, datos.almacen_id)
    if almacen is None or not almacen.activo:
        raise HTTPException(status_code=400, detail="Almacen inexistente o inactivo")
    movimiento = await nuevo_movimiento(sesion, usuario, "AJUSTE", datos.observacion)
    for linea in datos.detalles:
        articulo = await sesion.get(Articulo, linea.articulo_id)
        if articulo is None or not articulo.habilitado_inventario:
            raise HTTPException(status_code=400, detail="Articulo no habilitado para inventario")
        await aplicar_impacto_stock(sesion, movimiento, articulo, almacen.id, linea.cantidad)
    await sesion.commit()
    await sesion.refresh(movimiento)
    return await movimiento_stock_vista(movimiento, sesion)


@router.post(
    "/stock/transferencias",
    response_model=MovimientoStockVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def crear_transferencia_stock(
    datos: TransferenciaStockCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> MovimientoStockVista:
    origen = await sesion.get(Almacen, datos.almacen_origen_id)
    destino = await sesion.get(Almacen, datos.almacen_destino_id)
    if origen is None or destino is None or not origen.activo or not destino.activo:
        raise HTTPException(status_code=400, detail="Almacen inexistente o inactivo")
    movimiento = await nuevo_movimiento(
        sesion,
        usuario,
        "TRANSFERENCIA",
        datos.observacion,
        origen.id,
        destino.id,
    )
    for linea in datos.detalles:
        articulo = await sesion.get(Articulo, linea.articulo_id)
        if articulo is None or not articulo.habilitado_inventario:
            raise HTTPException(status_code=400, detail="Articulo no habilitado para inventario")
        await aplicar_impacto_stock(sesion, movimiento, articulo, origen.id, -linea.cantidad)
        await aplicar_impacto_stock(sesion, movimiento, articulo, destino.id, linea.cantidad)
    await sesion.commit()
    await sesion.refresh(movimiento)
    return await movimiento_stock_vista(movimiento, sesion)


@router.get(
    "/stock/movimientos",
    response_model=list[MovimientoStockVista],
    dependencies=[Depends(requerir_permiso("inventario.ver"))],
)
async def listar_movimientos_stock(
    articulo_id: UUID | None = None,
    almacen_id: UUID | None = None,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[MovimientoStockVista]:
    consulta = (
        select(MovimientoStock)
        .order_by(MovimientoStock.fecha_confirmacion.desc(), MovimientoStock.numero.desc())
        .limit(200)
    )
    if articulo_id or almacen_id:
        filtros = [MovimientoStockDetalle.movimiento_id == MovimientoStock.id]
        if articulo_id:
            filtros.append(MovimientoStockDetalle.articulo_id == articulo_id)
        if almacen_id:
            filtros.append(MovimientoStockDetalle.almacen_id == almacen_id)
        consulta = consulta.where(select(MovimientoStockDetalle.id).where(*filtros).exists())
    movimientos = list(await sesion.scalars(consulta))
    return [
        await movimiento_stock_vista(movimiento, sesion, articulo_id, almacen_id)
        for movimiento in movimientos
    ]


async def inventario_stock_vista(
    inventario: InventarioStock, sesion: AsyncSession
) -> InventarioStockVista:
    almacen = await sesion.get(Almacen, inventario.almacen_id)
    creador = await sesion.get(Usuario, inventario.usuario_creacion_id)
    finalizador = (
        await sesion.get(Usuario, inventario.usuario_finalizacion_id)
        if inventario.usuario_finalizacion_id
        else None
    )
    filas = (
        await sesion.execute(
            select(InventarioStockDetalle, Articulo)
            .join(Articulo, Articulo.id == InventarioStockDetalle.articulo_id)
            .where(InventarioStockDetalle.inventario_id == inventario.id)
            .order_by(Articulo.codigo)
        )
    ).all()
    return InventarioStockVista(
        id=inventario.id,
        numero=inventario.numero,
        almacen_id=inventario.almacen_id,
        almacen_codigo=almacen.codigo if almacen else "",
        almacen_descripcion=almacen.descripcion if almacen else "",
        estado=inventario.estado,
        observacion=inventario.observacion,
        usuario_creacion=creador.nombre_usuario if creador else "USUARIO DESCONOCIDO",
        usuario_finalizacion=finalizador.nombre_usuario if finalizador else None,
        movimiento_ajuste_id=inventario.movimiento_ajuste_id,
        fecha_creacion=inventario.fecha_creacion,
        fecha_finalizacion=inventario.fecha_finalizacion,
        fecha_modificacion=inventario.fecha_modificacion,
        detalles=[
            InventarioStockDetalleVista(
                id=detalle.id,
                articulo_id=articulo.id,
                articulo_codigo=articulo.codigo,
                articulo_descripcion=articulo.descripcion,
                cantidad_esperada=detalle.cantidad_esperada,
                cantidad_contada=detalle.cantidad_contada,
                diferencia=(
                    detalle.cantidad_contada - detalle.cantidad_esperada
                    if detalle.cantidad_contada is not None
                    else None
                ),
                observacion=detalle.observacion,
            )
            for detalle, articulo in filas
        ],
    )


@router.get(
    "/stock/inventarios",
    response_model=list[InventarioStockVista],
    dependencies=[Depends(requerir_permiso("inventario.ver"))],
)
async def listar_inventarios_stock(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[InventarioStockVista]:
    inventarios = list(
        await sesion.scalars(
            select(InventarioStock).order_by(InventarioStock.numero.desc()).limit(100)
        )
    )
    return [await inventario_stock_vista(item, sesion) for item in inventarios]


@router.post(
    "/stock/inventarios",
    response_model=InventarioStockVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def crear_inventario_stock(
    datos: InventarioStockCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> InventarioStockVista:
    almacen = await sesion.get(Almacen, datos.almacen_id)
    if almacen is None or not almacen.activo:
        raise HTTPException(status_code=400, detail="Almacen inexistente o inactivo")
    articulos = list(
        await sesion.scalars(select(Articulo).where(Articulo.id.in_(datos.articulo_ids)))
    )
    if len(articulos) != len(datos.articulo_ids) or any(
        not articulo.habilitado_inventario for articulo in articulos
    ):
        raise HTTPException(status_code=400, detail="Articulo inexistente o no inventariable")
    numero = await sesion.scalar(select(Sequence("secuencia_inventarios_stock").next_value()))
    inventario = InventarioStock(
        numero=numero,
        almacen_id=almacen.id,
        estado="PENDIENTE",
        observacion=datos.observacion,
        usuario_creacion_id=usuario.id,
    )
    sesion.add(inventario)
    await sesion.flush()
    for articulo in articulos:
        stock = await sesion.scalar(
            select(StockArticuloAlmacen).where(
                StockArticuloAlmacen.articulo_id == articulo.id,
                StockArticuloAlmacen.almacen_id == almacen.id,
            )
        )
        sesion.add(
            InventarioStockDetalle(
                inventario_id=inventario.id,
                articulo_id=articulo.id,
                cantidad_esperada=stock.cantidad_fisica if stock else Decimal("0"),
            )
        )
    await sesion.commit()
    await sesion.refresh(inventario)
    return await inventario_stock_vista(inventario, sesion)


@router.get(
    "/stock/inventarios/{inventario_id}",
    response_model=InventarioStockVista,
    dependencies=[Depends(requerir_permiso("inventario.ver"))],
)
async def obtener_inventario_stock(
    inventario_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> InventarioStockVista:
    inventario = await sesion.get(InventarioStock, inventario_id)
    if inventario is None:
        raise HTTPException(status_code=404, detail="Inventario no encontrado")
    return await inventario_stock_vista(inventario, sesion)


@router.put(
    "/stock/inventarios/{inventario_id}/conteo",
    response_model=InventarioStockVista,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def guardar_conteo_inventario(
    inventario_id: UUID,
    datos: InventarioConteoGuardar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> InventarioStockVista:
    inventario = await sesion.get(InventarioStock, inventario_id)
    if inventario is None:
        raise HTTPException(status_code=404, detail="Inventario no encontrado")
    if inventario.estado != "PENDIENTE":
        raise HTTPException(status_code=409, detail="El inventario ya fue finalizado")
    for linea in datos.detalles:
        detalle = await sesion.get(InventarioStockDetalle, linea.detalle_id)
        if detalle is None or detalle.inventario_id != inventario.id:
            raise HTTPException(status_code=400, detail="Linea de inventario inexistente")
        detalle.cantidad_contada = linea.cantidad_contada
        detalle.observacion = linea.observacion
    await sesion.commit()
    return await inventario_stock_vista(inventario, sesion)


@router.post(
    "/stock/inventarios/{inventario_id}/finalizar",
    response_model=InventarioStockVista,
    dependencies=[Depends(requerir_permiso("inventario.gestionar"))],
)
async def finalizar_inventario_stock(
    inventario_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> InventarioStockVista:
    inventario = await sesion.get(InventarioStock, inventario_id)
    if inventario is None:
        raise HTTPException(status_code=404, detail="Inventario no encontrado")
    if inventario.estado != "PENDIENTE":
        raise HTTPException(status_code=409, detail="El inventario ya fue finalizado")
    detalles = list(
        await sesion.scalars(
            select(InventarioStockDetalle).where(
                InventarioStockDetalle.inventario_id == inventario.id
            )
        )
    )
    if any(detalle.cantidad_contada is None for detalle in detalles):
        raise HTTPException(status_code=409, detail="Faltan productos por contar")
    for detalle in detalles:
        stock_actual = await sesion.scalar(
            select(StockArticuloAlmacen)
            .where(
                StockArticuloAlmacen.articulo_id == detalle.articulo_id,
                StockArticuloAlmacen.almacen_id == inventario.almacen_id,
            )
            .with_for_update()
        )
        cantidad_actual = stock_actual.cantidad_fisica if stock_actual else Decimal("0")
        if cantidad_actual != detalle.cantidad_esperada:
            raise HTTPException(
                status_code=409,
                detail="El stock cambio durante el conteo; debe iniciar un nuevo inventario",
            )
    movimiento = await nuevo_movimiento(
        sesion,
        usuario,
        "AJUSTE_INVENTARIO",
        f"INVENTARIO FISICO {inventario.numero}",
    )
    for detalle in detalles:
        diferencia = detalle.cantidad_contada - detalle.cantidad_esperada
        if diferencia:
            articulo = await sesion.get(Articulo, detalle.articulo_id)
            if articulo:
                await aplicar_impacto_stock(
                    sesion, movimiento, articulo, inventario.almacen_id, diferencia
                )
    inventario.estado = "FINALIZADO"
    inventario.usuario_finalizacion_id = usuario.id
    inventario.movimiento_ajuste_id = movimiento.id
    inventario.fecha_finalizacion = datetime.now(UTC)
    await sesion.commit()
    return await inventario_stock_vista(inventario, sesion)


@router.get(
    "/precios/listas",
    response_model=list[ListaPrecioVista],
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def listar_listas_precios(
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[ListaPrecio]:
    return list(
        await sesion.scalars(
            select(ListaPrecio).order_by(ListaPrecio.es_base.desc(), ListaPrecio.nombre)
        )
    )


@router.post(
    "/precios/listas",
    response_model=ListaPrecioVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def crear_lista_precio(
    datos: ListaPrecioCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> ListaPrecio:
    lista = ListaPrecio(**datos.model_dump(), es_base=False, activa=True)
    sesion.add(lista)
    await sesion.commit()
    await sesion.refresh(lista)
    return lista


@router.put(
    "/precios/listas/{lista_id}",
    response_model=ListaPrecioVista,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def actualizar_lista_precio(
    lista_id: UUID,
    datos: ListaPrecioActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ListaPrecio:
    lista = await sesion.get(ListaPrecio, lista_id)
    if lista is None:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")
    if lista.es_base:
        raise HTTPException(status_code=409, detail="La lista COMPRAS no puede modificarse")
    for campo, valor in datos.model_dump().items():
        setattr(lista, campo, valor)
    await sesion.commit()
    return lista


async def precio_articulo_lista_vista(
    articulo: Articulo, lista: ListaPrecio, sesion: AsyncSession
) -> PrecioArticuloListaVista:
    base = await sesion.get(PrecioArticuloBase, articulo.id)
    precio_base = base.precio_bruto if base else Decimal("0")
    excepcion = await sesion.scalar(
        select(PrecioArticuloLista).where(
            PrecioArticuloLista.lista_precio_id == lista.id,
            PrecioArticuloLista.articulo_id == articulo.id,
        )
    )
    if lista.es_base:
        modo = "BASE"
        porcentaje = Decimal("0")
        precio = precio_base
    elif excepcion and excepcion.modo == "MANUAL":
        modo = "MANUAL"
        precio = excepcion.precio_manual or Decimal("0")
        porcentaje = (
            ((precio / precio_base) - Decimal("1")) * Decimal("100")
            if precio_base
            else Decimal("0")
        )
    else:
        modo = "PORCENTAJE" if excepcion else "PORCENTAJE GENERAL"
        porcentaje = (
            excepcion.porcentaje_incremento
            if excepcion and excepcion.porcentaje_incremento is not None
            else lista.porcentaje_incremento
        )
        precio = precio_base * (Decimal("1") + porcentaje / Decimal("100"))
    margen = (
        ((precio / precio_base) - Decimal("1")) * Decimal("100") if precio_base else Decimal("0")
    )
    return PrecioArticuloListaVista(
        articulo_id=articulo.id,
        articulo_codigo=articulo.codigo,
        articulo_descripcion=articulo.descripcion,
        precio_base_bruto=precio_base,
        modo=modo,
        porcentaje_aplicado=porcentaje,
        precio_venta_bruto=precio,
        margen_porcentual=margen,
    )


@router.get(
    "/precios/listas/{lista_id}/articulos",
    response_model=list[PrecioArticuloListaVista],
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def consultar_precios_lista(
    lista_id: UUID,
    articulo_id: UUID | None = None,
    buscar: str | None = Query(default=None, max_length=100),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[PrecioArticuloListaVista]:
    lista = await sesion.get(ListaPrecio, lista_id)
    if lista is None:
        raise HTTPException(status_code=404, detail="Lista de precios no encontrada")
    consulta = select(Articulo).where(Articulo.habilitado.is_(True))
    if articulo_id:
        consulta = consulta.where(Articulo.id == articulo_id)
    elif buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(Articulo.codigo.ilike(patron), Articulo.descripcion.ilike(patron))
            )
    else:
        return []
    articulos = list(await sesion.scalars(consulta.order_by(Articulo.codigo).limit(50)))
    return [await precio_articulo_lista_vista(a, lista, sesion) for a in articulos]


@router.put(
    "/precios/base/{articulo_id}",
    response_model=PrecioArticuloListaVista,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def actualizar_precio_base(
    articulo_id: UUID,
    datos: PrecioBaseActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> PrecioArticuloListaVista:
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    precio = await sesion.get(PrecioArticuloBase, articulo.id)
    if precio is None:
        precio = PrecioArticuloBase(articulo_id=articulo.id)
        sesion.add(precio)
    precio.precio_bruto = datos.precio_bruto
    await sesion.commit()
    lista = await sesion.scalar(select(ListaPrecio).where(ListaPrecio.es_base.is_(True)))
    return await precio_articulo_lista_vista(articulo, lista, sesion)


@router.put(
    "/precios/listas/{lista_id}/articulos/{articulo_id}",
    response_model=PrecioArticuloListaVista,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def configurar_precio_articulo_lista(
    lista_id: UUID,
    articulo_id: UUID,
    datos: PrecioListaArticuloActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> PrecioArticuloListaVista:
    lista = await sesion.get(ListaPrecio, lista_id)
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    if lista is None or lista.es_base:
        raise HTTPException(status_code=400, detail="Lista de venta no valida")
    item = await sesion.scalar(
        select(PrecioArticuloLista).where(
            PrecioArticuloLista.lista_precio_id == lista.id,
            PrecioArticuloLista.articulo_id == articulo.id,
        )
    )
    if item is None:
        item = PrecioArticuloLista(lista_precio_id=lista.id, articulo_id=articulo.id)
        sesion.add(item)
    item.modo = datos.modo
    item.porcentaje_incremento = datos.porcentaje_incremento if datos.modo == "PORCENTAJE" else None
    item.precio_manual = datos.precio_manual if datos.modo == "MANUAL" else None
    await sesion.commit()
    return await precio_articulo_lista_vista(articulo, lista, sesion)


@router.delete(
    "/precios/listas/{lista_id}/articulos/{articulo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def restaurar_precio_general_lista(
    lista_id: UUID, articulo_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> Response:
    await sesion.execute(
        delete(PrecioArticuloLista).where(
            PrecioArticuloLista.lista_precio_id == lista_id,
            PrecioArticuloLista.articulo_id == articulo_id,
        )
    )
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/precios/articulos/{articulo_id}/reglas",
    response_model=list[ReglaListaPrecioVista],
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def listar_reglas_precio_articulo(
    articulo_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> list[ReglaListaPrecioVista]:
    filas = (
        await sesion.execute(
            select(ReglaListaPrecioArticulo, ListaPrecio)
            .join(ListaPrecio, ListaPrecio.id == ReglaListaPrecioArticulo.lista_precio_id)
            .where(ReglaListaPrecioArticulo.articulo_id == articulo_id)
            .order_by(ReglaListaPrecioArticulo.cantidad_minima)
        )
    ).all()
    return [
        ReglaListaPrecioVista(
            id=regla.id,
            lista_precio_id=lista.id,
            lista_nombre=lista.nombre,
            cantidad_minima=regla.cantidad_minima,
            activa=regla.activa,
        )
        for regla, lista in filas
    ]


@router.get(
    "/precios/articulos/{articulo_id}/resolver-lista",
    response_model=ListaPrecioVista,
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def resolver_lista_precio_articulo(
    articulo_id: UUID,
    cantidad_base: Annotated[Decimal, Query(gt=0)],
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ListaPrecio:
    regla = await sesion.scalar(
        select(ReglaListaPrecioArticulo)
        .join(ListaPrecio, ListaPrecio.id == ReglaListaPrecioArticulo.lista_precio_id)
        .where(
            ReglaListaPrecioArticulo.articulo_id == articulo_id,
            ReglaListaPrecioArticulo.activa.is_(True),
            ReglaListaPrecioArticulo.cantidad_minima < cantidad_base,
            ListaPrecio.activa.is_(True),
        )
        .order_by(ReglaListaPrecioArticulo.cantidad_minima.desc())
        .limit(1)
    )
    if regla:
        return await sesion.get(ListaPrecio, regla.lista_precio_id)
    general = await sesion.scalar(
        select(ListaPrecio).where(ListaPrecio.nombre == "GENERAL", ListaPrecio.activa.is_(True))
    )
    if general is None:
        raise HTTPException(status_code=409, detail="No existe una lista GENERAL activa")
    return general


async def resolver_lista_venta(
    articulo_id: UUID, cantidad_base: Decimal, sesion: AsyncSession
) -> ListaPrecio:
    """Resuelve internamente la escala comercial aplicable a una cantidad."""
    regla = await sesion.scalar(
        select(ReglaListaPrecioArticulo)
        .join(ListaPrecio, ListaPrecio.id == ReglaListaPrecioArticulo.lista_precio_id)
        .where(
            ReglaListaPrecioArticulo.articulo_id == articulo_id,
            ReglaListaPrecioArticulo.activa.is_(True),
            ReglaListaPrecioArticulo.cantidad_minima < cantidad_base,
            ListaPrecio.activa.is_(True),
        )
        .order_by(ReglaListaPrecioArticulo.cantidad_minima.desc())
        .limit(1)
    )
    if regla:
        lista = await sesion.get(ListaPrecio, regla.lista_precio_id)
        if lista:
            return lista
    general = await sesion.scalar(
        select(ListaPrecio).where(ListaPrecio.nombre == "GENERAL", ListaPrecio.activa.is_(True))
    )
    if general is None:
        raise HTTPException(status_code=409, detail="No existe una lista GENERAL activa")
    return general


@router.get(
    "/pos/precio",
    response_model=PrecioArticuloListaVista,
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def consultar_precio_pos(
    articulo_id: UUID,
    cantidad_base: Annotated[Decimal, Query(gt=0)],
    sesion: AsyncSession = Depends(obtener_sesion),
) -> PrecioArticuloListaVista:
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    if not articulo.habilitado or not articulo.habilitado_venta:
        raise HTTPException(status_code=400, detail="Articulo no habilitado para venta")
    lista = await resolver_lista_venta(articulo.id, cantidad_base, sesion)
    return await precio_articulo_lista_vista(articulo, lista, sesion)


@router.post(
    "/precios/articulos/{articulo_id}/reglas",
    response_model=ReglaListaPrecioVista,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def crear_regla_precio_articulo(
    articulo_id: UUID,
    datos: ReglaListaPrecioCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ReglaListaPrecioVista:
    await obtener_articulo_o_404(articulo_id, sesion)
    lista = await sesion.get(ListaPrecio, datos.lista_precio_id)
    if lista is None or lista.es_base or not lista.activa:
        raise HTTPException(status_code=400, detail="Lista de venta no valida")
    regla = ReglaListaPrecioArticulo(articulo_id=articulo_id, **datos.model_dump(), activa=True)
    sesion.add(regla)
    await sesion.commit()
    await sesion.refresh(regla)
    return ReglaListaPrecioVista(
        id=regla.id,
        lista_precio_id=lista.id,
        lista_nombre=lista.nombre,
        cantidad_minima=regla.cantidad_minima,
        activa=regla.activa,
    )


@router.delete(
    "/precios/articulos/{articulo_id}/reglas/{regla_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def eliminar_regla_precio_articulo(
    articulo_id: UUID,
    regla_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Response:
    await sesion.execute(
        delete(ReglaListaPrecioArticulo).where(
            ReglaListaPrecioArticulo.id == regla_id,
            ReglaListaPrecioArticulo.articulo_id == articulo_id,
        )
    )
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def importe_dos_decimales(valor: Decimal) -> Decimal:
    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def venta_pos_vista(venta: VentaDocumento, sesion: AsyncSession) -> PosVentaVista:
    cliente = await sesion.get(Tercero, venta.cliente_id)
    filas = (
        await sesion.execute(
            select(VentaDocumentoDetalle, Articulo, ListaPrecio)
            .join(Articulo, Articulo.id == VentaDocumentoDetalle.articulo_id)
            .join(ListaPrecio, ListaPrecio.id == VentaDocumentoDetalle.lista_precio_id)
            .where(VentaDocumentoDetalle.venta_id == venta.id)
            .order_by(VentaDocumentoDetalle.id)
        )
    ).all()
    cobro = await sesion.scalar(
        select(CobroDocumento)
        .join(ImputacionCobroVenta, ImputacionCobroVenta.cobro_id == CobroDocumento.id)
        .where(ImputacionCobroVenta.venta_id == venta.id)
        .order_by(CobroDocumento.fecha_realizacion.desc())
        .limit(1)
    )
    return PosVentaVista(
        id=venta.id,
        numero=venta.numero,
        cliente_id=venta.cliente_id,
        cliente_nombre=cliente.razon_social if cliente else "CLIENTE DESCONOCIDO",
        almacen_id=venta.almacen_id,
        estado=venta.estado,
        subtotal_neto=venta.subtotal_neto,
        total_iva=venta.total_iva,
        total_bruto=venta.total_bruto,
        saldo_pendiente=venta.saldo_pendiente,
        cobro_id=cobro.id if cobro else None,
        cobro_numero=cobro.numero if cobro else None,
        fecha_realizacion=venta.fecha_realizacion,
        lineas=[
            PosVentaLineaVista(
                articulo_codigo=articulo.codigo,
                articulo_descripcion=articulo.descripcion,
                lista_nombre=lista.nombre,
                cantidad_base=detalle.cantidad_base,
                precio_unitario_bruto=detalle.precio_unitario_bruto,
                porcentaje_iva=detalle.porcentaje_iva,
                subtotal_neto=detalle.subtotal_neto,
                importe_iva=detalle.importe_iva,
                total_bruto=detalle.total_bruto,
            )
            for detalle, articulo, lista in filas
        ],
    )


async def validar_credito_cliente(
    cliente_id: UUID, nuevo_saldo: Decimal, sesion: AsyncSession
) -> None:
    cuenta = await sesion.scalar(
        select(CuentaCorrienteVenta).where(CuentaCorrienteVenta.socio_id == cliente_id)
    )
    if cuenta is None or not cuenta.activa:
        raise HTTPException(
            status_code=409,
            detail="El cliente no tiene habilitada la cuenta corriente",
        )
    deuda_actual = await sesion.scalar(
        select(func.coalesce(func.sum(VentaDocumento.saldo_pendiente), 0)).where(
            VentaDocumento.cliente_id == cliente_id,
            VentaDocumento.estado == "CONFIRMADO",
        )
    )
    if Decimal(deuda_actual) + nuevo_saldo > cuenta.limite_deuda:
        raise HTTPException(status_code=409, detail="El cliente supera su limite maximo de deuda")
    dias_periodo = {"diaria": 1, "semanal": 7, "mensual": 30}.get(cuenta.temporalidad, 30)
    inicio_periodo = datetime.now(UTC) - timedelta(days=dias_periodo)
    generado_periodo = await sesion.scalar(
        select(func.coalesce(func.sum(VentaDocumento.saldo_pendiente), 0)).where(
            VentaDocumento.cliente_id == cliente_id,
            VentaDocumento.estado == "CONFIRMADO",
            VentaDocumento.fecha_realizacion >= inicio_periodo,
        )
    )
    if Decimal(generado_periodo) + nuevo_saldo > cuenta.limite_periodo:
        raise HTTPException(
            status_code=409,
            detail=f"El cliente supera su limite {cuenta.temporalidad} de cuenta corriente",
        )
    if cuenta.dias_maximos_deuda:
        deuda_mas_antigua = await sesion.scalar(
            select(VentaDocumento.fecha_realizacion)
            .where(
                VentaDocumento.cliente_id == cliente_id,
                VentaDocumento.estado == "CONFIRMADO",
                VentaDocumento.saldo_pendiente > 0,
            )
            .order_by(VentaDocumento.fecha_realizacion)
            .limit(1)
        )
        if deuda_mas_antigua and datetime.now(UTC) - deuda_mas_antigua > timedelta(
            days=cuenta.dias_maximos_deuda
        ):
            raise HTTPException(status_code=409, detail="El cliente posee deuda vencida")


@router.post(
    "/pos/ventas",
    response_model=PosVentaVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("ventas.gestionar"))],
)
async def crear_venta_pos(
    datos: PosVentaCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    sesion: AsyncSession = Depends(obtener_sesion),
) -> PosVentaVista:
    cliente = await sesion.get(Tercero, datos.cliente_id)
    if cliente is None or not cliente.activo or not cliente.es_cliente:
        raise HTTPException(status_code=400, detail="Cliente inexistente o inactivo")
    almacen = await sesion.get(Almacen, datos.almacen_id)
    if almacen is None or not almacen.activo:
        raise HTTPException(status_code=400, detail="Almacen inexistente o inactivo")
    cantidades: dict[UUID, Decimal] = {}
    for linea in datos.lineas:
        cantidades[linea.articulo_id] = (
            cantidades.get(linea.articulo_id, Decimal("0")) + linea.cantidad_base
        )

    lineas_calculadas = []
    subtotal_neto = Decimal("0")
    total_iva = Decimal("0")
    total_bruto = Decimal("0")
    for articulo_id, cantidad in cantidades.items():
        articulo = await sesion.get(Articulo, articulo_id)
        if articulo is None or not articulo.habilitado or not articulo.habilitado_venta:
            raise HTTPException(status_code=400, detail="Articulo no habilitado para venta")
        lista = await resolver_lista_venta(articulo.id, cantidad, sesion)
        precio = await precio_articulo_lista_vista(articulo, lista, sesion)
        alicuota = await sesion.get(AlicuotaIva, articulo.alicuota_iva_id)
        if alicuota is None:
            raise HTTPException(status_code=409, detail="El articulo no posee una alicuota valida")
        bruto = importe_dos_decimales(cantidad * precio.precio_venta_bruto)
        neto = importe_dos_decimales(bruto / (Decimal("1") + alicuota.porcentaje / Decimal("100")))
        iva = bruto - neto
        subtotal_neto += neto
        total_iva += iva
        total_bruto += bruto
        lineas_calculadas.append((articulo, lista, cantidad, precio, alicuota, neto, iva, bruto))

    total_pagado = importe_dos_decimales(sum((p.importe for p in datos.pagos), Decimal("0")))
    if total_pagado > total_bruto:
        raise HTTPException(status_code=400, detail="Los pagos superan el total de la venta")
    saldo_pendiente = total_bruto - total_pagado
    if saldo_pendiente > 0:
        await validar_credito_cliente(cliente.id, saldo_pendiente, sesion)

    numero = await sesion.scalar(select(Sequence("secuencia_ventas").next_value()))
    venta = VentaDocumento(
        numero=numero,
        cliente_id=cliente.id,
        almacen_id=almacen.id,
        estado="CONFIRMADO",
        subtotal_neto=subtotal_neto,
        total_iva=total_iva,
        total_bruto=total_bruto,
        saldo_pendiente=saldo_pendiente,
        usuario_id=usuario.id,
    )
    sesion.add(venta)
    await sesion.flush()
    movimiento: MovimientoStock | None = None
    for articulo, lista, cantidad, precio, alicuota, neto, iva, bruto in lineas_calculadas:
        sesion.add(
            VentaDocumentoDetalle(
                venta_id=venta.id,
                articulo_id=articulo.id,
                lista_precio_id=lista.id,
                cantidad_base=cantidad,
                precio_unitario_bruto=precio.precio_venta_bruto,
                porcentaje_iva=alicuota.porcentaje,
                subtotal_neto=neto,
                importe_iva=iva,
                total_bruto=bruto,
            )
        )
        if articulo.habilitado_inventario:
            if movimiento is None:
                movimiento = await nuevo_movimiento(
                    sesion, usuario, "VENTA", f"VENTA #{venta.numero}", almacen.id
                )
                movimiento.documento_tipo = "VENTA"
                movimiento.documento_numero = str(venta.numero)
                venta.movimiento_stock_id = movimiento.id
            await aplicar_impacto_stock(sesion, movimiento, articulo, almacen.id, -cantidad)

    if total_pagado > 0:
        numero_cobro = await sesion.scalar(select(Sequence("secuencia_cobros").next_value()))
        cobro = CobroDocumento(
            numero=numero_cobro,
            cliente_id=cliente.id,
            estado="CONFIRMADO",
            total=total_pagado,
            usuario_id=usuario.id,
        )
        sesion.add(cobro)
        await sesion.flush()
        sesion.add_all(
            [
                CobroMedioPago(
                    cobro_id=cobro.id,
                    medio=pago.medio,
                    importe=pago.importe,
                    referencia=(
                        normalizar_mayusculas(pago.referencia) if pago.referencia else None
                    ),
                )
                for pago in datos.pagos
            ]
        )
        sesion.add(ImputacionCobroVenta(cobro_id=cobro.id, venta_id=venta.id, importe=total_pagado))
    await sesion.commit()
    await sesion.refresh(venta)
    return await venta_pos_vista(venta, sesion)


@router.get(
    "/pos/ventas",
    response_model=list[PosVentaVista],
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def listar_ventas_pos(
    cliente_id: UUID | None = None,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[PosVentaVista]:
    consulta = select(VentaDocumento).order_by(VentaDocumento.fecha_realizacion.desc()).limit(100)
    if cliente_id:
        consulta = consulta.where(VentaDocumento.cliente_id == cliente_id)
    ventas = list(await sesion.scalars(consulta))
    return [await venta_pos_vista(venta, sesion) for venta in ventas]


@router.get(
    "/pos/ventas/{venta_id}",
    response_model=PosVentaVista,
    dependencies=[Depends(requerir_permiso("ventas.ver"))],
)
async def obtener_venta_pos(
    venta_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> PosVentaVista:
    venta = await sesion.get(VentaDocumento, venta_id)
    if venta is None:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return await venta_pos_vista(venta, sesion)


@router.get(
    "",
    response_model=list[ArticuloResumen],
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def listar_articulos(
    buscar: str | None = Query(default=None, max_length=100),
    clasificador_ids: Annotated[list[UUID] | None, Query()] = None,
    incluir_inactivos: bool = False,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> list[ArticuloResumen]:
    consulta = select(Articulo).order_by(Articulo.codigo).limit(200)
    if not incluir_inactivos:
        consulta = consulta.where(Articulo.habilitado.is_(True))
    if clasificador_ids:
        consulta = consulta.where(
            select(ArticuloClasificador.articulo_id)
            .where(
                ArticuloClasificador.articulo_id == Articulo.id,
                ArticuloClasificador.clasificador_id.in_(clasificador_ids),
            )
            .exists()
        )
    if buscar:
        for termino in buscar.split():
            patron = f"%{termino}%"
            consulta = consulta.where(
                or_(
                    Articulo.codigo.ilike(patron),
                    Articulo.descripcion.ilike(patron),
                    Articulo.descripcion_ampliada.ilike(patron),
                    select(CodigoBarraArticulo.id)
                    .where(
                        CodigoBarraArticulo.articulo_id == Articulo.id,
                        CodigoBarraArticulo.codigo.ilike(patron),
                        CodigoBarraArticulo.activo.is_(True),
                    )
                    .exists(),
                    select(ArticuloProveedor.id)
                    .where(
                        ArticuloProveedor.articulo_id == Articulo.id,
                        ArticuloProveedor.codigo_proveedor.ilike(patron),
                        ArticuloProveedor.activo.is_(True),
                    )
                    .exists(),
                )
            )
    articulos = list(await sesion.scalars(consulta))
    return [await construir_resumen(articulo, sesion) for articulo in articulos]


@router.post(
    "",
    response_model=ArticuloResumen,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def crear_articulo(
    datos: ArticuloCrear, sesion: AsyncSession = Depends(obtener_sesion)
) -> ArticuloResumen:
    unidad = await sesion.get(UnidadMedida, datos.unidad_base_id)
    if unidad is None or not unidad.activa:
        raise HTTPException(status_code=400, detail="La unidad base no es valida")
    if datos.es_pesable and not unidad.admite_decimales:
        raise HTTPException(
            status_code=400,
            detail="Un articulo pesable requiere una unidad que admita decimales",
        )
    alicuota = await sesion.get(AlicuotaIva, datos.alicuota_iva_id)
    if alicuota is None or not alicuota.activa:
        raise HTTPException(status_code=400, detail="La alicuota de IVA no es valida")
    valores = datos.model_dump()
    codigo_alternativo = valores.pop("codigo_alternativo")
    clasificador_ids = set(valores.pop("clasificador_ids"))
    if clasificador_ids:
        encontrados = set(
            await sesion.scalars(
                select(ClasificadorArticulo.id).where(ClasificadorArticulo.id.in_(clasificador_ids))
            )
        )
        if encontrados != clasificador_ids:
            raise HTTPException(status_code=400, detail="Clasificador inexistente")
    if datos.tipo_articulo == "producto":
        numero = await sesion.scalar(select(Sequence("secuencia_codigo_articulos").next_value()))
        if numero is None or numero > 99999:
            raise HTTPException(status_code=409, detail="Se agoto la numeracion de articulos")
        codigo = f"{numero:05d}"
    else:
        codigo = str(codigo_alternativo).strip().upper()
        if await sesion.scalar(select(Articulo).where(Articulo.codigo == codigo)):
            raise HTTPException(status_code=409, detail="El codigo alternativo ya existe")
    articulo = Articulo(**valores, codigo=codigo)
    sesion.add(articulo)
    await sesion.flush()
    sesion.add(PrecioArticuloBase(articulo_id=articulo.id, precio_bruto=Decimal("0")))
    sesion.add(
        ArticuloUnidad(
            articulo_id=articulo.id,
            unidad_medida_id=unidad.id,
            nombre_presentacion=f"{unidad.nombre} base",
            factor_a_base=Decimal("1"),
            es_unidad_base=True,
            es_unidad_alternativa=False,
            activa=True,
        )
    )
    sesion.add_all(
        [ArticuloClasificador(articulo_id=articulo.id, clasificador_id=i) for i in clasificador_ids]
    )
    almacenes = list(await sesion.scalars(select(Almacen.id).where(Almacen.activo.is_(True))))
    sesion.add_all([StockArticuloAlmacen(articulo_id=articulo.id, almacen_id=i) for i in almacenes])
    await sesion.commit()
    await sesion.refresh(articulo)
    return await construir_resumen(articulo, sesion)


@router.get(
    "/{articulo_id}",
    response_model=ArticuloDetalle,
    dependencies=[Depends(requerir_permiso("datos_maestros.ver"))],
)
async def obtener_articulo(
    articulo_id: UUID, sesion: AsyncSession = Depends(obtener_sesion)
) -> ArticuloDetalle:
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    resumen = await construir_resumen(articulo, sesion)
    unidades = list(
        await sesion.scalars(
            select(ArticuloUnidad).where(ArticuloUnidad.articulo_id == articulo.id)
        )
    )
    unidad_por_id = {unidad.id: unidad for unidad in unidades}
    codigos = list(
        await sesion.scalars(
            select(CodigoBarraArticulo).where(CodigoBarraArticulo.articulo_id == articulo.id)
        )
    )
    relaciones = list(
        await sesion.scalars(
            select(ArticuloProveedor).where(ArticuloProveedor.articulo_id == articulo.id)
        )
    )
    codigos_vista = [
        CodigoBarraVista(
            id=codigo.id,
            codigo=codigo.codigo,
            modo_contenido=codigo.modo_contenido,
            cantidad=codigo.cantidad,
            articulo_unidad_id=codigo.articulo_unidad_id,
            principal=codigo.principal,
            activo=codigo.activo,
            cantidad_base_resuelta=(
                unidad_por_id[codigo.articulo_unidad_id].factor_a_base
                if codigo.articulo_unidad_id
                else codigo.cantidad
            ),
        )
        for codigo in codigos
    ]
    proveedores_vista = []
    for relacion in relaciones:
        proveedor = await sesion.get(Tercero, relacion.proveedor_id)
        if proveedor:
            proveedores_vista.append(
                ArticuloProveedorVista(
                    id=relacion.id,
                    proveedor_id=relacion.proveedor_id,
                    codigo_proveedor=relacion.codigo_proveedor,
                    principal=relacion.principal,
                    razon_social=proveedor.razon_social,
                    activo=relacion.activo,
                )
            )
    stocks_vista = []
    stocks = list(
        await sesion.scalars(
            select(StockArticuloAlmacen).where(StockArticuloAlmacen.articulo_id == articulo.id)
        )
    )
    for stock in stocks:
        almacen = await sesion.get(Almacen, stock.almacen_id)
        if almacen:
            stocks_vista.append(
                StockArticuloVista(
                    almacen_id=almacen.id,
                    almacen_codigo=almacen.codigo,
                    almacen_descripcion=almacen.descripcion,
                    cantidad_fisica=stock.cantidad_fisica,
                    cantidad_pedida=stock.cantidad_pedida,
                    cantidad_reservada=stock.cantidad_reservada,
                    cantidad_disponible=stock.cantidad_fisica - stock.cantidad_reservada,
                    cantidad_disponible_futura=(
                        stock.cantidad_fisica + stock.cantidad_pedida - stock.cantidad_reservada
                    ),
                )
            )
    return ArticuloDetalle(
        **resumen.model_dump(),
        descripcion_ampliada=articulo.descripcion_ampliada,
        unidades=[
            ArticuloUnidadVista(
                id=u.id,
                unidad_medida_id=u.unidad_medida_id,
                nombre_presentacion=u.nombre_presentacion,
                factor_a_base=u.factor_a_base,
                es_unidad_alternativa=u.es_unidad_alternativa,
                es_unidad_base=u.es_unidad_base,
                activa=u.activa,
            )
            for u in unidades
        ],
        codigos_barra=codigos_vista,
        proveedores=proveedores_vista,
        stocks=stocks_vista,
    )


@router.put(
    "/{articulo_id}/alicuota-iva",
    response_model=ArticuloResumen,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_alicuota_iva_articulo(
    articulo_id: UUID,
    datos: ArticuloIvaActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloResumen:
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    alicuota = await sesion.get(AlicuotaIva, datos.alicuota_iva_id)
    if alicuota is None or not alicuota.activa:
        raise HTTPException(status_code=400, detail="La alicuota de IVA no es valida")
    articulo.alicuota_iva_id = alicuota.id
    await sesion.commit()
    return await construir_resumen(articulo, sesion)


@router.put(
    "/{articulo_id}",
    response_model=ArticuloResumen,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_articulo(
    articulo_id: UUID,
    datos: ArticuloActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloResumen:
    articulo = await obtener_articulo_o_404(articulo_id, sesion)
    if datos.unidad_base_id != articulo.unidad_base_id:
        raise HTTPException(
            status_code=400,
            detail="La unidad base no puede cambiarse cuando el articulo ya fue creado",
        )
    valores = datos.model_dump()
    valores.pop("codigo_alternativo")
    clasificador_ids = set(valores.pop("clasificador_ids"))
    if not valores["habilitado"]:
        valores["habilitado_venta"] = False
        valores["habilitado_compra"] = False
        valores["habilitado_inventario"] = False
    if clasificador_ids:
        existentes = set(
            await sesion.scalars(
                select(ClasificadorArticulo.id).where(ClasificadorArticulo.id.in_(clasificador_ids))
            )
        )
        if existentes != clasificador_ids:
            raise HTTPException(status_code=400, detail="Clasificador inexistente")
    if valores["tipo_articulo"] != articulo.tipo_articulo:
        raise HTTPException(status_code=400, detail="El tipo de articulo no puede modificarse")
    for campo, valor in valores.items():
        setattr(articulo, campo, valor)
    await sesion.execute(
        delete(ArticuloClasificador).where(ArticuloClasificador.articulo_id == articulo.id)
    )
    sesion.add_all(
        [ArticuloClasificador(articulo_id=articulo.id, clasificador_id=i) for i in clasificador_ids]
    )
    await sesion.commit()
    return await construir_resumen(articulo, sesion)


@router.post(
    "/{articulo_id}/unidades",
    response_model=ArticuloUnidadVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def agregar_unidad(
    articulo_id: UUID,
    datos: ArticuloUnidadCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloUnidad:
    await obtener_articulo_o_404(articulo_id, sesion)
    if await sesion.get(UnidadMedida, datos.unidad_medida_id) is None:
        raise HTTPException(status_code=400, detail="Unidad de medida inexistente")
    presentacion = ArticuloUnidad(
        articulo_id=articulo_id, **datos.model_dump(), es_unidad_base=False, activa=True
    )
    if datos.es_unidad_alternativa:
        await sesion.execute(
            update(ArticuloUnidad)
            .where(ArticuloUnidad.articulo_id == articulo_id)
            .values(es_unidad_alternativa=False)
        )
    sesion.add(presentacion)
    await sesion.commit()
    await sesion.refresh(presentacion)
    return presentacion


@router.put(
    "/{articulo_id}/unidades/{unidad_articulo_id}",
    response_model=ArticuloUnidadVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_unidad(
    articulo_id: UUID,
    unidad_articulo_id: UUID,
    datos: ArticuloUnidadActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloUnidad:
    presentacion = await sesion.get(ArticuloUnidad, unidad_articulo_id)
    if presentacion is None or presentacion.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Presentacion no encontrada")
    if presentacion.es_unidad_base:
        raise HTTPException(status_code=400, detail="La unidad base no puede modificarse")
    if await sesion.get(UnidadMedida, datos.unidad_medida_id) is None:
        raise HTTPException(status_code=400, detail="Unidad de medida inexistente")
    if datos.es_unidad_alternativa:
        await sesion.execute(
            update(ArticuloUnidad)
            .where(
                ArticuloUnidad.articulo_id == articulo_id,
                ArticuloUnidad.id != presentacion.id,
            )
            .values(es_unidad_alternativa=False)
        )
    for campo, valor in datos.model_dump().items():
        setattr(presentacion, campo, valor)
    await sesion.commit()
    return presentacion


@router.delete(
    "/{articulo_id}/unidades/{unidad_articulo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_unidad(
    articulo_id: UUID,
    unidad_articulo_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Response:
    presentacion = await sesion.get(ArticuloUnidad, unidad_articulo_id)
    if presentacion is None or presentacion.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Presentacion no encontrada")
    if presentacion.es_unidad_base:
        raise HTTPException(status_code=400, detail="La unidad base no puede eliminarse")
    codigo_vinculado = await sesion.scalar(
        select(CodigoBarraArticulo).where(CodigoBarraArticulo.articulo_unidad_id == presentacion.id)
    )
    if codigo_vinculado:
        raise HTTPException(
            status_code=409,
            detail="La presentacion esta vinculada a un codigo de barras",
        )
    await sesion.delete(presentacion)
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{articulo_id}/unidades/{unidad_articulo_id}/alternativa",
    response_model=ArticuloUnidadVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def seleccionar_unidad_alternativa(
    articulo_id: UUID,
    unidad_articulo_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloUnidad:
    presentacion = await sesion.get(ArticuloUnidad, unidad_articulo_id)
    if presentacion is None or presentacion.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Presentacion no encontrada")
    if presentacion.es_unidad_base:
        raise HTTPException(
            status_code=400,
            detail="La unidad base es la unidad normal y no puede ser alternativa",
        )
    if not presentacion.activa:
        raise HTTPException(status_code=400, detail="La presentacion debe estar activa")
    await sesion.execute(
        update(ArticuloUnidad)
        .where(ArticuloUnidad.articulo_id == articulo_id)
        .values(es_unidad_alternativa=False)
    )
    presentacion.es_unidad_alternativa = True
    await sesion.commit()
    return presentacion


@router.post(
    "/{articulo_id}/codigos-barra",
    response_model=CodigoBarraVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def agregar_codigo_barra(
    articulo_id: UUID,
    datos: CodigoBarraCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> CodigoBarraVista:
    await obtener_articulo_o_404(articulo_id, sesion)
    if await sesion.scalar(
        select(CodigoBarraArticulo).where(
            CodigoBarraArticulo.codigo == normalizar_mayusculas(datos.codigo)
        )
    ):
        raise HTTPException(status_code=409, detail="El codigo de barras ya esta registrado")
    cantidad_resuelta = datos.cantidad
    if datos.articulo_unidad_id:
        presentacion = await sesion.get(ArticuloUnidad, datos.articulo_unidad_id)
        if presentacion is None or presentacion.articulo_id != articulo_id:
            raise HTTPException(status_code=400, detail="La presentacion no pertenece al articulo")
        cantidad_resuelta = presentacion.factor_a_base
    valores_codigo = datos.model_dump()
    valores_codigo["codigo"] = normalizar_mayusculas(datos.codigo)
    codigo = CodigoBarraArticulo(articulo_id=articulo_id, **valores_codigo, activo=True)
    sesion.add(codigo)
    await sesion.commit()
    await sesion.refresh(codigo)
    return CodigoBarraVista(
        **datos.model_dump(),
        id=codigo.id,
        activo=True,
        cantidad_base_resuelta=cantidad_resuelta,
    )


@router.put(
    "/{articulo_id}/codigos-barra/{codigo_barra_id}",
    response_model=CodigoBarraVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_codigo_barra(
    articulo_id: UUID,
    codigo_barra_id: UUID,
    datos: CodigoBarraActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> CodigoBarraVista:
    codigo = await sesion.get(CodigoBarraArticulo, codigo_barra_id)
    if codigo is None or codigo.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Codigo de barras no encontrado")
    codigo_normalizado = normalizar_mayusculas(datos.codigo)
    repetido = await sesion.scalar(
        select(CodigoBarraArticulo).where(
            CodigoBarraArticulo.codigo == codigo_normalizado,
            CodigoBarraArticulo.id != codigo.id,
        )
    )
    if repetido:
        raise HTTPException(status_code=409, detail="El codigo de barras ya esta registrado")
    cantidad_resuelta = datos.cantidad
    if datos.articulo_unidad_id:
        presentacion = await sesion.get(ArticuloUnidad, datos.articulo_unidad_id)
        if presentacion is None or presentacion.articulo_id != articulo_id:
            raise HTTPException(status_code=400, detail="La presentacion no pertenece al articulo")
        cantidad_resuelta = presentacion.factor_a_base
    for campo, valor in datos.model_dump().items():
        setattr(codigo, campo, valor)
    codigo.codigo = codigo_normalizado
    await sesion.commit()
    respuesta_codigo = datos.model_dump()
    respuesta_codigo["codigo"] = codigo_normalizado
    return CodigoBarraVista(
        **respuesta_codigo,
        id=codigo.id,
        cantidad_base_resuelta=cantidad_resuelta,
    )


@router.delete(
    "/{articulo_id}/codigos-barra/{codigo_barra_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_codigo_barra(
    articulo_id: UUID,
    codigo_barra_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Response:
    codigo = await sesion.get(CodigoBarraArticulo, codigo_barra_id)
    if codigo is None or codigo.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Codigo de barras no encontrado")
    await sesion.delete(codigo)
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{articulo_id}/proveedores",
    response_model=ArticuloProveedorVista,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def vincular_proveedor(
    articulo_id: UUID,
    datos: ArticuloProveedorCrear,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloProveedorVista:
    await obtener_articulo_o_404(articulo_id, sesion)
    proveedor = await sesion.get(Tercero, datos.proveedor_id)
    if proveedor is None or not proveedor.es_proveedor:
        raise HTTPException(status_code=400, detail="Proveedor inexistente")
    relacion = ArticuloProveedor(articulo_id=articulo_id, **datos.model_dump(), activo=True)
    sesion.add(relacion)
    await sesion.commit()
    await sesion.refresh(relacion)
    return ArticuloProveedorVista(
        **datos.model_dump(),
        id=relacion.id,
        razon_social=proveedor.razon_social,
        activo=True,
    )


@router.put(
    "/{articulo_id}/proveedores/{relacion_id}",
    response_model=ArticuloProveedorVista,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def actualizar_proveedor_articulo(
    articulo_id: UUID,
    relacion_id: UUID,
    datos: ArticuloProveedorActualizar,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> ArticuloProveedorVista:
    relacion = await sesion.get(ArticuloProveedor, relacion_id)
    if relacion is None or relacion.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Relacion con proveedor no encontrada")
    proveedor = await sesion.get(Tercero, datos.proveedor_id)
    if proveedor is None or not proveedor.es_proveedor:
        raise HTTPException(status_code=400, detail="Proveedor inexistente")
    for campo, valor in datos.model_dump().items():
        setattr(relacion, campo, valor)
    await sesion.commit()
    return ArticuloProveedorVista(
        **datos.model_dump(),
        id=relacion.id,
        razon_social=proveedor.razon_social,
    )


@router.delete(
    "/{articulo_id}/proveedores/{relacion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(requerir_permiso("datos_maestros.gestionar"))],
)
async def eliminar_proveedor_articulo(
    articulo_id: UUID,
    relacion_id: UUID,
    sesion: AsyncSession = Depends(obtener_sesion),
) -> Response:
    relacion = await sesion.get(ArticuloProveedor, relacion_id)
    if relacion is None or relacion.articulo_id != articulo_id:
        raise HTTPException(status_code=404, detail="Relacion con proveedor no encontrada")
    await sesion.delete(relacion)
    await sesion.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
