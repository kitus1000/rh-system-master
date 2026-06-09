-- =========================================================================
-- PARCHE SQL: PERMISOS PARA MÓDULO CHECADOR Y CATÁLOGOS (Fases 3 y 4)
-- Ejecutar en el Editor SQL de Supabase
-- =========================================================================

-- 1. Permiso Faltante: Generador de Códigos (Permite Insertar)
CREATE POLICY "Permitir insert permisos" ON permisos_autorizados FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir delete permisos" ON permisos_autorizados FOR DELETE USING (true);

-- 2. Permisos Faltantes: Catálogo de Turnos (Permite CRUD Completo)
CREATE POLICY "Permitir insert turnos" ON turnos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update turnos" ON turnos FOR UPDATE USING (true);
CREATE POLICY "Permitir delete turnos" ON turnos FOR DELETE USING (true);

-- 3. Permisos Faltantes: Tablas Secundarias en caso de requerirse en UI
CREATE POLICY "Permitir update a todos checadas" ON checadas FOR UPDATE USING (true);

-- Asegurarnos de que las tablas estén protegidas pero con estas políticas activadas
ALTER TABLE permisos_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
