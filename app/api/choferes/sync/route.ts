import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializar cliente Supabase usando la Service Role Key para bypassing RLS si es necesario, 
// o la Anon Key si se envían los tokens correctos. Para sincronización offline, es más seguro usar Service Role
// o verificar el JWT del chofer.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    // 1. Obtener Checklists configurados y activos
    const { data: checklists, error: errChecklists } = await supabase
      .from("app_checklists_config")
      .select("*")
      .eq("activa", true)
      .order("orden", { ascending: true });

    // 2. Obtener lista de empleados (para validar QRs offline)
    // Asumimos que la tabla se llama 'empleados'
    const { data: empleados, error: errEmpleados } = await supabase
      .from("empleados")
      .select("id_empleado, nombre, apellido_paterno, apellido_materno, estatus, puesto")
      .eq("estatus", "Activo");

    // 3. Obtener viajes programados para hoy (opcional, si queremos precargarle rutas)
    const hoy = new Date().toISOString().split("T")[0];
    const { data: viajesProgramados, error: errViajes } = await supabase
      .from("logistica_viajes_programados")
      .select("*")
      .eq("fecha_esperada", hoy);

    if (errChecklists || errEmpleados) {
      console.error("Error obteniendo catálogos:", errChecklists, errEmpleados);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }

    return NextResponse.json({
      checklists: checklists || [],
      empleados: empleados || [],
      viajes_programados: viajesProgramados || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync GET error:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { viajes, pasajeros, respuestas_checklist } = body;

    // TODO: Iniciar transacción (Supabase RPC) o insertar en orden: Viajes -> Pasajeros -> Checklists
    let insertedViajes = [];
    
    // 1. Insertar Viajes
    if (viajes && viajes.length > 0) {
      // Filtrar los datos para evitar sobreescribir si el id_viaje_local ya existe
      const { data: currentViajes } = await supabase.from("app_viajes_activos").select("id_viaje_local, id_viaje");
      const existingViajeIds = new Set(currentViajes?.map((v) => v.id_viaje_local) || []);

      const newViajes = viajes.filter((v: any) => !existingViajeIds.has(v.id_viaje_local));
      
      if (newViajes.length > 0) {
        const { data, error } = await supabase.from("app_viajes_activos").insert(newViajes).select();
        if (error) throw error;
        insertedViajes = data;
      }
    }

    // Para asociar los pasajeros y checklists a los nuevos UUIDs de viajes, necesitamos mapear 
    // id_viaje_local -> id_viaje (UUID real de Supabase)
    const { data: allViajes } = await supabase.from("app_viajes_activos").select("id_viaje_local, id_viaje");
    const mapViajes = new Map(allViajes?.map((v) => [v.id_viaje_local, v.id_viaje]));

    // 2. Insertar Pasajeros
    if (pasajeros && pasajeros.length > 0) {
      const { data: currentPasajeros } = await supabase.from("app_pasajeros_viaje").select("id_registro_local");
      const existingPasajerosIds = new Set(currentPasajeros?.map((p) => p.id_registro_local) || []);

      const newPasajeros = pasajeros
        .filter((p: any) => !existingPasajerosIds.has(p.id_registro_local))
        .map((p: any) => ({
          ...p,
          id_viaje: mapViajes.get(p.id_viaje_local) || null, // Asignar UUID real
        }));
      
      // Remover campo id_viaje_local temporal
      newPasajeros.forEach((p: any) => delete p.id_viaje_local);

      if (newPasajeros.length > 0) {
        const { error } = await supabase.from("app_pasajeros_viaje").insert(newPasajeros);
        if (error) throw error;
      }
    }

    // 3. Insertar Respuestas de Checklist
    if (respuestas_checklist && respuestas_checklist.length > 0) {
        const newRespuestas = respuestas_checklist.map((r: any) => ({
            ...r,
            id_viaje: mapViajes.get(r.id_viaje_local) || null,
        }));
        
        // Remover campo temporal
        newRespuestas.forEach((r: any) => delete r.id_viaje_local);

        if (newRespuestas.length > 0) {
            const { error } = await supabase.from("app_checklists_respuestas").insert(newRespuestas);
            if (error) throw error;
        }
    }

    return NextResponse.json({ success: true, message: "Sincronización completada." });
  } catch (error: any) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: error.message || "Error al sincronizar datos." }, { status: 500 });
  }
}
