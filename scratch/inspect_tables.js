require('dotenv').config({ path: 'C:/Users/jesus.martinez/Downloads/rh-system-master/rh-system-master/rh-system-master/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  try {
    const { data: emp, error: eErr } = await supabase.from('empleados').select('*').limit(1);
    console.log('empleados columns:', emp ? Object.keys(emp[0]) : 'None', eErr?.message);

    const { data: perf, error: pErr } = await supabase.from('perfiles').select('*').limit(1);
    console.log('perfiles columns:', perf ? Object.keys(perf[0]) : 'None', pErr?.message);

    const { data: hist, error: hErr } = await supabase.from('movimientos_historial_estancia').select('*').limit(1);
    console.log('historial columns:', hist ? Object.keys(hist[0] || {}) : 'None', hErr?.message);

    const { data: post, error: poErr } = await supabase.from('movimientos_postulantes').select('*').limit(1);
    console.log('postulantes columns:', post ? Object.keys(post[0] || {}) : 'None', poErr?.message);
  } catch (err) {
    console.error('Inspect error:', err);
  }
}
inspect();
