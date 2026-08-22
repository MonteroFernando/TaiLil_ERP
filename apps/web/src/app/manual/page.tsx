"use client";

import { apiFetch } from "@/api";
import CapturaManual from "@/components/CapturaManual";
import { puedeVerSeccion, SECCIONES_MANUAL, type SeccionManual } from "@/manual/contenido";
import { useEffect, useMemo, useRef, useState } from "react";

const apiUrl=process.env.NEXT_PUBLIC_API_URL??"/api/v1";

function normalizar(valor:string){return valor.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es")}

export default function ManualPage(){
 const[permisos,setPermisos]=useState<string[]>([]),[administrador,setAdministrador]=useState(false),[usuario,setUsuario]=useState(""),[cargando,setCargando]=useState(true),[busqueda,setBusqueda]=useState(""),[activa,setActiva]=useState("primeros-pasos"),[generando,setGenerando]=useState(false),[mensaje,setMensaje]=useState("");
 const contenidoRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{async function cargar(){try{const[u,p]=await Promise.all([apiFetch(`${apiUrl}/autenticacion/yo`),apiFetch(`${apiUrl}/autenticacion/mis-permisos`)]);if(u.ok&&p.ok){const usuarioActual:{nombre_usuario:string;es_administrador:boolean}=await u.json();const permisosActuales:{permisos:string[]}=await p.json();setUsuario(usuarioActual.nombre_usuario);setAdministrador(usuarioActual.es_administrador);setPermisos(permisosActuales.permisos)}}finally{setCargando(false)}}void cargar()},[]);
 const visibles=useMemo(()=>SECCIONES_MANUAL.filter(s=>puedeVerSeccion(s.requisito,permisos,administrador)),[permisos,administrador]);
 const resultados=useMemo(()=>{const termino=normalizar(busqueda.trim());if(!termino)return visibles;return visibles.filter(s=>normalizar([s.modulo,s.titulo,s.resumen,s.paraQueSirve,...s.pasos,...s.consejos,...s.palabrasClave].join(" ")).includes(termino))},[busqueda,visibles]);
 const activaVisible=resultados.some(s=>s.id===activa)?activa:resultados[0]?.id;
 async function descargarPdf(){
  if(!contenidoRef.current||generando)return;setGenerando(true);setMensaje("Preparando las páginas del manual...");
  try{
   const[{default:html2canvas},{jsPDF}]=await Promise.all([import("html2canvas"),import("jspdf")]);
   const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
   pdf.setProperties({title:`Manual Morita - ${usuario}`,subject:"Manual de usuario personalizado",author:"TaiLil Soluciones Tecnológicas by Fernando Montero",creator:"Morita ERP"});
   pdf.setFillColor(246,243,236);pdf.rect(0,0,210,297,"F");
   const logo=document.createElement("img");logo.src="/brand/morita-logo.jpeg";await logo.decode();pdf.addImage(logo,"JPEG",25,35,160,41.5);
   pdf.setTextColor(6,75,51);pdf.setFont("helvetica","bold");pdf.setFontSize(24);pdf.text("Manual de usuario",105,105,{align:"center"});
   pdf.setFontSize(13);pdf.setFont("helvetica","normal");pdf.text(`Preparado para: ${usuario||"USUARIO"}`,105,120,{align:"center"});
   pdf.setFontSize(10);pdf.setTextColor(95,112,104);pdf.text(`${visibles.length} capítulos según los permisos actuales`,105,130,{align:"center"});pdf.text(`Generado el ${new Intl.DateTimeFormat("es-AR",{dateStyle:"long",timeStyle:"short"}).format(new Date())}`,105,138,{align:"center"});
   pdf.setDrawColor(216,223,217);pdf.line(25,248,185,248);pdf.setFontSize(9);pdf.text("Powered by TaiLil ERP",105,258,{align:"center"});pdf.text("TaiLil Soluciones Tecnológicas by Fernando Montero",105,265,{align:"center"});
   const nodos=Array.from(contenidoRef.current.querySelectorAll<HTMLElement>("[data-manual-seccion]"));
   for(let indice=0;indice<nodos.length;indice++){
    setMensaje(`Generando capítulo ${indice+1} de ${nodos.length}...`);const nodo=nodos[indice];
    const canvas=await html2canvas(nodo,{scale:1.35,useCORS:true,backgroundColor:"#f6f3ec",logging:false,onclone:(documento)=>{documento.documentElement.dataset.tema="claro";documento.querySelectorAll<HTMLElement>(".no-imprimir").forEach(elemento=>elemento.style.display="none")}});
    const ancho=184,altoMax=269,alto=Math.min(altoMax,canvas.height*ancho/canvas.width);pdf.addPage();pdf.addImage(canvas.toDataURL("image/jpeg",0.9),"JPEG",13,12,ancho,alto,undefined,"FAST");
   }
   const paginas=pdf.getNumberOfPages();for(let pagina=2;pagina<=paginas;pagina++){pdf.setPage(pagina);pdf.setFontSize(8);pdf.setTextColor(95,112,104);pdf.text(`Morita · Manual personalizado · ${usuario}`,13,291);pdf.text(`${pagina} / ${paginas}`,197,291,{align:"right"})}
   pdf.save(`Manual_Morita_${(usuario||"usuario").replace(/[^a-z0-9]+/gi,"_")}.pdf`);setMensaje("PDF descargado correctamente.");
  }catch(error){console.error(error);setMensaje("No se pudo generar el PDF. Intente nuevamente.")}finally{setGenerando(false)}
 }
 if(cargando)return <main className="grid min-h-screen place-items-center text-sm text-[var(--texto-suave)]">Preparando tu manual...</main>;
 return <main className="manual-pagina min-h-screen p-5 sm:p-8">
  <header className="manual-portada no-imprimir"><div className="manual-portada-texto"><p>AYUDA PERSONALIZADA</p><h1>Manual de usuario</h1><span>Solo contiene las funciones habilitadas para <b>{usuario}</b>. Si cambian tus permisos, el manual también cambia.</span></div><div className="manual-portada-acciones"><button onClick={()=>void descargarPdf()} disabled={generando} title="Descargar este manual en PDF"><span>PDF</span>{generando?"Generando...":"Descargar manual"}</button></div></header>
  <section className="manual-herramientas no-imprimir"><label><span>Buscar en el manual</span><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Ejemplo: cerrar caja, cobrar, inventario..."/></label><div><b>{resultados.length}</b><span>{resultados.length===1?"capítulo encontrado":"capítulos encontrados"}</span></div></section>
  {mensaje&&<p className={`manual-mensaje no-imprimir ${mensaje.includes("No se pudo")?"manual-mensaje-error":""}`}>{mensaje}</p>}
  <div className="manual-distribucion">
   <aside className="manual-indice no-imprimir"><p>CONTENIDO</p>{resultados.map(s=><button key={s.id} className={activaVisible===s.id?"activo":""} onClick={()=>{setActiva(s.id);document.getElementById(s.id)?.scrollIntoView({behavior:"smooth",block:"start"})}}><span>{s.icono}</span><div><b>{s.titulo}</b><small>{s.modulo}</small></div></button>)}</aside>
   <div className="manual-contenido">{resultados.length===0?<div className="manual-sin-resultados"><b>No encontramos esa explicación</b><span>Pruebe con palabras como venta, caja, cliente, stock o informe.</span></div>:resultados.map(s=><Capitulo key={s.id} seccion={s}/>)}</div>
  </div>
  <div className="manual-pdf-fuente" ref={contenidoRef} aria-hidden="true">{visibles.map(s=><Capitulo key={`pdf-${s.id}`} seccion={s} oculto/>)}</div>
 </main>
}

function Capitulo({seccion,oculto=false}:{seccion:SeccionManual;oculto?:boolean}){
 return <article id={oculto?undefined:seccion.id} data-manual-seccion className="manual-capitulo">
  <header><div className="manual-numero">{seccion.icono}</div><div><small>{seccion.modulo}</small><h2>{seccion.titulo}</h2><p>{seccion.resumen}</p></div>{seccion.ruta&&<a className="manual-ir no-imprimir" href={seccion.ruta}>Abrir módulo →</a>}</header>
  <div className="manual-explicacion"><b>¿Para qué sirve?</b><p>{seccion.paraQueSirve}</p></div>
  <CapturaManual seccion={seccion}/>
  <div className="manual-instrucciones"><section><h3>Paso a paso</h3><ol>{seccion.pasos.map((paso,i)=><li key={paso}><span>{i+1}</span><p>{paso}</p></li>)}</ol></section><aside><h3>Antes de continuar</h3>{seccion.consejos.map(c=><p key={c}>✓ {c}</p>)}</aside></div>
 </article>
}
