import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  MessageSquare, Search, RefreshCcw, Send, Sparkles,
  MessageCircle, Smartphone, Mail, ChevronLeft, Loader2,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';

// ── Metadatos de canal ────────────────────────────────────────────────────
// Las claves cubren las variantes con las que el backend puede mandar el canal.
const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle, tile: 'admin-itile-emerald', chip: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  sms:      { label: 'SMS',      Icon: Smartphone,    tile: 'admin-itile-sky',     chip: 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  email:    { label: 'Email',    Icon: Mail,          tile: 'admin-itile-violet',  chip: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
};

const channelMeta = (ch) =>
  CHANNEL_META[String(ch || '').toLowerCase()] || {
    label: ch || 'Canal',
    Icon: MessageSquare,
    tile: 'admin-itile-indigo',
    chip: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300',
  };

const CHANNEL_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

const POLL_MS = 15000;

// ── Helpers de presentación ────────────────────────────────────────────────
const convName = (c) =>
  c?.customerName || c?.name ||
  [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim() ||
  c?.customer?.name || c?.phone || c?.email || 'Cliente';

const initials = (name) =>
  String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const fmtTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (date.toDateString() === yest.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
};

const fmtFullTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const isOutbound = (m) => {
  const dir = String(m?.direction || '').toLowerCase();
  if (dir) return dir === 'outbound' || dir === 'out' || dir === 'sent';
  return m?.outbound === true || m?.fromMe === true;
};

const isFromAI = (m) =>
  m?.isAI === true || m?.fromAI === true || m?.ai === true ||
  String(m?.sender || m?.author || '').toLowerCase() === 'ai' ||
  String(m?.source || '').toLowerCase() === 'ai' ||
  String(m?.sentBy || '').toLowerCase() === 'ai' ||
  String(m?.sentBy || '').toLowerCase() === 'arizar';

const msgBody = (m) => m?.body ?? m?.text ?? m?.content ?? m?.message ?? '';

export default function ChatInbox() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };

  const [searchFocused, setSearchFocused] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const threadEndRef = useRef(null);
  const threadScrollRef = useRef(null);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  // ── Carga de la lista ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const res = await api.get('/chat/conversations', { _noCache: true });
      setConversations(res.data?.data || res.data || []);
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'No se pudieron cargar las conversaciones');
    } finally {
      if (!silent) setLoadingList(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Polling suave de la lista
  useEffect(() => {
    const id = setInterval(() => loadConversations(true), POLL_MS);
    return () => clearInterval(id);
  }, [loadConversations]);

  const refresh = () => { setRefreshing(true); loadConversations(); };

  // ── Carga del hilo + marcar como leído ────────────────────────────────────
  const loadThread = useCallback(async (convId, silent = false) => {
    if (!silent) { setLoadingThread(true); setMessages([]); }
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`, { _noCache: true });
      // Solo aplicar si la conversación sigue seleccionada
      if (selectedIdRef.current === convId) {
        setMessages(res.data?.data || res.data || []);
      }
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'No se pudo cargar la conversación');
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, []);

  const markRead = useCallback(async (convId) => {
    try {
      await api.put(`/chat/conversations/${convId}/read`);
      setConversations(prev => prev.map(c =>
        (c.id === convId ? { ...c, unread: 0, unreadCount: 0 } : c)));
    } catch { /* no es crítico para la UX */ }
  }, []);

  const openConversation = useCallback((conv) => {
    setSelectedId(conv.id);
    setDraft('');
    loadThread(conv.id);
    const unread = conv.unread ?? conv.unreadCount ?? 0;
    if (unread > 0) markRead(conv.id);
  }, [loadThread, markRead]);

  // Polling del hilo abierto
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => loadThread(selectedId, true), POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, loadThread]);

  // ── Auto-scroll al último mensaje ─────────────────────────────────────────
  useEffect(() => {
    if (!threadEndRef.current) return;
    threadEndRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [messages, reduceMotion]);

  // ── Enviar respuesta ──────────────────────────────────────────────────────
  const selectedConv = useMemo(
    () => conversations.find(c => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  const handleSend = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || !selectedId || sending) return;
    setSending(true);
    const channel = selectedConv?.channel || 'whatsapp';
    // Mensaje optimista
    const optimistic = {
      id: `tmp-${Date.now()}`,
      body,
      direction: 'outbound',
      channel,
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setDraft('');
    try {
      const res = await api.post(`/chat/conversations/${selectedId}/messages`, { body, channel });
      const saved = res.data?.data || res.data;
      setMessages(prev => prev.map(m =>
        (m.id === optimistic.id ? { ...optimistic, ...(saved || {}), _pending: false } : m)));
      // Refrescar lista (último mensaje / orden)
      loadConversations(true);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setDraft(body);
      toast.error(err.response?.data?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  // ── Filtrado de la lista (cliente) ────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(c => {
      if (channelFilter && String(c.channel || '').toLowerCase() !== channelFilter) return false;
      if (!q) return true;
      const hay = `${convName(c)} ${c.phone || ''} ${c.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, search, channelFilter]);

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread ?? c.unreadCount ?? 0), 0),
    [conversations]
  );

  return (
    <div className="page-content pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-indigo w-11 h-11 rounded-2xl">
            <MessageSquare size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chat Clientes</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalUnread > 0
                ? `${totalUnread} mensaje${totalUnread === 1 ? '' : 's'} sin leer`
                : 'Buzón de conversaciones'}
            </p>
          </div>
        </div>
        <motion.button
          whileTap={tapSm}
          onClick={refresh}
          disabled={refreshing}
          title="Recargar"
          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors disabled:opacity-60"
        >
          <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      {/* Layout 2 columnas */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[360px_1fr] h-[calc(100vh-220px)] min-h-[480px]">

        {/* ── Columna izquierda: lista ── */}
        <aside className={`flex flex-col border-r border-slate-100 dark:border-white/5 min-h-0 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
          {/* Buscador + filtros */}
          <div className="p-4 border-b border-slate-100 dark:border-white/5 space-y-3">
            <div className="relative">
              <Search size={17} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-slate-400'}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Buscar cliente…"
                className={`w-full bg-white dark:bg-slate-900 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
                  searchFocused
                    ? 'border-primary ring-2 ring-primary/15'
                    : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
              />
            </div>
            <div className="flex items-center gap-1.5">
              {CHANNEL_FILTERS.map(f => {
                const active = channelFilter === f.value;
                return (
                  <motion.button
                    key={f.value || 'all'}
                    whileTap={tapSm}
                    onClick={() => setChannelFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {f.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Lista de conversaciones */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            {loadingList ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2 rounded" />
                      <Skeleton className="h-3 w-3/4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10">
                <EmptyState
                  icon="💬"
                  title="Sin conversaciones"
                  message={search || channelFilter
                    ? 'No hay conversaciones que coincidan con el filtro.'
                    : 'Todavía no recibiste mensajes de clientes.'}
                />
              </div>
            ) : (
              <ul>
                {filtered.map((c) => {
                  const meta = channelMeta(c.channel);
                  const Icon = meta.Icon;
                  const name = convName(c);
                  const unread = c.unread ?? c.unreadCount ?? 0;
                  const last = c.lastMessage ?? c.lastMessageBody ?? c.preview ?? c.lastMessage?.body ?? '';
                  const lastText = typeof last === 'object' ? msgBody(last) : last;
                  const when = c.lastMessageAt ?? c.updatedAt ?? c.lastMessage?.createdAt;
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => openConversation(c)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-50 dark:border-white/5 transition-colors ${
                          active
                            ? 'bg-indigo-50/70 dark:bg-indigo-500/10'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs">
                            {initials(name)}
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center ring-2 ring-white dark:ring-slate-900 ${meta.chip}`}>
                            <Icon size={11} />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate ${unread > 0 ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>
                              {name}
                            </p>
                            <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">{fmtTime(when)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className={`text-xs truncate ${unread > 0 ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                              {lastText || 'Sin mensajes'}
                            </p>
                            {unread > 0 && (
                              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Columna derecha: hilo ── */}
        <section className={`flex-col min-h-0 ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="admin-itile admin-itile-indigo w-14 h-14 rounded-2xl mb-4">
                <MessageSquare size={26} className="text-white" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Elegí una conversación</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                Seleccioná un cliente de la lista para ver el historial y responder.
              </p>
            </div>
          ) : (
            <>
              {/* Cabecera del hilo */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center transition-colors shrink-0"
                  title="Volver"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shrink-0">
                  {initials(convName(selectedConv))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{convName(selectedConv)}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedConv.phone || selectedConv.email || '—'}
                  </p>
                </div>
                {(() => {
                  const meta = channelMeta(selectedConv.channel);
                  const Icon = meta.Icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${meta.chip}`}>
                      <Icon size={13} /> {meta.label}
                    </span>
                  );
                })()}
              </div>

              {/* Mensajes */}
              <div ref={threadScrollRef} className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-4 py-5 space-y-3 bg-slate-50/40 dark:bg-white/[0.01]">
                {loadingThread ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                        <Skeleton className={`h-12 rounded-2xl ${i % 2 ? 'w-1/2' : 'w-2/3'}`} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      icon="📨"
                      title="Sin mensajes"
                      message="Esta conversación todavía no tiene mensajes. Escribí el primero abajo."
                    />
                  </div>
                ) : (
                  messages.map((m) => {
                    const out = isOutbound(m);
                    const ai = out && isFromAI(m);
                    const body = msgBody(m);
                    const when = m.createdAt ?? m.timestamp ?? m.sentAt;
                    return (
                      <motion.div
                        key={m.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`flex ${out ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[78%] sm:max-w-[70%] ${out ? 'items-end' : 'items-start'} flex flex-col`}>
                          {ai && (
                            <span className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-semibold uppercase tracking-wide self-end">
                              <Sparkles size={10} /> ARIZAR IA
                            </span>
                          )}
                          <div
                            className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
                              out
                                ? ai
                                  ? 'bg-violet-600 text-white rounded-br-md'
                                  : 'bg-indigo-600 text-white rounded-br-md'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200 dark:border-white/10 rounded-bl-md'
                            } ${m._pending ? 'opacity-70' : ''}`}
                          >
                            {body || <span className="italic opacity-70">(sin texto)</span>}
                          </div>
                          <span className={`text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1 ${out ? 'self-end' : 'self-start'}`}>
                            {m._pending && <Loader2 size={10} className="animate-spin" />}
                            {fmtFullTime(when)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Input de respuesta */}
              <form onSubmit={handleSend} className="border-t border-slate-100 dark:border-white/5 p-3 flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                  }}
                  rows={1}
                  placeholder="Escribí una respuesta…  (Enter para enviar)"
                  className="flex-1 resize-none max-h-32 bg-slate-100 dark:bg-white/5 border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/15 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-all duration-200"
                />
                <motion.button
                  type="submit"
                  whileTap={tap}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Enviar"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </motion.button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
