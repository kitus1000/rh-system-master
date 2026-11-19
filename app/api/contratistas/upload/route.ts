import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BUCKET_NAME = 'contratistas_docs'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const maxBytes = 15 * 1024 * 1024 // 15MB
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'El archivo excede el límite de 15MB' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Ensure bucket exists if using service role
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ')) {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets()
      const exists = buckets?.some((b) => b.name === BUCKET_NAME)
      if (!exists) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: maxBytes,
        })
      }
    }

    const safeExt = (file.name.split('.').pop() || 'pdf').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const cleanBase = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40)
    const storagePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${cleanBase}.${safeExt}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      return NextResponse.json({ error: 'Error subiendo archivo: ' + uploadErr.message }, { status: 400 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: storagePath,
      fileName: file.name,
      mimeType: file.type,
    })
  } catch (err: any) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: err.message || 'Error interno al subir archivo' }, { status: 500 })
  }
}
