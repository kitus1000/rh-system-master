
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function check() {
    const { data, error } = await supabase
        .from('empleado_incidencias')
        .select(`
            *,
            cat_tipos_incidencia (tipo_incidencia),
            empleados (nombre, apellido_paterno)
        `)
        .order('fecha_inicio', { ascending: false })
        .limit(5)

    if (error) {
        console.error(error)
    } else {
        console.log(JSON.stringify(data, null, 2))
    }
}

check()
