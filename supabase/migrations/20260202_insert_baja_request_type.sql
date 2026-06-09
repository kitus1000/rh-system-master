-- Insert 'Baja' request type if it doesn't exist
INSERT INTO cat_tipos_solicitud (tipo_solicitud)
SELECT 'Baja'
WHERE NOT EXISTS (
    SELECT 1 FROM cat_tipos_solicitud WHERE tipo_solicitud = 'Baja'
);
