-- Semillas para Catálogo de Tipos de Incidencia
INSERT INTO cat_tipos_incidencia (tipo_incidencia, bloquea_asistencia, requiere_evidencia, cuenta_como_descanso) VALUES
('Falta Injustificada', TRUE, FALSE, FALSE),
('Incapacidad Enfermedad General', TRUE, TRUE, FALSE),
('Incapacidad Riesgo Trabajo', TRUE, TRUE, FALSE),
('Incapacidad Maternidad', TRUE, TRUE, FALSE),
('Permiso con Goce', TRUE, FALSE, FALSE),
('Permiso sin Goce', TRUE, FALSE, FALSE),
('Vacaciones', TRUE, FALSE, TRUE),
('Retardo', FALSE, FALSE, FALSE),
('Defunción Familiar', TRUE, TRUE, FALSE),
('Paternidad', TRUE, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- Semillas para Catálogo de Tipos de Solicitud (IMPORTANTE: Debe haber coincidencia con Incidencias para el auto-link)
INSERT INTO cat_tipos_solicitud (tipo_solicitud) VALUES
('Vacaciones'),
('Permiso Personal'),
('Home Office'),
('Justificación de Falta'),
('Baja de Personal')
ON CONFLICT DO NOTHING;
