-- Copia de migración en supabase/migrations para historial ordenado
-- Ver SQL_INTEGRACION_Y_CONTRATISTAS.sql en raíz para detalles completos

ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check CHECK (
    rol IN (
        'Administrativo',
        'Administrador',
        'Recursos Humanos',
        'Superintendente',
        'Jefe',
        'Jefe de Departamento',
        'Supervisor',
        'Médico',
        'Jefe Médico',
        'Chofer',
        'Encargado de Campamento y Comedor',
        'Contratista',
        'Seguridad',
        'Sistemas'
    )
);

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS id_empresa_contratista UUID;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS email TEXT;
