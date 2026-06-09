-- Add Reingreso request type
INSERT INTO cat_tipos_solicitud (tipo_solicitud) 
VALUES ('Reingreso') 
ON CONFLICT DO NOTHING;
