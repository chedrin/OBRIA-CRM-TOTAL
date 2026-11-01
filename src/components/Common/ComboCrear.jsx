import React, { useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Campo de texto con lista desplegable de sugerencias y, siempre al final, las acciones
 * "Crear nuevo…". Sirve donde el valor es un nombre libre (proveedor de un gasto) pero conviene
 * elegirlo de los registros que ya existen o darlo de alta sin salir del formulario.
 *
 * sugerencias: [{ key, valor, detalle?, ...lo que necesite onElegir }]
 * acciones:    [{ key, label, onClick }]
 */
export default function ComboCrear({ value, onChange, sugerencias = [], onElegir, acciones = [], className = '', placeholder, required, autoFocus }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const listaId = useId();

  const filtradas = useMemo(() => {
    const q = norm(value);
    const lista = q ? sugerencias.filter((s) => norm(`${s.valor} ${s.detalle || ''}`).includes(q)) : sugerencias;
    return lista.slice(0, 50);
  }, [value, sugerencias]);

  const items = [
    ...filtradas.map((s) => ({ tipo: 'sug', s })),
    ...acciones.map((a) => ({ tipo: 'accion', a }))
  ];

  const elegir = (item) => {
    setAbierto(false);
    setActivo(-1);
    if (item.tipo === 'accion') item.a.onClick(value);
    else if (onElegir) onElegir(item.s);
    else onChange(item.s.valor);
  };

  const onKeyDown = (e) => {
    if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setAbierto(true); e.preventDefault(); return; }
    if (!abierto) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && activo >= 0 && items[activo]) { e.preventDefault(); elegir(items[activo]); }
    else if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); } // no cierra el modal de debajo
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); setActivo(-1); }}
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={className}
      />
      {abierto && items.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl text-sm overflow-hidden">
          <ul id={listaId} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {items.map((it, i) => (
              <li key={it.tipo === 'sug' ? `s-${it.s.key ?? it.s.valor}` : `a-${it.a.key}`} role="option" aria-selected={i === activo}
                className={it.tipo === 'accion' ? 'sticky bottom-0 bg-slate-900' : ''}
                style={it.tipo === 'accion' ? { bottom: `${(items.length - 1 - i) * 2.25}rem` } : undefined}>
                <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); elegir(it); }}
                  className={`w-full text-left px-3 h-9 flex items-center gap-2 ${i === activo ? 'bg-slate-800' : 'hover:bg-slate-800'} ${it.tipo === 'accion' && i === filtradas.length ? 'border-t border-slate-700' : ''}`}>
                  {it.tipo === 'sug' ? (
                    <>
                      <span className="text-white truncate">{it.s.valor}</span>
                      {it.s.detalle && <span className="ml-auto text-[11px] text-slate-500 shrink-0">{it.s.detalle}</span>}
                    </>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" />{it.a.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
