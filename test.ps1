$url = 'https://levyoflvpcbuueefqhtk.supabase.co/rest/v1/muro_alertas?select=*,autor:perfiles!id_autor(nombre_completo,apodo,avatar_url),departamento:cat_departamentos!id_departamento(departamento),muro_comentarios(id,comentario,creado_el,autor:perfiles!id_autor(apodo,nombre_completo,avatar_url)),muro_reacciones(id,emoji,id_autor),muro_visibilidad_usuarios(id_usuario)&limit=5'
$headers = @{
    'apikey' = 'sb_publishable_FQWWX93mMjFFQdqy6N_GWQ_pb5vkCzG'
    'Authorization' = 'Bearer sb_publishable_FQWWX93mMjFFQdqy6N_GWQ_pb5vkCzG'
}
try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}
