"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
const apiUrl=process.env.NEXT_PUBLIC_API_URL??"http://localhost:8000/api/v1";
const opciones=[
 {grupo:"Inicio",nombre:"Panel principal",detalle:"Resumen del sistema",href:"/panel",icono:"⌂"},
 {grupo:"Datos maestros",nombre:"Socios de negocio",detalle:"Clientes y proveedores",href:"/socios-negocio",icono:"SN"},
 {grupo:"Stock",nombre:"Control de stock",detalle:"Existencias y movimientos",href:"/stock",icono:"ST"},
 {grupo:"Stock",nombre:"Articulos",detalle:"Productos y servicios",href:"/articulos",icono:"A"},
 {grupo:"Stock",nombre:"Clasificadores",detalle:"Categorias, marcas y rubros",href:"/clasificadores",icono:"CL"},
 {grupo:"Stock",nombre:"Almacenes",detalle:"Depositos y existencias",href:"/almacenes",icono:"AL"},
 {grupo:"Ventas",nombre:"Punto de venta",detalle:"Ventas, cobros y cuenta corriente",href:"/ventas/pos",icono:"PV"},
 {grupo:"Ventas",nombre:"Listas de precios",detalle:"Precios, margenes y escalas",href:"/ventas/listas-precios",icono:"$"},
] as const;
export default function NavegacionPrincipal({children}:{children:React.ReactNode}){
 const ruta=usePathname();const router=useRouter();const [abierto,setAbierto]=useState(true);const [administrador,setAdministrador]=useState(false);
 useEffect(()=>{async function verificar(){const r=await fetch(`${apiUrl}/autenticacion/yo`,{credentials:"include"});if(r.ok){const u=await r.json();setAdministrador(u.es_administrador)}}void verificar()},[]);
 if(ruta==="/acceso"||ruta==="/")return children;
 async function salir(){await fetch(`${apiUrl}/autenticacion/cerrar-sesion`,{method:"POST",credentials:"include"});router.push("/acceso")}
 const menu=administrador?[...opciones,{grupo:"Administracion",nombre:"Accesos",detalle:"Usuarios y permisos",href:"/configuracion/accesos",icono:"⚙"} as const]:opciones;
 return <div className="erp-aplicacion"><aside className={`erp-navegacion ${abierto?"erp-navegacion-abierta":"erp-navegacion-cerrada"}`}><header className="erp-marca"><div className="erp-logo">TL</div>{abierto&&<div><strong>TaiLil ERP</strong><small>Gestion integral</small></div>}<button aria-label="Alternar menu" onClick={()=>setAbierto(!abierto)}>{abierto?"‹":"›"}</button></header><nav>{menu.map((item,indice)=>{const anterior=indice?menu[indice-1].grupo:null;return <div key={item.href}>{abierto&&item.grupo!==anterior&&<p className="erp-grupo">{item.grupo}</p>}<a className={`erp-opcion ${ruta===item.href||ruta.startsWith(`${item.href}/`)?"erp-opcion-activa":""}`} href={item.href} title={!abierto?item.nombre:undefined}><span className="erp-icono">{item.icono}</span>{abierto&&<span><b>{item.nombre}</b><small>{item.detalle}</small></span>}</a></div>})}</nav><button className="erp-salir" onClick={salir}><span className="erp-icono">×</span>{abierto&&<span>Cerrar sesion</span>}</button></aside><div className="erp-contenido">{children}</div></div>
}
