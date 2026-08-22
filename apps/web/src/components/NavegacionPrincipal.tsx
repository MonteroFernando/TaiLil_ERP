"use client";

import { apiFetch } from "@/api";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ExportarTablasPagina from "@/components/ExportarExcel";
import SelectorTema from "@/components/SelectorTema";
const apiUrl=process.env.NEXT_PUBLIC_API_URL??"/api/v1";
const opciones=[
 {grupo:"Inicio",nombre:"Panel principal",detalle:"Resumen del sistema",href:"/panel",icono:"⌂",permiso:null},
 {grupo:"Datos maestros",nombre:"Socios de negocio",detalle:"Clientes y proveedores",href:"/socios-negocio",icono:"SN",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Control de stock",detalle:"Existencias y movimientos",href:"/stock",icono:"ST",permiso:"inventario.ver"},
 {grupo:"Stock",nombre:"Articulos",detalle:"Productos y servicios",href:"/articulos",icono:"A",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Clasificadores",detalle:"Categorias, marcas y rubros",href:"/clasificadores",icono:"CL",permiso:"datos_maestros.ver"},
 {grupo:"Stock",nombre:"Almacenes",detalle:"Depositos y existencias",href:"/almacenes",icono:"AL",permiso:"inventario.ver"},
 {grupo:"Compras",nombre:"Compras",detalle:"Ingresos y facturas de proveedores",href:"/compras",icono:"CO",permiso:"compras.ver"},
 {grupo:"Tesoreria",nombre:"Tesoreria",detalle:"Cuentas, conciliaciones y cierres",href:"/tesoreria",icono:"TS",permiso:"tesoreria.ver"},
 {grupo:"Tesoreria",nombre:"Informes",detalle:"Flujo de dinero, ventas y margenes",href:"/informes",icono:"IN",permiso:"informes.ver"},
 {grupo:"Ventas",nombre:"Punto de venta",detalle:"Ventas, cobros y cierre de caja",href:"/ventas/pos",icono:"PV",permiso:["ventas.ver","ventas.caja.operar"]},
 {grupo:"Ventas",nombre:"Listas de precios",detalle:"Precios, margenes y escalas",href:"/ventas/listas-precios",icono:"$",permiso:"ventas.ver"},
 {grupo:"Ventas",nombre:"Etiquetas de precios",detalle:"Diseño e impresion por tamaño",href:"/ventas/etiquetas",icono:"ET",permiso:"ventas.ver"},
] as const;
type RequisitoPermiso = string | readonly string[] | null;
const reglasRutas: { prefijo: string; permiso: RequisitoPermiso; soloAdministrador?: boolean }[] = [
 {prefijo:"/ventas/configuracion-pos",permiso:null,soloAdministrador:true},
 {prefijo:"/configuracion",permiso:null,soloAdministrador:true},
 {prefijo:"/socios-negocio",permiso:"datos_maestros.ver"},
 {prefijo:"/socios",permiso:"datos_maestros.ver"},
 {prefijo:"/clientes",permiso:"datos_maestros.ver"},
 {prefijo:"/proveedores",permiso:"datos_maestros.ver"},
 {prefijo:"/articulos",permiso:"datos_maestros.ver"},
 {prefijo:"/clasificadores",permiso:"datos_maestros.ver"},
 {prefijo:"/almacenes",permiso:"inventario.ver"},
 {prefijo:"/stock",permiso:"inventario.ver"},
 {prefijo:"/compras",permiso:"compras.ver"},
 {prefijo:"/tesoreria",permiso:"tesoreria.ver"},
 {prefijo:"/informes",permiso:"informes.ver"},
 {prefijo:"/notas-credito",permiso:["ventas.ver","compras.ver"]},
 {prefijo:"/ventas/pos",permiso:["ventas.ver","ventas.caja.operar"]},
 {prefijo:"/ventas/listas-precios",permiso:"ventas.ver"},
 {prefijo:"/ventas/etiquetas",permiso:"ventas.ver"},
];

function cumpleRequisito(requisito: RequisitoPermiso, permisos: string[]) {
 if(requisito===null)return true;
 return typeof requisito==="string"
  ? permisos.includes(requisito)
  : requisito.some(codigo=>permisos.includes(codigo));
}

export default function NavegacionPrincipal({children}:{children:React.ReactNode}){
 const ruta=usePathname();const router=useRouter();const [abierto,setAbierto]=useState(true);const [administrador,setAdministrador]=useState(false);const[permisos,setPermisos]=useState<string[]>([]);const[accesosCargados,setAccesosCargados]=useState(false);
 useEffect(()=>{async function verificar(){try{const[respuestaUsuario,respuestaPermisos]=await Promise.all([apiFetch(`${apiUrl}/autenticacion/yo`,{credentials:"include"}),apiFetch(`${apiUrl}/autenticacion/mis-permisos`,{credentials:"include"})]);if(respuestaUsuario.status===401||respuestaPermisos.status===401){router.replace("/acceso");return}if(respuestaUsuario.ok&&respuestaPermisos.ok){const u=await respuestaUsuario.json();const p:{permisos:string[]}=await respuestaPermisos.json();setAdministrador(u.es_administrador);setPermisos(p.permisos);setAccesosCargados(true);return}setAccesosCargados(true);router.replace("/panel")}catch{router.replace("/acceso")}}void verificar()},[router]);
 const reglaRuta=reglasRutas.find(regla=>ruta===regla.prefijo||ruta.startsWith(`${regla.prefijo}/`));
 const rutaAutorizada=!reglaRuta||administrador||(!reglaRuta.soloAdministrador&&cumpleRequisito(reglaRuta.permiso,permisos));
 useEffect(()=>{if(accesosCargados&&!rutaAutorizada)router.replace("/panel")},[accesosCargados,rutaAutorizada,router]);
 if(ruta==="/acceso"||ruta==="/")return children;
 if(!accesosCargados||!rutaAutorizada)return <main className="grid min-h-screen place-items-center text-sm text-[var(--texto-suave)]">Verificando accesos...</main>;
 async function salir(){await apiFetch(`${apiUrl}/autenticacion/cerrar-sesion`,{method:"POST",credentials:"include"});router.push("/acceso")}
 const opcionesVisibles=opciones.filter(item=>administrador||cumpleRequisito(item.permiso,permisos));
 const menu=administrador?[...opcionesVisibles,{grupo:"Ventas",nombre:"Configuracion POS",detalle:"Puntos de venta y cajas",href:"/ventas/configuracion-pos",icono:"PC"} as const,{grupo:"Administracion",nombre:"Accesos",detalle:"Usuarios y permisos",href:"/configuracion/accesos",icono:"⚙"} as const]:opcionesVisibles;
 return <div className="erp-aplicacion">
  <aside className={`erp-navegacion ${abierto?"erp-navegacion-abierta":"erp-navegacion-cerrada"}`}>
   <div className="erp-selector-tema">
    <SelectorTema mostrarTexto={abierto} />
   </div>
   <header className="erp-marca">
    {abierto ? (
     <div className="erp-identidad">
      <Image src="/brand/morita-logo.jpeg" alt="Morita Drugstore" width={882} height={229} priority />
      <div className="erp-autoria"><span>Power by TaiLil ERP</span><small>TaiLil Soluciones Tecnológicas by Fernando Montero</small></div>
     </div>
    ) : (
     <div className="erp-logo-recortado"><Image src="/brand/morita-logo.jpeg" alt="Morita" width={882} height={229} priority /></div>
    )}
    <button aria-label="Alternar menú" onClick={()=>setAbierto(!abierto)}>{abierto?"‹":"›"}</button>
   </header>
   <nav>{menu.map((item,indice)=>{const anterior=indice?menu[indice-1].grupo:null;return <div key={item.href}>{abierto&&item.grupo!==anterior&&<p className="erp-grupo">{item.grupo}</p>}<a className={`erp-opcion ${ruta===item.href||ruta.startsWith(`${item.href}/`)?"erp-opcion-activa":""}`} href={item.href} title={!abierto?item.nombre:undefined}><span className="erp-icono">{item.icono}</span>{abierto&&<span><b>{item.nombre}</b><small>{item.detalle}</small></span>}</a></div>})}</nav>
   <button className="erp-salir" onClick={salir}><span className="erp-icono">×</span>{abierto&&<span>Cerrar sesión</span>}</button>
  </aside>
  <div className="erp-contenido"><ExportarTablasPagina/>{children}</div>
 </div>
}
