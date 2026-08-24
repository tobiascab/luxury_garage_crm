import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check, X, ChevronDown } from 'lucide-react';
import { VEHICULOS, MARCAS } from '../../data/vehiculos';
import { motion, AnimatePresence } from '../lib/motion';

/**
 * Selector de marca y modelo con buscador.
 *
 * Se escribía a mano y entraban datos sucios ("toyot", "COROLA", "corolla xei 2015"),
 * que después no sirven para agrupar ni buscar. Acá se escribe para filtrar y se elige
 * de la lista.
 *
 * Igual se permite cargar algo que no esté en el catálogo: son 2.223 modelos, pero en
 * Paraguay entra de todo y no puede quedar nadie sin poder registrar su auto.
 */

/** Compara sin distinguir mayúsculas ni tildes: "citroen" encuentra "Citroën". */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

interface Props {
  marca: string;
  modelo: string;
  onChange: (v: { marca: string; modelo: string }) => void;
}

export default function SelectorVehiculo({ marca, modelo, onChange }: Props) {
  const [abierto, setAbierto] = useState<null | 'marca' | 'modelo'>(null);
  const [busqueda, setBusqueda] = useState('');
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => { if (abierto) { setBusqueda(''); setTimeout(() => buscador.current?.focus(), 60); } }, [abierto]);

  const modelosDeLaMarca = useMemo(() => (marca && VEHICULOS[marca]) || [], [marca]);

  const opciones = useMemo(() => {
    const lista = abierto === 'marca' ? MARCAS : modelosDeLaMarca;
    const q = normalizar(busqueda);
    if (!q) return lista;
    // Primero los que empiezan con lo escrito; después los que lo contienen.
    const empiezan = lista.filter((o) => normalizar(o).startsWith(q));
    const contienen = lista.filter((o) => !normalizar(o).startsWith(q) && normalizar(o).includes(q));
    return [...empiezan, ...contienen];
  }, [abierto, busqueda, modelosDeLaMarca]);

  const elegir = (valor: string) => {
    if (abierto === 'marca') {
      // Cambiar de marca invalida el modelo anterior.
      onChange({ marca: valor, modelo: marca === valor ? modelo : '' });
      setAbierto(valor && VEHICULOS[valor]?.length ? 'modelo' : null);
    } else {
      onChange({ marca, modelo: valor });
      setAbierto(null);
    }
  };

  /** Permite guardar algo que no está en la lista. */
  const usarLoEscrito = () => {
    const v = busqueda.trim();
    if (!v) return;
    elegir(v);
  };

  return (
    <div className="space-y-4">
      <Disparador
        label="Marca"
        valor={marca}
        placeholder="Elegí la marca"
        onClick={() => setAbierto('marca')}
      />
      <Disparador
        label="Modelo"
        valor={modelo}
        placeholder={marca ? 'Elegí el modelo' : 'Primero elegí la marca'}
        deshabilitado={!marca}
        onClick={() => marca && setAbierto('modelo')}
      />

      <AnimatePresence>
        {abierto && (
          <motion.div
            className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAbierto(null)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[70vh] overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-black text-slate-900 dark:text-white">
                    {abierto === 'marca' ? 'Elegí la marca' : `Modelo de ${marca}`}
                  </p>
                  <button type="button" onClick={() => setAbierto(null)} aria-label="Cerrar"
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X size={18} />
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={buscador}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); opciones.length ? elegir(opciones[0]) : usarLoEscrito(); } }}
                    placeholder={abierto === 'marca' ? 'Buscar marca…' : 'Buscar modelo…'}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[16px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain p-2">
                {opciones.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">No encontramos «{busqueda}»</p>
                    <button
                      type="button"
                      onClick={usarLoEscrito}
                      className="mt-3 px-4 h-11 rounded-xl bg-primary dark:bg-blue-500 text-white text-sm font-bold"
                    >
                      Usar «{busqueda.trim()}» igual
                    </button>
                  </div>
                ) : (
                  opciones.map((o) => {
                    const elegido = abierto === 'marca' ? o === marca : o === modelo;
                    return (
                      <button
                        type="button"
                        key={o}
                        onClick={() => elegir(o)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-left transition-colors ${elegido
                          ? 'bg-primary/10 dark:bg-blue-500/15 text-primary dark:text-blue-400 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <span className="text-[15px]">{o}</span>
                        {elegido && <Check size={17} className="shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Disparador({ label, valor, placeholder, onClick, deshabilitado }: {
  label: string; valor: string; placeholder: string; onClick: () => void; deshabilitado?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5 px-1">{label}</label>
      <button
        type="button"
        onClick={onClick}
        disabled={deshabilitado}
        className={`w-full h-14 px-4 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all ${deshabilitado
          ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 cursor-not-allowed'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary/40'}`}
      >
        <span className={`text-[16px] truncate ${valor ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
          {valor || placeholder}
        </span>
        <ChevronDown size={18} className="text-slate-400 shrink-0" />
      </button>
    </div>
  );
}
