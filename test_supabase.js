require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const payload = {
              id_empleado: "00000000-0000-0000-0000-000000000000",
              camion_numero: "TEST-01",
              id_viaje: null,
              kilometraje_inicial: 0,
              kilometraje_final: 0,
              gasolina_inicio: "1/4",
              gasolina_fin: "1/2",
              litros_cargados: 10,
              frenos_ok: true, luces_ok: true, llantas_ok: true, niveles_aceite_ok: true, carroceria_ok: true, extintor_ok: true, botiquin_ok: true,
              comentarios_vehiculo: "test",
              ubicacion_caseta: "test",
              foto_caseta_url: "test",
              observaciones_recorrido: "test",
              firma_chofer_url: "test",
              firma_guardia_url: "test",
              firma_rh_url: null
          }
    const { data, error } = await supabase.from('logistica_reportes_diarios').insert([payload]);
    console.log(error);
}
test();
