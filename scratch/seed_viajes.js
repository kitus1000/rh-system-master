const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Iniciando inserción de rutas de transporte para Julio 2026...');

    // Clear existing trips in July 2026 to avoid duplicates when testing
    const { error: deleteError } = await supabase
        .from('transporte_personal_viajes')
        .delete()
        .gte('fecha', '2026-07-01')
        .lte('fecha', '2026-07-31');

    if (deleteError) {
        console.error('Error limpiando viajes viejos:', deleteError);
    } else {
        console.log('Se limpiaron viajes anteriores en el mes de Julio.');
    }

    const viajes = [];

    // Helper to get all days of a month
    const getDaysInMonth = (year, month) => {
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const days = getDaysInMonth(2026, 6); // 6 is July (0-indexed)

    // Rotation cycle settings
    const rotationStart = new Date('2026-07-01T00:00:00');

    days.forEach(day => {
        const dateStr = day.toISOString().split('T')[0];
        const dayOfWeek = day.getDay(); // 0: Sunday, 2: Tuesday, 4: Thursday, 6: Saturday

        // Rule 1: Tuesdays (2) and Saturdays (6) -> Entrada Pase Médico (Autobús)
        if (dayOfWeek === 2 || dayOfWeek === 6) {
            viajes.push({
                tipo_vehiculo: 'Autobús',
                nombre_ruta: 'Durango - Bacis (Pase Médico)',
                fecha: dateStr,
                hora: '08:00:00',
                capacidad_total: 37,
                estado: 'Programado'
            });
        }

        // Rule 2: Thursdays (4) and Sundays (0) -> Salida Revisión Médica (Autobús)
        if (dayOfWeek === 4 || dayOfWeek === 0) {
            viajes.push({
                tipo_vehiculo: 'Autobús',
                nombre_ruta: 'Bacis - Durango (Revisión Médica)',
                fecha: dateStr,
                hora: '16:00:00',
                capacidad_total: 37,
                estado: 'Programado'
            });
        }

        // Rule 3: Shift Rotation (Day 20 Exit, Day 30 Return)
        const diffTime = day.getTime() - rotationStart.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
            const R = diffDays % 29;
            if (R === 19) {
                // Salida (Día 20) -> Autobús and Avioneta (8 seats)
                viajes.push({
                    tipo_vehiculo: 'Autobús',
                    nombre_ruta: 'Bacis - Durango (Salida de Personal)',
                    fecha: dateStr,
                    hora: '12:00:00',
                    capacidad_total: 37,
                    estado: 'Programado'
                });
                viajes.push({
                    tipo_vehiculo: 'Avioneta',
                    nombre_ruta: 'Bacis - Durango (Vuelo de Salida)',
                    fecha: dateStr,
                    hora: '10:00:00',
                    capacidad_total: 8,
                    estado: 'Programado'
                });
            } else if (R === 0) {
                // Regreso (Día 30) -> Autobús and Avioneta (8 seats)
                viajes.push({
                    tipo_vehiculo: 'Autobús',
                    nombre_ruta: 'Durango - Bacis (Regreso de Personal)',
                    fecha: dateStr,
                    hora: '07:00:00',
                    capacidad_total: 37,
                    estado: 'Programado'
                });
                viajes.push({
                    tipo_vehiculo: 'Avioneta',
                    nombre_ruta: 'Durango - Bacis (Vuelo de Regreso)',
                    fecha: dateStr,
                    hora: '09:00:00',
                    capacidad_total: 8,
                    estado: 'Programado'
                });
            }
        }
    });

    console.log(`Insertando ${viajes.length} viajes en Supabase...`);

    const { data, error } = await supabase
        .from('transporte_personal_viajes')
        .insert(viajes)
        .select();

    if (error) {
        console.error('Error insertando viajes:', error);
    } else {
        console.log(`¡Éxito! Se insertaron ${data.length} viajes correctamente para el mes de Julio 2026.`);
    }
}

seed();
