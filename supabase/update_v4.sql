-- supabase/update_v4.sql

-- 1. Crear el bucket de storage para fotos de empleados (si no existe)
-- Nota: En Supabase la tabla real es storage.buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fotos_empleados', 'fotos_empleados', true)
ON CONFLICT (id) DO NOTHING;

-- Habilitar acceso pblico para leer fotos
CREATE POLICY "Imagenes publicas" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'fotos_empleados');

-- Permitir a usuarios autenticados subir sus propias fotos
CREATE POLICY "Subir imagen perfil" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'fotos_empleados' AND auth.role() = 'authenticated');

-- Permitir actualizar sus fotos
CREATE POLICY "Actualizar imagen perfil" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'fotos_empleados' AND auth.role() = 'authenticated');

-- Permitir borrar sus fotos
CREATE POLICY "Borrar imagen perfil" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'fotos_empleados' AND auth.role() = 'authenticated');


-- 2. Modificaciones para el Muro de Actividades 2.0

-- Nuevas columnas en muro_alertas
ALTER TABLE muro_alertas ADD COLUMN IF NOT EXISTS es_tarea BOOLEAN DEFAULT FALSE;
ALTER TABLE muro_alertas ADD COLUMN IF NOT EXISTS tarea_completada BOOLEAN DEFAULT FALSE;
ALTER TABLE muro_alertas ADD COLUMN IF NOT EXISTS privacidad TEXT DEFAULT 'publico'; -- 'publico', 'departamento', 'privado'

-- Tabla para visibilidad especfica cuando privacidad es 'privado'
CREATE TABLE IF NOT EXISTS muro_visibilidad_usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_alerta UUID REFERENCES muro_alertas(id) ON DELETE CASCADE,
    id_usuario UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(id_alerta, id_usuario)
);

-- Tabla para comentarios en el muro
CREATE TABLE IF NOT EXISTS muro_comentarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_alerta UUID REFERENCES muro_alertas(id) ON DELETE CASCADE,
    id_autor UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    comentario TEXT NOT NULL,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- Tabla para reacciones (emojis) en el muro
CREATE TABLE IF NOT EXISTS muro_reacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_alerta UUID REFERENCES muro_alertas(id) ON DELETE CASCADE,
    id_autor UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    creado_el TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_alerta, id_autor, emoji)
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE muro_visibilidad_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE muro_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE muro_reacciones ENABLE ROW LEVEL SECURITY;

-- Polticas de lectura
CREATE POLICY "Lectura visibilidad" ON muro_visibilidad_usuarios FOR SELECT USING (true);
CREATE POLICY "Lectura comentarios" ON muro_comentarios FOR SELECT USING (true);
CREATE POLICY "Lectura reacciones" ON muro_reacciones FOR SELECT USING (true);

-- Polticas de escritura (Autenticados)
CREATE POLICY "Escribir visibilidad" ON muro_visibilidad_usuarios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Escribir comentarios" ON muro_comentarios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Escribir reacciones" ON muro_reacciones FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Borrar reacciones" ON muro_reacciones FOR DELETE USING (auth.uid() = id_autor);
CREATE POLICY "Actualizar alertas" ON muro_alertas FOR UPDATE USING (auth.role() = 'authenticated');
