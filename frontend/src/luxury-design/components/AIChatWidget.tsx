/**
 * AIChatWidget — Asistente de IA para la web app del cliente logueado.
 *
 * FAB flotante abajo-derecha (por encima del bottom-nav) que abre un panel de
 * chat. Saca el contexto del usuario de useLuxuryUser() para saludar por nombre
 * y conversa contra POST /api/chat/ai.
 *
 * Estética: dark / dorado fintech, animaciones con el sistema compartido
 * (lib/motion). Respeta prefers-reduced-motion. NO requiere props.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence, springSnappy, springPop, easeOutFast, useReduce } from '../lib/motion';
import api from '../../services/api';
import { useLuxuryUser } from '../context/LuxuryUserContext';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const uid = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Primer nombre, con fallback. fullUser puede traer name / firstName / fullName.
const firstNameOf = (u: any): string => {
    const raw = (u?.firstName || u?.name || u?.fullName || '').toString().trim();
    return raw ? raw.split(' ')[0] : '';
};

// Etiqueta del vehículo principal (marca + modelo) si existe, para el saludo.
const vehicleLabelOf = (u: any): string => {
    const v = Array.isArray(u?.vehicles) ? u.vehicles[0] : u?.vehicle;
    if (!v) return '';
    const parts = [v.brand || v.make, v.model].filter(Boolean);
    const label = parts.join(' ').trim();
    return label || (v.plate ? `vehículo (${v.plate})` : '');
};

export default function AIChatWidget() {
    const { fullUser } = useLuxuryUser();
    const reduce = useReduce();

    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const conversationId = useRef<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const firstName = firstNameOf(fullUser);
    const vehicleLabel = vehicleLabelOf(fullUser);

    // Saludo inicial contextual (no se persiste, se re-deriva del usuario).
    const greeting = useMemo(() => {
        const hi = firstName ? `Hola ${firstName}` : 'Hola';
        const veh = vehicleLabel ? ` tu ${vehicleLabel},` : '';
        return `${hi}, soy el asistente de Luxury Garage. Puedo ayudarte con${veh} tu membresía o agendar un lavado.`;
    }, [firstName, vehicleLabel]);

    // Inyecta el saludo como primer mensaje cuando se abre por primera vez.
    useEffect(() => {
        if (open && messages.length === 0) {
            setMessages([{ id: 'greeting', role: 'assistant', content: greeting }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Auto-scroll al fondo en cada mensaje nuevo / estado de carga.
    useEffect(() => {
        if (!open) return;
        const el = scrollRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    }, [messages, sending, open, reduce]);

    // Foco al input al abrir.
    useEffect(() => {
        if (open && !reduce) {
            const t = setTimeout(() => inputRef.current?.focus(), 220);
            return () => clearTimeout(t);
        }
    }, [open, reduce]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const text = input.trim();
        if (!text || sending) return;

        setError(null);
        const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSending(true);

        try {
            const res = await api.post('/chat/ai', {
                message: text,
                conversationId: conversationId.current,
            });
            const data = res.data?.data ?? res.data ?? {};
            // El backend puede devolver { reply } | { message } | { content }, y un id de conversación.
            const reply = (data.reply ?? data.message ?? data.content ?? '').toString().trim();
            if (data.conversationId) conversationId.current = data.conversationId;

            setMessages(prev => [
                ...prev,
                {
                    id: uid(),
                    role: 'assistant',
                    content: reply || 'No pude generar una respuesta. ¿Podés reformular tu pregunta?',
                },
            ]);
        } catch (err) {
            console.error('AIChatWidget — error en /chat/ai', err);
            setError('No pudimos conectar con el asistente. Intentá de nuevo en un momento.');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* ── FAB ── */}
            <motion.button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Cerrar asistente' : 'Abrir asistente de Luxury Garage'}
                whileTap={reduce ? undefined : { scale: 0.9 }}
                transition={springSnappy}
                // z-40: por encima del contenido, por debajo de header/nav (z-50).
                // bottom-24: deja libre el bottom-nav (que vive en bottom-0, ~88px de alto).
                className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_-6px_rgba(202,164,84,0.55)] bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-slate-900 ring-1 ring-amber-200/60"
            >
                <AnimatePresence mode="wait" initial={false}>
                    {open ? (
                        <motion.span
                            key="close"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
                            animate={reduce ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
                            transition={springPop}
                        >
                            <X size={24} strokeWidth={2.6} />
                        </motion.span>
                    ) : (
                        <motion.span
                            key="open"
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                            transition={springPop}
                        >
                            <Sparkles size={24} strokeWidth={2.4} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* ── Panel de chat ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="ai-chat-panel"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
                        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96, transition: easeOutFast }}
                        transition={springSnappy}
                        style={{ transformOrigin: 'bottom right' }}
                        role="dialog"
                        aria-label="Asistente de Luxury Garage"
                        className="fixed bottom-40 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm h-[28rem] max-h-[70vh] flex flex-col rounded-[1.75rem] overflow-hidden border border-amber-400/20 bg-[#0f172a] shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-[#1e293b]/80 backdrop-blur-xl">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-300 to-amber-600 text-slate-900 shrink-0">
                                <Bot size={18} strokeWidth={2.4} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-sm text-white leading-tight">Asistente Luxury</p>
                                <p className="text-[10px] text-amber-300/80 font-semibold tracking-wide uppercase">En línea</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar"
                                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mensajes */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
                        >
                            {messages.map((m, i) => (
                                <motion.div
                                    key={m.id}
                                    initial={reduce ? undefined : { opacity: 0, y: 8 }}
                                    animate={reduce ? undefined : { opacity: 1, y: 0 }}
                                    transition={reduce ? undefined : { delay: Math.min(i * 0.02, 0.1) }}
                                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                                            m.role === 'user'
                                                ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 font-medium'
                                                : 'rounded-2xl rounded-bl-md bg-slate-800/80 text-slate-100 border border-slate-700/60'
                                        }`}
                                    >
                                        {m.content}
                                    </div>
                                </motion.div>
                            ))}

                            {/* Indicador de carga ("escribiendo…") */}
                            {sending && (
                                <div className="flex justify-start">
                                    <div className="rounded-2xl rounded-bl-md bg-slate-800/80 border border-slate-700/60 px-4 py-3 flex items-center gap-1.5">
                                        {[0, 1, 2].map(d => (
                                            <motion.span
                                                key={d}
                                                className="w-1.5 h-1.5 rounded-full bg-amber-400"
                                                animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                                transition={reduce ? undefined : { duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="flex justify-start">
                                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-[12px] text-red-300 leading-relaxed">
                                        {error}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Composer */}
                        <form
                            onSubmit={handleSend}
                            className="flex items-end gap-2 px-3 py-3 border-t border-slate-800 bg-[#1e293b]/60"
                        >
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Escribí tu mensaje…"
                                disabled={sending}
                                aria-label="Mensaje"
                                className="flex-1 min-w-0 bg-slate-800/80 border border-slate-700/60 rounded-full px-4 py-2.5 text-[13px] text-white placeholder:text-slate-500 outline-none focus:border-amber-400/50 transition-colors disabled:opacity-60"
                            />
                            <motion.button
                                type="submit"
                                disabled={sending || !input.trim()}
                                aria-label="Enviar"
                                whileTap={reduce ? undefined : { scale: 0.9 }}
                                transition={springSnappy}
                                className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-300 to-amber-600 text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                            >
                                <Send size={17} strokeWidth={2.4} />
                            </motion.button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
