
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://levyoflvpcbuueefqhtk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FQWWX93mMjFFQdqy6N_GWQ_pb5vkCzG'; // Using Anon key as it likely has enough perms or I need service role. 
// Ideally I should use the one from the project, but if this fails I'll ask user.
// Wait, Anon key usually has RLS policies. INSERT might be blocked if not authed.
// But let's try. If it fails, I'll need to use the dashboard or asking the user to run SQL.
// Actually, I can use the same pattern as the app code if I were running in the browser, but here I am in Node.

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log('Checking request types...');
    const { data: types, error } = await supabase.from('cat_tipos_solicitud').select('*');

    if (error) {
        console.error('Error fetching types:', error);
        return;
    }

    console.log('Current types:', types);

    const reingreso = types.find(t => t.tipo_solicitud === 'Reingreso');
    if (reingreso) {
        console.log('✅ "Reingreso" type already exists:', reingreso);
    } else {
        console.log('⚠️ "Reingreso" type MISSING. Attempting to create...');
        const { data: newType, error: insertError } = await supabase
            .from('cat_tipos_solicitud')
            .insert([{ tipo_solicitud: 'Reingreso' }])
            .single();

        if (insertError) {
            console.error('❌ Error creating type:', insertError);
        } else {
            console.log('✅ Created "Reingreso" type:', newType);
        }
    }
}

main();
