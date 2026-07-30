const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const url = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !key) {
    console.error('Missing Supabase URL or Anon Key in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

function parseName(fullName) {
    if (!fullName) return { nombre: 'SIN NOMBRE', apellido_paterno: '', apellido_materno: '' };
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return { nombre: parts[0], apellido_paterno: '', apellido_materno: '' };
    }
    if (parts.length === 2) {
        return { nombre: parts[0], apellido_paterno: parts[1], apellido_materno: '' };
    }
    if (parts.length === 3) {
        return { nombre: parts[0], apellido_paterno: parts[1], apellido_materno: parts[2] };
    }
    // 4 or more parts: e.g. JOSE ANASTACIO ARREOLA OROSCO -> first 2 are names, last 2 are surnames
    const apellido_materno = parts.pop() || '';
    const apellido_paterno = parts.pop() || '';
    const nombre = parts.join(' ');
    return { nombre, apellido_paterno, apellido_materno };
}

async function importPersonal() {
    console.log('Starting full import of personal.xlsx...');
    const excelPath = path.join(__dirname, '../personal.xlsx');
    const wb = xlsx.readFile(excelPath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`Found ${rows.length} rows in personal.xlsx`);

    let insertedCount = 0;
    let updatedCount = 0;
    let pacienteCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const numEmpleado = String(row['#'] || i + 1);
        const fullName = String(row['Nombre completo'] || '').trim();
        const puesto = String(row['Puesto'] || 'GENERAL').trim();
        const departamento = String(row['Departamento'] || 'GENERAL').trim();
        const rfc = String(row['RFC'] || '').trim();
        const curp = String(row['CURP'] || '').trim();
        const nss = String(row['Afiliación IMSS'] || '').trim();

        if (!fullName) continue;

        const { nombre, apellido_paterno, apellido_materno } = parseName(fullName);

        // 1. Check if employee already exists by curp, rfc or name
        let { data: existingEmp } = await supabase
            .from('empleados')
            .select('*')
            .or(`curp.eq."${curp}",rfc.eq."${rfc}",numero_empleado.eq."${numEmpleado}"`)
            .limit(1);

        let empId = null;

        const empData = {
            numero_empleado: numEmpleado,
            nombre,
            apellido_paterno,
            apellido_materno,
            puesto,
            departamento,
            curp: curp || null,
            rfc: rfc || null,
            nss: nss || null,
            estado_empleado: 'ACTIVO'
        };

        if (existingEmp && existingEmp.length > 0) {
            empId = existingEmp[0].id_empleado;
            await supabase.from('empleados').update(empData).eq('id_empleado', empId);
            updatedCount++;
        } else {
            const { data: newEmp, error: insErr } = await supabase
                .from('empleados')
                .insert([empData])
                .select('id_empleado')
                .single();
            
            if (insErr) {
                console.warn(`Error inserting employee ${fullName}:`, insErr.message);
                // Fallback insert without select
                const { data: fallbackEmp } = await supabase.from('empleados').insert([empData]);
                empId = fallbackEmp ? fallbackEmp[0]?.id_empleado : null;
            } else if (newEmp) {
                empId = newEmp.id_empleado;
            }
            insertedCount++;
        }

        // 2. Insert or update into pacientes table as TITULAR (TRABAJADOR)
        const { data: existingPac } = await supabase
            .from('pacientes')
            .select('id_paciente')
            .eq('nombre_completo', fullName)
            .limit(1);

        const pacData = {
            nombre_completo: fullName,
            parentesco: 'TITULAR (TRABAJADOR)',
            es_poblacion_general: false,
            activo: true,
            id_empleado: empId
        };

        if (existingPac && existingPac.length > 0) {
            await supabase.from('pacientes').update(pacData).eq('id_paciente', existingPac[0].id_paciente);
        } else {
            await supabase.from('pacientes').insert([pacData]);
            pacienteCount++;
        }

        if ((i + 1) % 50 === 0 || i === rows.length - 1) {
            console.log(`Processed ${i + 1}/${rows.length} rows...`);
        }
    }

    console.log('--- IMPORT COMPLETED ---');
    console.log(`Employees Inserted: ${insertedCount}`);
    console.log(`Employees Updated: ${updatedCount}`);
    console.log(`Patients (Titulares) Created: ${pacienteCount}`);
}

importPersonal().catch(console.error);
