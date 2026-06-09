-- Semillas para Catálogo de Tipos de Rol (Turnos)
INSERT INTO cat_tipos_rol (tipo_rol, dias_trabajo, dias_descanso, descripcion) VALUES
('20x10', 20, 10, '20 días de trabajo por 10 de descanso'),
('14x7', 14, 7, '14 días de trabajo por 7 de descanso'),
('5x2', 5, 2, 'Semana inglesa (5 días trabajo, 2 descanso)')
ON CONFLICT DO NOTHING;
