import { useEffect, useState } from 'react';
import { ShieldCheck, Instagram, Facebook, MessageCircle, Music2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cls } from '../ui';
import { Reveal } from '../../lib/motion';
import api from '../../../services/api';

// Las redes se cargan desde Admin › Configuración › Redes. Acá sólo se muestran las que
// existan: un ícono que no lleva a ningún lado es peor que no tener el ícono.
const REDES = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'facebook', label: 'Facebook', Icon: Facebook },
  { id: 'tiktok', label: 'TikTok', Icon: Music2 },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
];

export default function FooterSection() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [redes, setRedes] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get('/settings/redes')
      .then((r) => setRedes(r.data?.data || {}))
      .catch(() => { /* sin redes, el pie sigue igual de válido */ });
  }, []);

  const visibles = REDES.filter((r) => redes[r.id]);

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
            <div className="max-w-md">
              <p className="text-sm text-slate-400">
                El club de lavado y detailing premium del Paraguay. Tu auto siempre impecable.
              </p>
              {visibles.length > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  {visibles.map(({ id, label, Icon }) => (
                    <a
                      key={id}
                      href={redes[id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      title={label}
                      className="w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:text-secondary hover:border-secondary/40 transition-colors"
                    >
                      <Icon size={17} />
                    </a>
                  ))}
                </div>
              )}
            </div>
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
