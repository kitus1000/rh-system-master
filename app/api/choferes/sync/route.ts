import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
  try {
    // 1. Obtener Checklists activos
    const { data: checklists } = await supabase
      .from("app_checklists_config")
      .select("*")
      .eq("activa", true)
      .order("orden", { ascending: true });

    // 2. Obtener lista COMPLETA de empleados con número de empleado, puesto, departamento y qr_token
    const { data: empleados } = await supabase
      .from("empleados")
      .select("id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, qr_token, estatus")
      .order("nombre", { ascending: true });

    // 3. Obtener viajes programados para hoy
    const hoy = new Date().toISOString().split("T")[0];
    const { data: viajesProgramados } = await supabase
      .from("logistica_viajes_programados")
      .select("*")
      .eq("fecha_esperada", hoy);

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

    // 1. Insertar en app_viajes_activos
    if (viajes && viajes.length > 0) {
      try {
        const { data: currentViajes } = await supabase.from("app_viajes_activos").select("id_viaje_local, id_viaje");
        const existingViajeIds = new Set(currentViajes?.map((v) => v.id_viaje_local) || []);
        const newViajes = viajes.filter((v: any) => !existingViajeIds.has(v.id_viaje_local));

        if (newViajes.length > 0) {
          await supabase.from("app_viajes_activos").insert(newViajes);
        }
      } catch (e) {}

      // 2. Guardar también en chofer_bitacora_rutas para el manifiesto del Administrador
      try {
        for (const v of viajes) {
          const pasajerosDeEsteViaje = (pasajeros || [])
            .filter((p: any) => p.id_viaje_local === v.id_viaje_local)
            .map((p: any) => ({
              id: p.id_empleado || p.id_manual || p.id_registro_local,
              nombre: p.nombre_completo || `Empleado #${p.id_manual || p.id_empleado}`,
              puesto: p.puesto_depto || "Personal",
              departamento: "Mina Bacis",
              hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
              metodo: p.metodo_registro || 'QR'
            }));

          await supabase.from("chofer_bitacora_rutas").upsert({
            id_bitacora: v.id_viaje_local,
            id_chofer: v.id_chofer || null,
            chofer_nombre: v.chofer_nombre || 'Chofer Operador',
            punto_a: v.ruta_origen,
            punto_b: v.ruta_destino,
            hora_salida_a: v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            hora_llegada_b: v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Completado',
            pasajeros_subieron_a: pasajerosDeEsteViaje.length,
            pasajeros_bajaron_b: pasajerosDeEsteViaje.length,
            pasajeros_lista: pasajerosDeEsteViaje,
            estatus: v.estado === 'Finalizado' ? 'CONCLUIDO' : 'EN_CURSO',
            fecha: v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : new Date().toISOString().split('T')[0],
            creado_el: v.hora_inicio_real || new Date().toISOString()
          }, { onConflict: 'id_bitacora' });
        }
      } catch (e) {}
    }

    // 3. Insertar Pasajeros en app_pasajeros_viaje si existe la tabla
    if (pasajeros && pasajeros.length > 0) {
      try {
        const { data: allViajes } = await supabase.from("app_viajes_activos").select("id_viaje_local, id_viaje");
        const mapViajes = new Map(allViajes?.map((v) => [v.id_viaje_local, v.id_viaje]));
        const { data: currentPasajeros } = await supabase.from("app_pasajeros_viaje").select("id_registro_local");
        const existingPasajerosIds = new Set(currentPasajeros?.map((p) => p.id_registro_local) || []);

        const newPasajeros = pasajeros
          .filter((p: any) => !existingPasajerosIds.has(p.id_registro_local))
          .map((p: any) => {
            const copy = { ...p, id_viaje: mapViajes.get(p.id_viaje_local) || null };
            delete copy.id_viaje_local;
            return copy;
          });

        if (newPasajeros.length > 0) {
          await supabase.from("app_pasajeros_viaje").insert(newPasajeros);
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, message: "Sincronización completada exitosamente." });
  } catch (error: any) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: error.message || "Error al sincronizar datos." }, { status: 500 });
  }
}
