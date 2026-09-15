import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cls } from '../ui';
import { Reveal } from '../../lib/motion';
import { useContacto } from '../../lib/contacto';
import LogoRed from '../../components/LogoRed';

export default function FooterSection() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  // Los canales se cargan desde Admin › Configuración › Redes; si no hay ninguno, el pie
  // queda como estaba. Cada uno dice a dónde lleva, para que el visitante no tenga que adivinar.
  const canales = useContacto();

  const goPlanes = () =>
    document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="border-t border-white/10 py-14 px-5 bg-[#070708]">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          {/* Fila superior */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Luxury Garage" className="w-8 h-8 object-contain" />
              <span className="brand-wordmark text-lg">LUXURY GARAGE</span>
            </div>

            <nav className="flex items-center gap-3">
              <button
                onClick={goPlanes}
                className={`${cls.btnGhost} px-6 py-2.5 text-xs`}
              >
                Planes
              </button>
              <button
                onClick={() => navigate('/login')}
                className={`${cls.btnGold} px-6 py-2.5 text-xs`}
              >
                Iniciar sesión
              </button>
            </nav>
          </div>

          {/* Contacto */}
          {canales.length > 0 && (
            <div className="mt-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-4">Hablemos</p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                {canales.map((c) => (
                  <a
                    key={c.id}
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] pl-2.5 pr-5 py-2.5 transition-colors hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
                  >
                    <LogoRed red={c.id} estilo="tile" size={42} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{c.titulo}</span>
                      <span className="block text-sm text-slate-400 tabular-nums group-hover:text-slate-300 transition-colors">{c.detalle}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Línea divisoria */}
          <div className="my-8 h-px w-full bg-white/10" />

          {/* Fila inferior */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-slate-400 max-w-md">
              El club de lavado y detailing premium del Paraguay. Tu auto siempre impecable.
            </p>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck size={16} className="text-secondary" />
              © {year} Luxury Garage
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
