alter table document_templates
add column if not exists blocks jsonb default '[]'::jsonb;
