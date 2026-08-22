"use client";

import { apiFetch } from "@/api";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ExportarTablasPagina from "@/components/ExportarExcel";
const apiUrl=process.env.NEXT_PUBLIC_API_URL??"/api/v1";
const opciones=[
 {grupo:"Inicio",nombre:"Panel principal",detalle:"Resumen del sistema",href:"/panel",icono:"⌂",permiso:null},
 {grupo:"Datos maestros",nombre:"Socios de negocio",detalle:"Clientes y proveedores",href:"/socios-negocio",icono:"SN",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Control de stock",detalle:"Existencias y movimientos",href:"/stock",icono:"ST",permiso:"stock.ver"},
 {grupo:"Stock",nombre:"Articulos",detalle:"Productos y servicios",href:"/articulos",icono:"A",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Clasificadores",detalle:"Categorias, marcas y rubros",href:"/clasificadores",icono:"CL",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Almacenes",detalle:"Depositos y existencias",href:"/almacenes",icono:"AL",permiso:"stock.ver"},
 {grupo:"Compras",nombre:"Compras",detalle:"Ingresos y facturas de proveedores",href:"/compras",icono:"CO",permiso:"compras.ver"},
 {grupo:"Tesoreria",nombre:"Tesoreria",detalle:"Cuentas, conciliaciones y cierres",href:"/tesoreria",icono:"TS",permiso:"tesoreria.ver"},
 {grupo:"Tesoreria",nombre:"Informes",detalle:"Flujo de dinero, ventas y margenes",href:"/informes",icono:"IN",permiso:"informes.ver"},
 {grupo:"Ventas",nombre:"Punto de venta",detalle:"Ventas, cobros y cuenta corriente",href:"/ventas/pos",icono:"PV",permiso:"ventas.ver"},
 {grupo:"Ventas",nombre:"Listas de precios",detalle:"Precios, margenes y escalas",href:"/ventas/listas-precios",icono:"$",permiso:"ventas.ver"},
 {grupo:"Ventas",nombre:"Etiquetas de precios",detalle:"Diseño e impresion por tamaño",href:"/ventas/etiquetas",icono:"ET",permiso:"ventas.ver"},
] as const;
export default function NavegacionPrincipal({children}:{children:React.ReactNode}){
 const ruta=usePathname();const router=useRouter();const [abierto,setAbierto]=useState(true);const [administrador,setAdministrador]=useState(false);const[permisos,setPermisos]=useState<string[]>([]);
 useEffect(()=>{async function verificar(){const[respuestaUsuario,respuestaPermisos]=await Promise.all([apiFetch(`${apiUrl}/autenticacion/yo`,{credentials:"include"}),apiFetch(`${apiUrl}/autenticacion/mis-permisos`,{credentials:"include"})]);if(respuestaUsuario.ok){const u=await respuestaUsuario.json();setAdministrador(u.es_administrador)}if(respuestaPermisos.ok){const p:{permisos:string[]}=await respuestaPermisos.json();setPermisos(p.permisos)}}void verificar()},[]);
 if(ruta==="/acceso"||ruta==="/")return children;
 async function salir(){await apiFetch(`${apiUrl}/autenticacion/cerrar-sesion`,{method:"POST",credentials:"include"});router.push("/acceso")}
 const opcionesVisibles=opciones.filter(item=>administrador||item.permiso===null||permisos.includes(item.permiso));
 const menu=administrador?[...opcionesVisibles,{grupo:"Ventas",nombre:"Configuracion POS",detalle:"Puntos de venta y cajas",href:"/ventas/configuracion-pos",icono:"PC"} as const,{grupo:"Administracion",nombre:"Accesos",detalle:"Usuarios y permisos",href:"/configuracion/accesos",icono:"⚙"} as const]:opcionesVisibles;
 return <div className="erp-aplicacion"><aside className={`erp-navegacion ${abierto?"erp-navegacion-abierta":"erp-navegacion-cerrada"}`}><header className="erp-marca"><div className="erp-logo">TL</div>{abierto&&<div><strong>TaiLil ERP</strong><small>Gestion integral</small></div>}<button aria-label="Alternar menu" onClick={()=>setAbierto(!abierto)}>{abierto?"‹":"›"}</button></header><nav>{menu.map((item,indice)=>{const anterior=indice?menu[indice-1].grupo:null;return <div key={item.href}>{abierto&&item.grupo!==anterior&&<p className="erp-grupo">{item.grupo}</p>}<a className={`erp-opcion ${ruta===item.href||ruta.startsWith(`${item.href}/`)?"erp-opcion-activa":""}`} href={item.href} title={!abierto?item.nombre:undefined}><span className="erp-icono">{item.icono}</span>{abierto&&<span><b>{item.nombre}</b><small>{item.detalle}</small></span>}</a></div>})}</nav><button className="erp-salir" onClick={salir}><span className="erp-icono">×</span>{abierto&&<span>Cerrar sesion</span>}</button></aside><div className="erp-contenido"><ExportarTablasPagina/>{children}</div></div>
}
