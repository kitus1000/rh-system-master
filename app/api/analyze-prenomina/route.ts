import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { reportData, startDate, endDate } = body

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'La clave de API de Groq no está configurada.' }, { status: 500 })
        }

        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        })

        // Simplificar la data para no saturar el token limit de Groq
        const summarizedData = reportData.map((emp: any) => {
            const sumIncidencias = Object.values(emp.incidencias).reduce((a: any, b: any) => a + b, 0)
            return {
                numero: emp.numero,
                nombre: emp.nombre,
                departamento: emp.depto,
                salarioDiario: emp.salarioDiario,
                horasExtrasDobles: emp.horasDobles,
                horasExtrasTriples: emp.horasTriples,
                festivosTrabajados: emp.festivos,
                totalDiasIncidencias: sumIncidencias,
                desgloseIncidencias: emp.incidencias
            }
        })

        const prompt = `
Eres un Analista Experto de Recursos Humanos y Nómina en México. 
Se te proporciona el resumen de la Pre-Nómina del periodo del ${startDate} al ${endDate}.

Tus instrucciones:
1. Revisa las HORAS EXTRAS Y FESTIVOS: Analiza quiénes tienen horas dobles, triples o festivos. Calcula un estimado del costo extra basándote en su "salarioDiario" y destaca a los empleados más productivos o costosos.
2. Revisa INCIDENCIAS NEGATIVAS: Menciona si hay algún empleado con demasiadas faltas o incidencias, y el impacto económico sugerido.
3. Tu reporte debe ser conciso, ejecutivo, en tono profesional pero directo, dirigido al Superintendente. Usa Markdown (listas y negritas) y divídelo en 3 secciones: "Resumen de Productividad (Horas Extra)", "Atención a Incidencias" y "Recomendación Final".
No expliques la fórmula de cálculo, solo da los hallazgos directamente.

Datos extraídos del sistema:
${JSON.stringify(summarizedData, null, 2)}
`

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.1-70b-versatile',
            temperature: 0.3,
        })

        const analysis = chatCompletion.choices[0]?.message?.content || 'No se pudo generar el análisis.'

        return NextResponse.json({ analysis })
    } catch (error: any) {
        console.error('Error in analyze-prenomina:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
