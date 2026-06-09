-- Create catalog for standardized termination causes (internal/general logic)
CREATE TABLE IF NOT EXISTS cat_causas_baja (
    id_causa_baja UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa TEXT NOT NULL,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    rol_iniciador TEXT DEFAULT 'Jefe', -- 'Jefe', 'RH', 'Empleado', 'Sistema'
    activo BOOLEAN DEFAULT TRUE
);

-- Insert agreed values
INSERT INTO cat_causas_baja (causa, requiere_evidencia, rol_iniciador) VALUES 
('Término de contrato', FALSE, 'Sistema'),
('Separación voluntaria (renuncia)', FALSE, 'Empleado'),
('Abandono de empleo', TRUE, 'Jefe'),
('Defunción', FALSE, 'RH'),
('Clausura', FALSE, 'Directiva'),
('Otra', TRUE, 'Jefe'),
('Ausentismo', TRUE, 'Jefe'),
('Rescisión de contrato', TRUE, 'Jefe');

-- Create catalog for IMSS specific causes (official codes)
CREATE TABLE IF NOT EXISTS cat_causas_baja_imss (
    id_causa_imss UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL, -- e.g. "1", "2"
    descripcion TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- Insert common IMSS causes (Example values, standard Mexican IMSS codes should be used ideally, here using generic placeholders based on common practice or provided list)
-- Note: User didn't provide specific codes, so I will add the descriptions.
INSERT INTO cat_causas_baja_imss (clave, descripcion) VALUES
('1', 'Término de contrato'),
('2', 'Separación voluntaria'),
('3', 'Abandono de empleo'),
('4', 'Defunción'),
('5', 'Clausura'),
('6', 'Otras'),
('7', 'Ausentismo'),
('8', 'Rescisión de contrato'),
('9', 'Jubilación'),
('10', 'Pensión');

-- Add columns to solicitudes payload validation or ensure JSONB is used (already exists).
-- Add columns to bajas table if missing (already exists in schema.sql but making sure).
-- Revisiting bajas table structure from schema.sql:
-- id_solicitud UUID REFERENCES solicitudes(id_solicitud)
-- tipo_baja TEXT -> We might want to link to cat_causas_baja instead
ALTER TABLE bajas ADD COLUMN IF NOT EXISTS id_causa_baja UUID REFERENCES cat_causas_baja(id_causa_baja);
ALTER TABLE bajas ADD COLUMN IF NOT EXISTS id_causa_imss UUID REFERENCES cat_causas_baja_imss(id_causa_imss);
