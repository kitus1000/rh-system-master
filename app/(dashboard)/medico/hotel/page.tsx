'use client'

import { useState } from 'react'
import { Building, Printer, User, Calendar, Hotel, CheckSquare } from 'lucide-react'

export default function PaseHotelPage() {
    const [formData, setFormData] = useState({
        pase_medico: 'SAMANTA GUADALUPE MORENO HERNANDEZ',
        acompanante: 'LEYSI ALEJANDRA HERNANDEZ ROMERO',
        fecha_salida: new Date().toISOString().split('T')[0],
        hotel_nombre: 'HOTEL DEL CENTRO',
        empresa: 'GRUPO MINERO BACIS S.A. DE C.V.',
        unidad: 'UNIDAD "EL HERRERO"'
    })

    const handlePrint = (e: React.FormEvent) => {
        e.preventDefault()
        const printWindow = window.open('', '_blank', 'width=850,height=1100')
        if (!printWindow) return

        const pacienteNombre = formData.pase_medico.toUpperCase() || 'SIN ESPECIFICAR'
        const acompananteNombre = formData.acompanante.toUpperCase() || 'SIN ACOMPAÑANTE / NO REQUIERE'

        // Formato corto p. ej. 16/07/2026
        const fechaSalidaCorta = formData.fecha_salida ? new Date(formData.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

        // Formato largo p. ej. jueves, 16 de julio de 2026
        const fechaSalidaLarga = formData.fecha_salida ? new Date(formData.fecha_salida + 'T12:00:00').toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        }) : new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

        const hotelNombre = formData.hotel_nombre.toUpperCase()
        const empresaNombre = formData.empresa.toUpperCase()
        const unidadNombre = formData.unidad.toUpperCase()

        printWindow.document.write(`
            <html>
                <head>
                    <title>Pase de Hotel - ${pacienteNombre}</title>
                    <style>
                        @page {
                            size: letter portrait;
                            margin: 0;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 0;
                            color: #000;
                            background: #fff;
                            box-sizing: border-box;
                        }
                        .page-container {
                            width: 215.9mm;
                            height: 279.4mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            box-sizing: border-box;
                            padding: 10mm 15mm;
                            position: relative;
                        }
                        .half-ticket {
                            height: 126mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            box-sizing: border-box;
                            padding: 6mm 6mm;
                        }
                        .header-text {
                            text-align: center;
                            font-weight: bold;
                            font-size: 15px;
                            line-height: 1.4;
                            margin-bottom: 20px;
                            letter-spacing: 0.5px;
                        }
                        .sub-title {
                            text-align: center;
                            font-weight: bold;
                            font-size: 14px;
                            margin: 15px 0 25px 0;
                            text-decoration: underline;
                        }
                        .table-favor {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 25px;
                        }
                        .table-favor th {
                            text-align: left;
                            font-size: 13px;
                            font-weight: bold;
                            padding: 6px 10px;
                            width: 180px;
                        }
                        .table-favor td {
                            text-align: left;
                            font-size: 13px;
                            padding: 6px 10px;
                            border-bottom: 1px solid #000;
                            font-weight: normal;
                        }
                        .row-salida {
                            display: flex;
                            align-items: center;
                            margin-top: 15px;
                            margin-bottom: 35px;
                            font-size: 13px;
                            font-weight: bold;
                        }
                        .row-salida .salida-val {
                            flex-grow: 1;
                            max-width: 320px;
                            border-bottom: 1px solid #000;
                            text-align: center;
                            margin-left: 15px;
                            font-weight: normal;
                        }
                        .signatures {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            margin-top: auto;
                            padding-top: 25px;
                        }
                        .sig-box {
                            width: 220px;
                            text-align: center;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .sig-line {
                            border-bottom: 1px solid #000;
                            height: 30px;
                            margin-bottom: 6px;
                        }
                        .cut-line {
                            border-top: 2px dashed #333;
                            margin: 0;
                            position: relative;
                            width: 100%;
                            text-align: center;
                        }
                        .cut-icon {
                            position: absolute;
                            top: -10px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: #fff;
                            padding: 0 15px;
                            font-size: 11px;
                            color: #555;
                            font-weight: bold;
                            letter-spacing: 1px;
                        }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <!-- PARTE SUPERIOR (ORIGINAL) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">
                                    ${empresaNombre}<br>
                                    ${unidadNombre}
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>

                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2">A FAVOR DE</th>
                                    </tr>
                                    <tr>
                                        <th>PASE MEDICO</th>
                                        <td>${pacienteNombre}</td>
                                    </tr>
                                    <tr>
                                        <th>ACOMPAÑANTE</th>
                                        <td>${acompananteNombre}</td>
                                    </tr>
                                </table>

                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaCorta}</span>
                                </div>
                            </div>

                            <div class="signatures">
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA TRABAJADOR
                                </div>
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA RH UNIDAD
                                </div>
                            </div>
                        </div>

                        <!-- LÍNEA DE CORTE -->
                        <div class="cut-line">
                            <span class="cut-icon">✂ -- CORTAR POR AQUÍ (COPIA Y ORIGINAL) -- ✂</span>
                        </div>

                        <!-- PARTE INFERIOR (COPIA) -->
                        <div class="half-ticket">
                            <div>
                                <div class="header-text">
                                    ${empresaNombre}<br>
                                    ${unidadNombre}
                                </div>
                                <div class="sub-title">
                                    HOSPEDAJE EN ${hotelNombre}
                                </div>

                                <table class="table-favor">
                                    <tr>
                                        <th colspan="2">A FAVOR DE</th>
                                    </tr>
                                    <tr>
                                        <th>PASE MEDICO</th>
                                        <td>${pacienteNombre}</td>
                                    </tr>
                                    <tr>
                                        <th>ACOMPAÑANTE</th>
                                        <td>${acompananteNombre}</td>
                                    </tr>
                                </table>

                                <div class="row-salida">
                                    <span>SALIDA DE LA UNIDAD</span>
                                    <span class="salida-val">${fechaSalidaLarga}</span>
                                </div>
                            </div>

                            <div class="signatures">
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA TRABAJADOR
                                </div>
                                <div class="sig-box">
                                    <div class="sig-line"></div>
                                    FIRMA RH UNIDAD
                                </div>
                            </div>
                        </div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-zinc-150">
                <div>
                    <h1 className="text-2xl font-black text-zinc-800 flex items-center gap-3">
                        <div className="bg-purple-100 text-purple-700 p-3 rounded-2xl">
                            <Building className="w-6 h-6" />
                        </div>
                        Pase de Hospedaje en Hotel (Hoja Dividida)
                    </h1>
                    <p className="text-zinc-500 text-xs mt-1">
                        Emisión rápida de pases de hotel para trabajadores, pacientes y acompañantes médicos en hoja dividida en dos mitades.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formulario */}
                <form onSubmit={handlePrint} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-150 space-y-5">
                    <h2 className="text-sm font-black text-zinc-700 uppercase tracking-wider flex items-center gap-2 border-b border-zinc-100 pb-3">
                        <User className="w-4 h-4 text-purple-600" /> Datos del Pase y Beneficiarios
                    </h2>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">A FAVOR DE (PASE MÉDICO / PACIENTE)</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.pase_medico}
                            onChange={e => setFormData({ ...formData, pase_medico: e.target.value })}
                            placeholder="Ej. SAMANTA GUADALUPE MORENO HERNANDEZ"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">ACOMPAÑANTE</label>
                        <input
                            type="text"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.acompanante}
                            onChange={e => setFormData({ ...formData, acompanante: e.target.value })}
                            placeholder="Ej. LEYSI ALEJANDRA HERNANDEZ ROMERO o NO REQUIERE"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">SALIDA DE LA UNIDAD (FECHA)</label>
                        <input
                            type="date"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.fecha_salida}
                            onChange={e => setFormData({ ...formData, fecha_salida: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-700 uppercase mb-1.5">NOMBRE DEL HOTEL / HOSPEDAJE</label>
                        <input
                            type="text"
                            required
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800"
                            value={formData.hotel_nombre}
                            onChange={e => setFormData({ ...formData, hotel_nombre: e.target.value })}
                            placeholder="HOTEL DEL CENTRO"
                        />
                    </div>

                    <div className="pt-4 border-t border-zinc-100 flex justify-end">
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-500 text-white font-black px-8 py-4 rounded-2xl text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/20 w-full justify-center"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir Hoja Dividida en 2 Mitades</span>
                        </button>
                    </div>
                </form>

                {/* Vista Previa Visual */}
                <div className="bg-zinc-900 text-white p-6 rounded-3xl shadow-sm space-y-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                            <span className="text-xs font-black uppercase tracking-widest text-purple-400">Estilo Oficial Hoja Carta Dividida</span>
                            <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded text-zinc-400">✂ Línea de Corte Medio</span>
                        </div>
                        
                        <div className="space-y-4 text-xs font-mono bg-white text-black p-4 rounded-xl shadow-inner border border-zinc-300">
                            <div className="text-center font-bold text-xs border-b border-zinc-200 pb-2">
                                GRUPO MINERO BACIS S.A. DE C.V.<br/>UNIDAD "EL HERRERO"<br/>
                                <span className="text-[10px] text-purple-700 font-black">HOSPEDAJE EN {formData.hotel_nombre}</span>
                            </div>
                            <div className="space-y-1 py-2 text-[11px]">
                                <div><strong className="text-zinc-500">PASE MEDICO:</strong> <span className="font-bold">{formData.pase_medico}</span></div>
                                <div><strong className="text-zinc-500">ACOMPAÑANTE:</strong> <span className="font-bold">{formData.acompanante || 'NO REQUIERE'}</span></div>
                                <div><strong className="text-zinc-500">SALIDA:</strong> <span className="font-bold">{formData.fecha_salida}</span></div>
                            </div>
                            <div className="border-t border-dashed border-zinc-400 pt-2 text-center text-[9px] text-zinc-400">
                                --- ✂ --- CORTAR POR AQUÍ / COPIA Y ORIGINAL --- ✂ ---
                            </div>
                            <div className="text-center font-bold text-xs border-b border-zinc-200 pb-1 text-zinc-700">
                                (MITAD INFERIOR - COPIA)
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-950/40 border border-purple-800/40 p-4 rounded-2xl text-xs text-purple-200 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-purple-300">
                            <CheckSquare className="w-4 h-4 text-purple-400" /> Ventajas del Formato Dividido
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">
                            Al hacer clic en Imprimir, se generará exactamente un documento en tamaño carta con 2 cupones idénticos y una línea punteada de corte central para que el hotel conserve el original y el trabajador o RH se queden con su acuse de recibo.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
