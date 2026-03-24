import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, MessageSquare, User,
  Calendar, CheckCircle2,
  Reply, MoreVertical, Search,
  Filter, TrendingUp, ThumbsUp,
  MessageCircle, Loader2, ArrowUpRight
} from 'lucide-react';
import api from '../../services/api';

export default function ReviewsAdmin() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/reviews')
      .then(r => setReviews(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escuchando Voz del Cliente...</p>
    </div>
  );

  const avg = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '5.0';

  const filtered = reviews.filter(r =>
    `${r.user?.firstName} ${r.user?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (r.comment && r.comment.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-content pb-12">
      {/* Header */}
      <header className="admin-page-header">
        <div>
          <h1 className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-400/30">
              <Star size={24} fill="white" />
            </div>
            Experiencia de Cliente
          </h1>
          <p>Monitoreo de reputación y retroalimentación de servicios</p>
        </div>
        <div className="admin-search-wrapper w-full md:w-80">
          <Search className="admin-search-icon" size={16} />
          <input
            className="admin-search-input"
            placeholder="Buscar en testimonios..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Rating Summary */}
        <div className="admin-card border-amber-500/10 h-fit bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-900/5">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reputación General</h3>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>

          <div className="flex items-end gap-4 mb-8">
            <span className="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white leading-none">{avg}</span>
            <div className="flex flex-col pb-1">
              <div className="flex text-amber-400 gap-0.5 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill={i < Math.floor(Number(avg)) ? "currentColor" : "none"} />
                ))}
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sobre {reviews.length} Reseñas</span>
            </div>
          </div>

          <div className="space-y-4">
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-4 group cursor-default">
                  <div className="flex items-center gap-1 w-6">
                    <span className="text-[10px] font-black text-slate-400">{star}</span>
                    <Star size={8} className="text-amber-400" fill="currentColor" />
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: star * 0.1 }}
                      className={`h-full rounded-full ${star >= 4 ? 'bg-emerald-500' : star === 3 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-10 p-4 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20">
            <p className="text-[9px] font-black uppercase tracking-widest mb-3 opacity-80">Insight ARIZAR AI</p>
            <p className="text-[10px] font-bold italic leading-relaxed">
              "La atención en 'Detailing Interior' ha mejorado la satisfacción general un 15% este mes."
            </p>
          </div>
        </div>

        {/* Reviews Feed */}
        <div className="lg:col-span-2 space-y-4">
          {filtered.length === 0 ? (
            <div className="admin-card text-center py-20 flex flex-col items-center gap-4 opacity-50">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                <MessageCircle size={32} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">No se encontraron testimonios vinculados</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((r, i) => (
                <motion.div
                  key={r.id}
                  className="admin-card group hover:scale-[1.01] transition-transform"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all transform group-hover:rotate-6">
                        {r.user?.avatar ? (
                          <img src={r.user.avatar} className="w-full h-full rounded-2xl object-cover" />
                        ) : (
                          <User size={20} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase italic tracking-tight leading-none mb-1">
                          {r.user?.firstName} {r.user?.lastName}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-primary uppercase tracking-widest">Socio VIP</span>
                          <div className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{r.serviceRecord?.service?.name || 'Servicio Premium'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="flex text-amber-400 gap-0.5 mb-1.5 p-1 bg-amber-400/5 rounded-lg border border-amber-400/10">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} fill={i < r.rating ? "currentColor" : "none"} />
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                        <Calendar size={10} />
                        {new Date(r.createdAt || Date.now()).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  <div className="relative pl-12">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100 dark:bg-white/5" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-relaxed italic mb-4">
                      "{r.comment || 'Experiencia sin comentarios'}"
                    </p>

                    {r.adminResponse ? (
                      <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 relative">
                        <div className="absolute -top-2 left-6 px-2 bg-slate-50 dark:bg-slate-900 text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                          <Reply size={10} className="rotate-180" /> Respuesta Oficial
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed italic">
                          {r.adminResponse}
                        </p>
                      </div>
                    ) : (
                      <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary hover:translate-x-1 transition-transform bg-primary/5 px-4 py-2 rounded-xl mt-2 border border-primary/20">
                        Enviar Respuesta <ArrowUpRight size={10} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
