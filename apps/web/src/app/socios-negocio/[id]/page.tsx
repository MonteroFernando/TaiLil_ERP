"use client";
import { useParams } from "next/navigation";
import MaestroSociosNegocio from "@/components/MaestroSociosNegocio";
export default function DetalleSocio(){const {id}=useParams<{id:string}>();return <MaestroSociosNegocio modo="ficha" registroId={id}/>}
