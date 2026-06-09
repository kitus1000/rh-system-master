require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Querying perfiles roles...');
    const { data, error } = await supabase.from('perfiles').select('nombre_completo, rol');

    if (error) {
        console.error('SUPABASE ERROR:', error);
    } else {
        console.log('SUCCESS. Profiles:', data);
    }
}

test();
