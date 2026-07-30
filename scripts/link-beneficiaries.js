const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

function getWordKey(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/[^A-Z0-9\s]/g, '')
              .split(/\s+/)
              .filter(w => w.length > 1)
              .sort()
              .join(' ');
}

async function linkBeneficiaries() {
    console.log('Fetching all patients and employees...');
    const { data: pacientes } = await supabase.from('pacientes').select('*');
    const { data: empleados } = await supabase.from('empleados').select('*');

    console.log(`Loaded ${pacientes.length} patients and ${empleados.length} employees.`);

    // Map employees by order-independent word set key
    const empMap = new Map();
    empleados.forEach(emp => {
        const fullStr = `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`;
        const key = getWordKey(fullStr);
        if (key) empMap.set(key, emp.id_empleado);
    });

    // Also map Titular patients by word key
    const titularPacMap = new Map();
    pacientes.forEach(p => {
        if (p.parentesco === 'TITULAR (TRABAJADOR)' || p.parentesco === 'TITULAR' || !p.parentesco) {
            const key = getWordKey(p.nombre_completo);
            if (key && p.id_empleado) {
                titularPacMap.set(key, p.id_empleado);
            }
        }
    });

    let linkedCount = 0;
    let notFoundCount = 0;

    for (const pac of pacientes) {
        const parentesco = pac.parentesco || '';
        
        if (parentesco.includes(' DE: ')) {
            const parts = parentesco.split(' DE: ');
            const relType = parts[0].trim(); // e.g. "HIJO", "ESPOSA / CONCUBINA"
            const titularName = parts[1];
            const tKey = getWordKey(titularName);

            let empId = empMap.get(tKey) || titularPacMap.get(tKey);

            if (!empId) {
                // Try matching subsets if 2 or more words match
                const tWords = tKey.split(' ');
                for (const [key, id] of empMap.entries()) {
                    const eWords = key.split(' ');
                    const common = tWords.filter(w => eWords.includes(w));
                    if (common.length >= 2 && (common.length >= tWords.length - 1)) {
                        empId = id;
                        break;
                    }
                }
            }

            if (empId) {
                await supabase
                    .from('pacientes')
                    .update({ id_empleado: empId, parentesco: relType })
                    .eq('id_paciente', pac.id_paciente);
                linkedCount++;
            } else {
                notFoundCount++;
            }
        }
    }

    console.log('--- LINKING FINISHED ---');
    console.log(`Successfully linked beneficiaries: ${linkedCount}`);
    console.log(`Unmatched: ${notFoundCount}`);
}

linkBeneficiaries().catch(console.error);
