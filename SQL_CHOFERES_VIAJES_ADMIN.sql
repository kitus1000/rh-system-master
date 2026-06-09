-- ==========================================
-- MÓDULO DE LOGÍSTICA: VIAJES Y ADMINISTRACIÓN
-- ==========================================

-- 1. Crear Tabla de Viajes Programados
CREATE TABLE IF NOT EXISTS logistica_viajes_programados (
    id_viaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    destino VARCHAR(255) NOT NULL,
    fecha_esperada DATE NOT NULL,
    hora_esperada TIME NOT NULL,
    estado VARCHAR(50) DEFAULT 'Programado', -- Programado, En Ruta, Completado, Retrasado
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar Seguridad (RLS)
ALTER TABLE logistica_viajes_programados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a logistica_viajes_programados" ON logistica_viajes_programados FOR ALL USING (true);

-- 2. Agregar columna id_viaje a los reportes diarios
ALTER TABLE logistica_reportes_diarios ADD COLUMN IF NOT EXISTS id_viaje UUID REFERENCES logistica_viajes_programados(id_viaje) ON DELETE SET NULL;
