alter table document_templates 
add column if not exists header_content jsonb,
add column if not exists footer_content jsonb;
