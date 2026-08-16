"use client";
import { useParams } from "next/navigation";
import MaestroTerceros from "@/components/MaestroTerceros";
export default function DetalleProveedor(){const {id}=useParams<{id:string}>();return <MaestroTerceros rol="proveedores" titulo="Proveedores" modo="ficha" registroId={id}/>}
