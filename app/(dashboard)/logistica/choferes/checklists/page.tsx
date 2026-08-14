"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { CheckSquare, Plus, Trash2, Edit2, GripVertical } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ConfigChecklists() {
  const [preguntas, setPreguntas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevaPregunta, setNuevaPregunta] = useState("");

  const fetchPreguntas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_checklists_config")
      .select("*")
      .order("orden", { ascending: true });

    if (!error && data) {
      setPreguntas(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPreguntas();
  }, []);

  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaPregunta.trim()) return;

    const orden = preguntas.length > 0 ? preguntas[preguntas.length - 1].orden + 1 : 1;
    
    const { error } = await supabase
      .from("app_checklists_config")
      .insert([{ pregunta: nuevaPregunta.trim(), orden }]);

    if (!error) {
      setNuevaPregunta("");
      fetchPreguntas();
    } else {
      alert("Error al agregar pregunta");
    }
  };

  const handleToggleActiva = async (id: string, activa: boolean) => {
    await supabase.from("app_checklists_config").update({ activa }).eq("id_pregunta", id);
    fetchPreguntas();
  };

  const handleEliminar = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta pregunta del checklist?")) {
      await supabase.from("app_checklists_config").delete().eq("id_pregunta", id);
      fetchPreguntas();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Checklists de Vehículos</h1>
        <p className="text-zinc-500 mt-1">Configura las preguntas de revisión que los choferes deben responder antes de iniciar la ruta.</p>
      </div>

      {/* Formulario de nueva pregunta */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
          <CheckSquare className="w-4 h-4" /> Agregar Nueva Revisión
        </h2>
        <form onSubmit={handleAgregar} className="flex gap-3">
          <input
            type="text"
            value={nuevaPregunta}
            onChange={(e) => setNuevaPregunta(e.target.value)}
            placeholder="Ej. ¿Los niveles de aceite son correctos?"
            className="flex-1 rounded-md border-zinc-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={!nuevaPregunta.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>
      </div>

      {/* Lista de preguntas */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-zinc-500 animate-pulse font-medium">Cargando checklist...</div>
        ) : preguntas.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No hay preguntas configuradas.</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {preguntas.map((item, index) => (
              <li key={item.id_pregunta} className="p-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors">
                <div className="text-zinc-300 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <p className={`text-sm font-medium ${item.activa ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
                    {index + 1}. {item.pregunta}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.activa}
                      onChange={(e) => handleToggleActiva(item.id_pregunta, e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-zinc-500 font-medium">{item.activa ? 'Activa' : 'Inactiva'}</span>
                  </label>

                  <button
                    onClick={() => handleEliminar(item.id_pregunta)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
