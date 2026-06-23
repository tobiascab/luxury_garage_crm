import { forwardRef, useState, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

/**
 * FormField — campo de formulario consistente para el panel admin.
 *
 * Renderiza label + control (input | select | textarea) + texto de ayuda/error.
 * Sobrio: neutros slate, acento primary en foco, soporte dark mode.
 *
 * Props comunes:
 *  - label        string   — etiqueta visible arriba del control
 *  - name         string   — name/id del control (para htmlFor)
 *  - as           'input' | 'select' | 'textarea'  (default 'input')
 *  - type         string   — tipo del input (text, email, number, password, date...) cuando as='input'
 *  - value        any
 *  - onChange     fn(e)    — recibe el evento nativo
 *  - error        string   — mensaje de error (pinta el borde rojo y lo muestra abajo)
 *  - hint         string   — texto de ayuda gris (se oculta si hay error)
 *  - required     boolean  — muestra asterisco
 *  - disabled     boolean
 *  - placeholder  string
 *  - prefix       node     — adorno a la izquierda (ej: "₲") cuando as='input'
 *  - rows         number   — alto del textarea (default 3)
 *  - children     nodes    — <option> cuando as='select'
 *  - className    string   — clases extra para el contenedor
 *  - ...rest               — se pasan al control
 *
 * Uso:
 *  <FormField label="Nombre" name="name" value={form.name} required
 *    onChange={(e) => setForm({ ...form, name: e.target.value })}
 *    error={errors.name} />
 *
 *  <FormField as="select" label="Estado" name="status" value={form.status} onChange={...}>
 *    <option value="ACTIVE">Activo</option>
 *  </FormField>
 */
const baseControl =
  'w-full bg-slate-50 dark:bg-slate-800/60 border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

const FormField = forwardRef(function FormField(
  {
    label,
    name,
    as = 'input',
    type = 'text',
    value,
    onChange,
    error,
    hint,
    required = false,
    disabled = false,
    placeholder,
    prefix,
    rows = 3,
    children,
    className = '',
    ...rest
  },
  ref
) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const innerRef = useRef(null);
  // Soporta ref reenviada (callback u objeto) + ref interno para los steppers.
  const setRefs = useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  const handleFocus = (e) => {
    setFocused(true);
    rest.onFocus?.(e);
  };
  const handleBlur = (e) => {
    setFocused(false);
    rest.onBlur?.(e);
  };
  // No reenviar onFocus/onBlur dos veces.
  const { onFocus: _of, onBlur: _ob, ...restProps } = rest;

  // Borde: rojo si hay error; primary + ring suave en foco; gris en reposo/hover.
  const borderState = error
    ? `border-rose-400 dark:border-rose-500 ${focused ? 'ring-2 ring-rose-500/15' : ''}`
    : focused
    ? 'border-primary ring-2 ring-primary/15'
    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20';

  const isNumber = as === 'input' && type === 'number';
  // Los number con steppers necesitan espacio simétrico a ambos lados.
  const numberPad = isNumber ? 'text-center px-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none' : '';

  const controlClass = `${baseControl} ${borderState} ${prefix ? 'pl-9' : ''} ${
    as === 'select' ? 'appearance-none cursor-pointer pr-9' : ''
  } ${numberPad}`;

  // Steppers de number: reutilizan el mismo onChange con un evento sintético.
  const step = rest.step != null ? Number(rest.step) : 1;
  const min = rest.min != null ? Number(rest.min) : undefined;
  const max = rest.max != null ? Number(rest.max) : undefined;

  const nudge = (dir) => {
    if (disabled) return;
    const current = value === '' || value == null ? 0 : Number(value);
    const base = Number.isFinite(current) ? current : 0;
    let next = base + dir * (Number.isFinite(step) && step !== 0 ? step : 1);
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    // Redondeo para evitar coletazos de coma flotante (0.1 + 0.2…).
    next = Math.round(next * 1e6) / 1e6;
    onChange?.({ target: { name, value: String(next) } });
    innerRef.current?.focus();
  };

  const stepperDisabled = (dir) => {
    if (disabled) return true;
    const current = value === '' || value == null ? 0 : Number(value);
    if (!Number.isFinite(current)) return false;
    if (dir < 0 && min != null) return current <= min;
    if (dir > 0 && max != null) return current >= max;
    return false;
  };

  const tap = reduceMotion ? undefined : { scale: 0.9 };

  let control;
  if (as === 'textarea') {
    control = (
      <textarea
        ref={setRefs}
        id={name}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={`${controlClass} resize-y`}
        {...restProps}
      />
    );
  } else if (as === 'select') {
    control = (
      <div className="relative">
        <select
          ref={setRefs}
          id={name}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          className={controlClass}
          {...restProps}
        >
          {children}
        </select>
        <motion.svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          animate={{
            rotate: focused ? 180 : 0,
            color: focused ? 'var(--color-primary)' : '#94a3b8',
          }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24 }}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </motion.svg>
      </div>
    );
  } else if (isNumber) {
    control = (
      <div className="relative">
        <motion.button
          type="button"
          tabIndex={-1}
          aria-label="Disminuir"
          onClick={() => nudge(-1)}
          disabled={stepperDisabled(-1)}
          whileTap={tap}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Minus size={15} />
        </motion.button>
        <input
          ref={setRefs}
          id={name}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={controlClass}
          {...restProps}
        />
        <motion.button
          type="button"
          tabIndex={-1}
          aria-label="Aumentar"
          onClick={() => nudge(1)}
          disabled={stepperDisabled(1)}
          whileTap={tap}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Plus size={15} />
        </motion.button>
      </div>
    );
  } else {
    control = (
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {prefix}
          </span>
        )}
        <input
          ref={setRefs}
          id={name}
          name={name}
          type={type}
          value={value ?? ''}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`${controlClass} ${type === 'time' ? 'pr-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert' : ''}`}
          {...restProps}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={name}
          className={`text-xs font-semibold transition-colors duration-200 ${
            error
              ? 'text-rose-500'
              : focused
              ? 'text-primary'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <p className="text-xs text-rose-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
});

export default FormField;
