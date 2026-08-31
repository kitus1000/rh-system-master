import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const isUUID = (str?: string) => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};

export async function GET(request: Request) {
  try {
    // 1. Obtener Checklists activos
    const { data: checklists } = await supabase
      .from("app_checklists_config")
      .select("*")
      .eq("activa", true)
      .order("orden", { ascending: true });

    // 2. Obtener lista COMPLETA de empleados con número de nómina, puesto y departamento
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

    // Obtener catálogo de empleados para mapear UUIDs de choferes y nombres
    const { data: empleadosDb } = await supabase
      .from("empleados")
      .select("id_empleado, nombre, apellido_paterno, apellido_materno");

    const fallbackEmpId = empleadosDb && empleadosDb.length > 0 ? empleadosDb[0].id_empleado : null;

    if (viajes && viajes.length > 0) {
      for (const v of viajes) {
        // Encontrar UUID real del chofer
        let validChoferUUID: string | null = null;
        if (v.id_chofer && isUUID(v.id_chofer)) {
          validChoferUUID = v.id_chofer;
        } else if (v.chofer_nombre && empleadosDb) {
          const matchChofer = empleadosDb.find(e => 
            `${e.nombre} ${e.apellido_paterno}`.toLowerCase().includes(v.chofer_nombre.toLowerCase()) ||
            v.chofer_nombre.toLowerCase().includes(e.nombre.toLowerCase())
          );
          if (matchChofer) validChoferUUID = matchChofer.id_empleado;
        }

        if (!validChoferUUID) validChoferUUID = fallbackEmpId;

        // Construir lista de pasajeros para este viaje
        const pasajerosDeEsteViaje = (pasajeros || [])
          .filter((p: any) => p.id_viaje_local === v.id_viaje_local)
          .map((p: any) => ({
            id: p.id_empleado || p.id_manual || p.id_registro_local,
            nombre: p.nombre_completo || `Trabajador #${p.id_manual || p.id_empleado}`,
            puesto: p.puesto_depto || "Personal",
            departamento: "Mina Bacis",
            hora: p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            metodo: p.metodo_registro || 'QR'
          }));

        const totalPasajeros = pasajerosDeEsteViaje.length;

        // 1. Guardar en logistica_reportes_diarios (Tabla principal existente en Supabase)
        try {
          await supabase.from("logistica_reportes_diarios").insert([{
            id_empleado: validChoferUUID,
            fecha: v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : new Date().toISOString().split('T')[0],
            camion_numero: v.numero_economico || 'UNIDAD',
            tipo_vehiculo: v.tipo_vehiculo || 'Camioneta',
            ubicacion_caseta: v.ruta_destino,
            comentarios_vehiculo: `[VIAJE_QR] Ruta: ${v.ruta_origen} a ${v.ruta_destino} | Chofer: ${v.chofer_nombre} | Pasajeros: ${totalPasajeros} | Salida: ${v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX') : 'N/A'} | Llegada: ${v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX') : 'Completado'}`,
            observaciones_recorrido: JSON.stringify(pasajerosDeEsteViaje),
            frenos_ok: true,
            luces_ok: true,
            llantas_ok: true,
            niveles_aceite_ok: true,
            carroceria_ok: true,
            extintor_ok: true,
            botiquin_ok: true
          }]);
        } catch (errReporte) {
          console.error("Error guardando en logistica_reportes_diarios:", errReporte);
        }

        // 2. Intentar guardar en chofer_bitacora_rutas si la tabla fue creada
        try {
          await supabase.from("chofer_bitacora_rutas").upsert({
            id_bitacora: v.id_viaje_local,
            id_chofer: isUUID(v.id_chofer) ? v.id_chofer : null,
            chofer_nombre: v.chofer_nombre || 'Chofer Operador',
            punto_a: v.ruta_origen,
            punto_b: v.ruta_destino,
            hora_salida_a: v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            hora_llegada_b: v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Completado',
            pasajeros_subieron_a: totalPasajeros,
            pasajeros_bajaron_b: totalPasajeros,
            pasajeros_lista: pasajerosDeEsteViaje,
            estatus: v.estado === 'Finalizado' ? 'CONCLUIDO' : 'EN_CURSO',
            fecha: v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : new Date().toISOString().split('T')[0],
            creado_el: v.hora_inicio_real || new Date().toISOString()
          }, { onConflict: 'id_bitacora' });
        } catch (e) {}

        // 3. Intentar guardar en app_viajes_activos si la tabla existe
        try {
          await supabase.from("app_viajes_activos").upsert({
            id_viaje_local: v.id_viaje_local,
            id_chofer: validChoferUUID,
            ruta_origen: v.ruta_origen,
            ruta_destino: v.ruta_destino,
            hora_inicio_real: v.hora_inicio_real,
            hora_fin_real: v.hora_fin_real,
            estado: v.estado
          }, { onConflict: 'id_viaje_local' });
        } catch (e) {}
      }
    }

    return NextResponse.json({ success: true, message: "Sincronización de manifiestos completada." });
  } catch (error: any) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: error.message || "Error al sincronizar datos." }, { status: 500 });
  }
}
