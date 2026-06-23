import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cls } from '../ui';
import { Reveal } from '../../lib/motion';

export default function FooterSection() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

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
