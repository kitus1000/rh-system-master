-- ==========================================
-- MÓDULO DE CAMPAMENTOS
-- ==========================================

-- 1. Tabla de Campamentos Principales
CREATE TABLE IF NOT EXISTS campamentos (
    id_campamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    ubicacion VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Cuartos / Cabañas
CREATE TABLE IF NOT EXISTS campamento_cuartos (
    id_cuarto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_campamento UUID REFERENCES campamentos(id_campamento) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    estatus_limpieza VARCHAR(50) DEFAULT 'Limpio',
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Camas (Asignación y Lavandería)
CREATE TABLE IF NOT EXISTS campamento_camas (
    id_cama UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_cuarto UUID REFERENCES campamento_cuartos(id_cuarto) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    estatus_lavado VARCHAR(50) DEFAULT 'Entregado',
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(id_cuarto, numero)
);

-- 4. SEGURIDAD (RLS)
ALTER TABLE campamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a campamentos" ON campamentos FOR ALL USING (true);

ALTER TABLE campamento_cuartos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a campamento_cuartos" ON campamento_cuartos FOR ALL USING (true);

ALTER TABLE campamento_camas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a campamento_camas" ON campamento_camas FOR ALL USING (true);

-- Insertar Campamento de Ejemplo
INSERT INTO campamentos (nombre, ubicacion, tipo) 
VALUES ('Campamento Pionero', 'Zona Norte', 'General');
