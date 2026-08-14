"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Clock, Truck, Users, AlertTriangle } from "lucide-react";

// Utilizamos la key anónima para cliente, asumiendo que RLS permite lectura al rol autenticado.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function BitacoraChoferes() {
  const [viajes, setViajes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchViajes = async () => {
    setLoading(true);
    // Join con empleados para obtener el nombre del chofer
    const { data, error } = await supabase
      .from("app_viajes_activos")
      .select(`
        *,
        empleados ( nombre, apellido_paterno, apellido_materno )
      `)
      .order("hora_inicio_real", { ascending: false });

    if (!error && data) {
      setViajes(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchViajes();
    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_viajes_activos" },
        () => {
          fetchViajes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Bitácora de Viajes</h1>
          <p className="text-zinc-500 mt-1">Monitoreo en tiempo real de las rutas de los choferes.</p>
        </div>
        <button
          onClick={fetchViajes}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-500 animate-pulse font-medium">Cargando bitácora...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-zinc-700">Chofer</th>
                <th className="px-6 py-4 font-semibold text-zinc-700">Ruta</th>
                <th className="px-6 py-4 font-semibold text-zinc-700">Horarios</th>
                <th className="px-6 py-4 font-semibold text-zinc-700">Estado</th>
                <th className="px-6 py-4 font-semibold text-zinc-700">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {viajes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No hay viajes registrados.
                  </td>
                </tr>
              ) : (
                viajes.map((viaje) => {
                  const nombre = viaje.empleados 
                    ? `${viaje.empleados.nombre} ${viaje.empleados.apellido_paterno}`
                    : "Desconocido";

                  return (
                    <tr key={viaje.id_viaje} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {nombre.charAt(0)}
                          </div>
                          <span className="font-medium text-zinc-900">{nombre}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-zinc-600">
                          <span className="flex items-center gap-1"><Truck className="w-3 h-3"/> {viaje.ruta_origen}</span>
                          <span className="text-xs text-zinc-400">hacia</span>
                          <span className="font-medium">{viaje.ruta_destino}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-zinc-600">
                          <span className="flex items-center gap-1 text-green-600">
                            <Clock className="w-3 h-3"/> 
                            Inicio: {viaje.hora_inicio_real ? new Date(viaje.hora_inicio_real).toLocaleTimeString() : '--:--'}
                          </span>
                          <span className="flex items-center gap-1 text-zinc-400 mt-1">
                            Llegada: {viaje.hora_fin_real ? new Date(viaje.hora_fin_real).toLocaleTimeString() : 'En curso...'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                          viaje.estado === 'Finalizado' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {viaje.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400">
                        {new Date(viaje.sincronizado_el).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
