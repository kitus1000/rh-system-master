require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing campamentos query...');
    const { data, error } = await supabase.from('campamentos')
        .select(`
          id_campamento, nombre, ubicacion, tipo,
          campamento_cuartos (
            id_cuarto, nombre, estatus_limpieza,
            campamento_camas (
              id_cama, numero, estatus_lavado, id_empleado,
              empleados ( id_empleado, nombre, apellido_paterno, puesto )
            )
          )
        `)
        .order('creado_el');

    if (error) {
        console.error('SUPABASE ERROR:', error);
    } else {
        console.log('SUCCESS. Data length:', data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

test();
