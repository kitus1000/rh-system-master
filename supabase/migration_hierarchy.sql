-- Run this in your Supabase SQL Editor to add the Manager flag
ALTER TABLE cat_puestos 
ADD COLUMN es_jefe boolean DEFAULT false;

-- Optional: If you want to link departments specifically to a "Titular"
-- ALTER TABLE cat_departamentos ADD COLUMN id_titular uuid REFERENCES empleados(id_empleado);
