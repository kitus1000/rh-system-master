import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    const { data, error } = await supabase.from('cat_puestos').select('*').limit(1)
    if (error) {
        console.error('Error fetching cat_puestos:', error)
        return
    }
    console.log('Sample data from cat_puestos:', data[0])
    console.log('Available columns:', Object.keys(data[0] || {}))
}

debug()
