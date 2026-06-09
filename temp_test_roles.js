const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url, key;
for (let l of env) {
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = l.split('=')[1].trim();
    if (l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = l.split('=')[1].trim();
}
const supabase = createClient(url, key);
async function run() {
    // Try embedded join like original code
    const { data, error } = await supabase
        .from('empleados')
        .select('id_empleado, nombre, apellido_paterno, empleado_roles(fecha_inicio, cat_tipos_rol(tipo_rol, dias_trabajo, dias_descanso))')
        .eq('estado_empleado', 'Activo')
        .limit(3);
    console.log('EMBEDDED ERROR:', error);
    fs.writeFileSync('/tmp/temp_emps_roles.json', JSON.stringify(data, null, 2));
    console.log('Written to /tmp/temp_emps_roles.json');
}
run();
