"use client";
import { useParams } from "next/navigation";
import MaestroTerceros from "@/components/MaestroTerceros";
export default function DetalleCliente(){const {id}=useParams<{id:string}>();return <MaestroTerceros rol="clientes" titulo="Clientes" modo="ficha" registroId={id}/>}
