-- ==========================================
-- EL EXPEDIENTE - MÓDULO MÉDICO
-- ==========================================

-- 1. Actualizar el CHECK constraint de perfiles para incluir Médico
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('Administrativo', 'Jefe', 'Médico'));

-- 2. CATÁLOGOS BASE
CREATE TABLE IF NOT EXISTS cat_clinicas (
    id_clinica UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('Interna', 'Externa')),
    ubicacion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_medicamentos (
    id_medicamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    descripcion TEXT,
    sustancia_activa TEXT,
    presentacion TEXT,
    precio_venta NUMERIC(10,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
);

-- 3. INVENTARIO
CREATE TABLE IF NOT EXISTS inventario_clinicas (
    id_inventario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_clinica UUID REFERENCES cat_clinicas(id_clinica),
    id_medicamento UUID REFERENCES cat_medicamentos(id_medicamento),
    cantidad INT DEFAULT 0,
    UNIQUE(id_clinica, id_medicamento)
);

CREATE TABLE IF NOT EXISTS transferencias_medicamentos (
    id_transferencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_clinica_origen UUID REFERENCES cat_clinicas(id_clinica),
    id_clinica_destino UUID REFERENCES cat_clinicas(id_clinica),
    id_medicamento UUID REFERENCES cat_medicamentos(id_medicamento),
    cantidad INT NOT NULL,
    fecha TIMESTAMPTZ DEFAULT now(),
    estatus TEXT DEFAULT 'Completada',
    realizado_por UUID REFERENCES auth.users(id)
);

-- 4. PACIENTES / BENEFICIARIOS
-- "Poblacion general" no tendrá id_empleado. "Beneficiario" tendrá id_empleado.
CREATE TABLE IF NOT EXISTS pacientes (
    id_paciente UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado), -- Nulo si es poblacion general
    nombre_completo TEXT NOT NULL,
    parentesco TEXT, -- Nulo si es poblacion general, o si es el trabajador mismo (se usará la tabla empleados mejor, pero bueno)
    fecha_nacimiento DATE,
    es_poblacion_general BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE
);

-- 5. CONSULTAS Y DISPENSACIÓN
CREATE TABLE IF NOT EXISTS consultas_medicas (
    id_consulta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_clinica UUID REFERENCES cat_clinicas(id_clinica),
    -- El paciente puede ser un empleado directo o un paciente externo/beneficiario
    id_empleado UUID REFERENCES empleados(id_empleado),
    id_paciente UUID REFERENCES pacientes(id_paciente),
    medico_id UUID REFERENCES auth.users(id),
    diagnostico TEXT,
    costo_consulta NUMERIC(10,2) DEFAULT 0,
    pagado BOOLEAN DEFAULT TRUE,
    fecha TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dispensacion_medicamentos (
    id_dispensacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_consulta UUID REFERENCES consultas_medicas(id_consulta),
    id_medicamento UUID REFERENCES cat_medicamentos(id_medicamento),
    cantidad INT NOT NULL,
    costo_unitario NUMERIC(10,2) DEFAULT 0,
    costo_total NUMERIC(10,2) DEFAULT 0
);

-- 6. PASES MÉDICOS
CREATE TABLE IF NOT EXISTS pases_medicos (
    id_pase UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado),
    id_paciente UUID REFERENCES pacientes(id_paciente),
    id_clinica_origen UUID REFERENCES cat_clinicas(id_clinica),
    id_clinica_destino UUID REFERENCES cat_clinicas(id_clinica),
    motivo TEXT,
    requiere_hotel BOOLEAN DEFAULT FALSE,
    hotel_nombre TEXT,
    fecha_salida DATE,
    fecha_retorno DATE,
    estatus TEXT DEFAULT 'Generado',
    generado_por UUID REFERENCES auth.users(id),
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- RLS y Políticas (básicas para dejar operando)
ALTER TABLE cat_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Clinicas" ON cat_clinicas FOR SELECT USING (true);
CREATE POLICY "Admin All Clinicas" ON cat_clinicas FOR ALL USING (true);

ALTER TABLE cat_medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Medicamentos" ON cat_medicamentos FOR SELECT USING (true);
CREATE POLICY "Admin All Medicamentos" ON cat_medicamentos FOR ALL USING (true);

ALTER TABLE inventario_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Inventario" ON inventario_clinicas FOR ALL USING (true);

ALTER TABLE transferencias_medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Transferencias" ON transferencias_medicamentos FOR ALL USING (true);

ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Pacientes" ON pacientes FOR ALL USING (true);

ALTER TABLE consultas_medicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Consultas" ON consultas_medicas FOR ALL USING (true);

ALTER TABLE dispensacion_medicamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Dispensacion" ON dispensacion_medicamentos FOR ALL USING (true);

ALTER TABLE pases_medicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Pases" ON pases_medicos FOR ALL USING (true);
