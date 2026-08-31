import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://levyoflvpcbuueefqhtk.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxldnlvZmx2cGNidXVlZWZxaHRrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAwMDcxOCwiZXhwIjoyMDg1NTc2NzE4fQ.2i3RS1llduOqFVmoKWFWoQSme7nQjtPiv1u8__D0Jhc";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const isUUID = (str?: string) => {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};

export async function GET() {
  try {
    const { data: empleados } = await supabase
      .from("empleados")
      .select("id_empleado, nombre, apellido_paterno, apellido_materno, puesto, departamento, numero_empleado, qr_token, estatus")
      .order("nombre", { ascending: true });

    return NextResponse.json({
      empleados: empleados || [],
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
    const { viajes, pasajeros } = body;

    if (!viajes || !Array.isArray(viajes) || viajes.length === 0) {
      return NextResponse.json({ success: true, message: "Sin viajes para sincronizar." });
    }

    // Obtener catálogo de empleados para relacionar choferes
    const { data: empleadosDb } = await supabase
      .from("empleados")
      .select("id_empleado, nombre, apellido_paterno, apellido_materno");

    let totalGuardados = 0;

    for (const v of viajes) {
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

      // Normalizar lista de pasajeros
      let rawPasajeros: any[] = [];
      if (Array.isArray(v.pasajeros) && v.pasajeros.length > 0) {
        rawPasajeros = v.pasajeros;
      } else if (Array.isArray(pasajeros) && pasajeros.length > 0) {
        rawPasajeros = pasajeros.filter((p: any) => p.id_viaje_local === v.id_viaje_local);
      }

      const listaPasajeros = rawPasajeros.map((p: any) => ({
        id: p.id_empleado || p.id || p.id_manual || p.id_registro_local || 'ID',
        nombre: p.nombre_completo || p.nombre || `Trabajador #${p.id || ''}`,
        puesto: p.puesto_depto || p.puesto || 'Personal Mina Bacis',
        hora: p.hora || (p.hora_subida ? new Date(p.hora_subida).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A'),
        metodo: p.metodo_registro || p.metodo || 'QR'
      }));

      const totalPasajeros = listaPasajeros.length;
      const fechaViaje = v.hora_inicio_real ? v.hora_inicio_real.split('T')[0] : new Date().toISOString().split('T')[0];
      const horaSalida = v.hora_inicio_real ? new Date(v.hora_inicio_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
      const horaLlegada = v.hora_fin_real ? new Date(v.hora_fin_real).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Completado';

      const comentarioTexto = `[VIAJE_QR] Ruta: ${v.ruta_origen} a ${v.ruta_destino} | Chofer: ${v.chofer_nombre} | Pasajeros: ${totalPasajeros} | Salida: ${horaSalida} | Llegada: ${horaLlegada}`;

      // Verificar si ya existe este viaje exacto
      const { data: existing } = await supabase
        .from("logistica_reportes_diarios")
        .select("id_reporte")
        .eq("fecha", fechaViaje)
        .like("comentarios_vehiculo", `%Ruta: ${v.ruta_origen} a ${v.ruta_destino}%`)
        .like("comentarios_vehiculo", `%Chofer: ${v.chofer_nombre}%`)
        .like("comentarios_vehiculo", `%Salida: ${horaSalida}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from("logistica_reportes_diarios")
          .update({
            comentarios_vehiculo: comentarioTexto,
            observaciones_recorrido: JSON.stringify(listaPasajeros),
            ubicacion_caseta: v.ruta_destino || 'Parajes',
            tipo_vehiculo: v.tipo_vehiculo || 'Camioneta',
            camion_numero: v.numero_economico || 'CAM-01'
          })
          .eq("id_reporte", existing[0].id_reporte);

        totalGuardados++;
      } else {
        const { error: errInsert } = await supabase
          .from("logistica_reportes_diarios")
          .insert([{
            id_empleado: validChoferUUID,
            fecha: fechaViaje,
            camion_numero: v.numero_economico || 'CAM-01',
            tipo_vehiculo: v.tipo_vehiculo || 'Camioneta',
            ubicacion_caseta: v.ruta_destino || 'Parajes',
            comentarios_vehiculo: comentarioTexto,
            observaciones_recorrido: JSON.stringify(listaPasajeros),
            frenos_ok: true,
            luces_ok: true,
            llantas_ok: true,
            niveles_aceite_ok: true,
            carroceria_ok: true,
            extintor_ok: true,
            botiquin_ok: true
          }]);

        if (!errInsert) totalGuardados++;
      }

      // Guardar también en chofer_bitacora_pasajeros
      if (listaPasajeros.length > 0) {
        try {
          const pasajerosRows = listaPasajeros.map((p: any) => ({
            id_empleado: isUUID(p.id) ? p.id : null,
            nombre_empleado: p.nombre,
            puesto: p.puesto,
            punto: v.ruta_destino || 'Parajes'
          }));
          await supabase.from("chofer_bitacora_pasajeros").insert(pasajerosRows);
        } catch (_) {}
      }
    }

    return NextResponse.json({ 
      success: true, 
      guardados: totalGuardados,
      message: `Se sincronizaron ${totalGuardados} viajes exitosamente con la oficina central.` 
    });
  } catch (error: any) {
    console.error("Sync POST error:", error);
    return NextResponse.json({ error: error.message || "Error al sincronizar datos." }, { status: 500 });
  }
}
