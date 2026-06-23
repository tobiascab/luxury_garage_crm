import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import 'react-day-picker/style.css';
import './datepicker.css';

/*
 * Fechador premium del sistema (react-day-picker v10 + locale ES).
 * - DatePicker:       selección de un día. value/onChange en 'YYYY-MM-DD' → drop-in de <input type="date">.
 * - DateRangePicker:  selección de rango con presets. from/to en 'YYYY-MM-DD'.
 * Dropdowns de mes y año, calendario en español, tema de marca (#0040e0) y modo oscuro.
 */

const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => (d instanceof Date && !isNaN(d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
const fromYMD = (s) => {
  if (!s) return undefined;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt) ? undefined : dt;
};
const fmtEs = (d) => (d ? d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const NOW_YEAR = new Date().getFullYear();
const START_MONTH = new Date(NOW_YEAR - 8, 0);
const END_MONTH = new Date(NOW_YEAR + 2, 11);

// Cierra el popover al hacer click fuera o presionar Escape.
function useDismiss(ref, onClose) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, onClose]);
}

const dayPickerCommon = {
  locale: es,
  captionLayout: 'dropdown',
  startMonth: START_MONTH,
  endMonth: END_MONTH,
  showOutsideDays: true,
};

// ── Selección de un solo día ────────────────────────────────────────────────
export function DatePicker({ value, onChange, placeholder = 'Seleccionar fecha', min, max, disabled, align = 'left', className = '', id }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false));

  const selected = fromYMD(value);
  const matchers = [min && { before: fromYMD(min) }, max && { after: fromYMD(max) }].filter(Boolean);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        data-open={open}
        onClick={() => setOpen((o) => !o)}
        className={`lg-dp-trigger ${className}`}
      >
        <span className={selected ? '' : 'lg-dp-placeholder'}>{selected ? fmtEs(selected) : placeholder}</span>
        <CalendarIcon size={16} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="lg-dp-pop" style={align === 'right' ? { right: 0 } : { left: 0 }}>
          <div>
            <DayPicker
              {...dayPickerCommon}
              mode="single"
              selected={selected}
              defaultMonth={selected || new Date()}
              disabled={matchers.length ? matchers : undefined}
              onSelect={(d) => { onChange(toYMD(d)); if (d) setOpen(false); }}
            />
            <div className="lg-dp-footer">
              <button type="button" className="lg-dp-link muted" onClick={() => { onChange(''); setOpen(false); }}>Borrar</button>
              <button type="button" className="lg-dp-link" onClick={() => { onChange(toYMD(new Date())); setOpen(false); }}>Hoy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RANGE_PRESETS = [
  { key: 'today', label: 'Hoy', range: () => { const n = startOfDay(new Date()); return { from: n, to: n }; } },
  { key: 'yesterday', label: 'Ayer', range: () => { const n = startOfDay(new Date(Date.now() - 864e5)); return { from: n, to: n }; } },
  { key: '7d', label: 'Últimos 7 días', range: () => ({ from: startOfDay(new Date(Date.now() - 6 * 864e5)), to: startOfDay(new Date()) }) },
  { key: '30d', label: 'Últimos 30 días', range: () => ({ from: startOfDay(new Date(Date.now() - 29 * 864e5)), to: startOfDay(new Date()) }) },
  { key: 'month', label: 'Este mes', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: startOfDay(n) }; } },
  { key: 'lastmonth', label: 'Mes pasado', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 1, 1), to: new Date(n.getFullYear(), n.getMonth(), 0) }; } },
  { key: 'year', label: 'Este año', range: () => { const n = new Date(); return { from: new Date(n.getFullYear(), 0, 1), to: startOfDay(n) }; } },
];

const sameYMD = (a, b) => toYMD(a) === toYMD(b);

// ── Selección de rango con presets ──────────────────────────────────────────
export function DateRangePicker({ from, to, onChange, presets = true, numberOfMonths = 2, align = 'left', placeholder = 'Seleccionar rango', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, () => setOpen(false));

  const fromD = fromYMD(from);
  const toD = fromYMD(to);
  const selected = fromD ? { from: fromD, to: toD } : undefined;

  const label = fromD && toD
    ? `${fmtEs(fromD)} — ${fmtEs(toD)}`
    : fromD
      ? fmtEs(fromD)
      : placeholder;

  const activePreset = RANGE_PRESETS.find((p) => {
    const r = p.range();
    return fromD && toD && sameYMD(r.from, fromD) && sameYMD(r.to, toD);
  })?.key;

  return (
    <div className="relative" ref={ref}>
      <button type="button" data-open={open} onClick={() => setOpen((o) => !o)} className={`lg-dp-trigger ${className}`}>
        <span className="inline-flex items-center gap-2 truncate">
          <CalendarIcon size={16} className="text-slate-400 shrink-0" />
          <span className={fromD ? 'truncate' : 'lg-dp-placeholder truncate'}>{label}</span>
        </span>
        <ChevronDown size={15} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="lg-dp-pop" style={align === 'right' ? { right: 0 } : { left: 0 }}>
          {presets && (
            <div className="lg-dp-presets">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className="lg-dp-preset"
                  data-active={activePreset === p.key}
                  onClick={() => { const r = p.range(); onChange({ from: toYMD(r.from), to: toYMD(r.to) }); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div>
            <DayPicker
              {...dayPickerCommon}
              mode="range"
              numberOfMonths={numberOfMonths}
              selected={selected}
              defaultMonth={fromD || new Date()}
              onSelect={(r) => onChange({ from: toYMD(r?.from), to: toYMD(r?.to) })}
            />
            <div className="lg-dp-footer">
              <button type="button" className="lg-dp-link muted" onClick={() => { onChange({ from: '', to: '' }); }}>Borrar</button>
              <button type="button" className="lg-dp-link" onClick={() => setOpen(false)}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
