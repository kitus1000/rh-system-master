-- ==========================================
-- MÓDULO DE LOGÍSTICA: CHOFERES Y REPORTES
-- ==========================================

-- 1. Actualizar la tabla de Empleados para poder identificar a los choferes
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento VARCHAR(100) DEFAULT 'Sin Asignar';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS puesto VARCHAR(100) DEFAULT 'Empleado General';

-- 2. Crear Tabla del Reporte Diario y Checklist Vehicular
CREATE TABLE IF NOT EXISTS logistica_reportes_diarios (
    id_reporte UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    camion_numero VARCHAR(50),
    
    -- Combustible y Kilometraje
    kilometraje_inicial INTEGER,
    kilometraje_final INTEGER,
    gasolina_inicio VARCHAR(50), -- Ej: '1/4', '1/2', 'Lleno'
    gasolina_fin VARCHAR(50),
    litros_cargados NUMERIC DEFAULT 0,
    
    -- Checklist Vehicular
    frenos_ok BOOLEAN DEFAULT true,
    luces_ok BOOLEAN DEFAULT true,
    llantas_ok BOOLEAN DEFAULT true,
    niveles_aceite_ok BOOLEAN DEFAULT true,
    carroceria_ok BOOLEAN DEFAULT true,
    extintor_ok BOOLEAN DEFAULT true,
    botiquin_ok BOOLEAN DEFAULT true,
    comentarios_vehiculo TEXT,
    
    -- Evidencia de Caseta / Recorrido
    ubicacion_caseta VARCHAR(255),
    foto_caseta_url TEXT,
    observaciones_recorrido TEXT,
    
    -- Firmas (Se guardará la ruta de la imagen o la firma en base64)
    firma_chofer_url TEXT,
    firma_guardia_url TEXT,
    firma_rh_url TEXT,
    
    -- Auditoría
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE logistica_reportes_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a logistica_reportes_diarios" ON logistica_reportes_diarios FOR ALL USING (true);

-- ==========================================
-- INSTRUCCIONES PARA EL BUCKET DE FOTOS
-- ==========================================
-- NOTA IMPORTANTE PARA EL ADMINISTRADOR:
-- Por razones de seguridad, los Storage Buckets deben crearse desde el panel de Supabase.
-- 1. Ve a "Storage" en la barra izquierda de Supabase.
-- 2. Haz clic en "New bucket".
-- 3. Llámalo exactamente: logistica_evidencias
-- 4. Activa la opción "Public bucket" (Para que las firmas y fotos de casetas se puedan ver en los PDFs).
-- ==========================================

-- 4. Crear un Chofer de Prueba para Presentación
INSERT INTO empleados (
    numero_empleado, nombre, apellido_paterno, apellido_materno, 
    departamento, puesto, estado_empleado
) VALUES (
    9999, 'Juan', 'Pérez', 'Mendoza',
    'Logística', 'Chofer', 'Activo'
);
