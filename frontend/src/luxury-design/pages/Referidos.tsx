import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Copy, CheckCircle2, Users, Wallet, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { API_URL } from '../config';
import {
    motion,
    AnimatePresence,
    Reveal,
    StaggerList,
    StaggerItem,
    AnimatedNumber,
    Skeleton,
    Pressable,
    popIn,
    scaleIn,
    springPop,
    useReduce,
} from '../lib/motion';

interface ReferidosProps {
    user: any;
}

export default function Referidos({ user }: ReferidosProps) {
    const [copied, setCopied] = useState(false);
    const [referidos, setReferidos] = useState<any[]>([]);
    const [stats, setStats] = useState({ total: 0, registered: 0, purchased: 0 });
    const [loading, setLoading] = useState(true);
    const reduce = useReduce();

    // Dynamic code using real user data
    const firstName = (user?.name ?? 'USER').split(' ')[0].toUpperCase();
    const userId = user?.id ?? '0';
    const referralCode = `LUXURY-${firstName}${userId}`;
    const appBaseUrl = API_URL
        ? API_URL.replace(/\/api\/?$/, '')
        : window.location.origin;
    const referralLink = `${appBaseUrl}/join?ref=${referralCode}`;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [refRes, statsRes] = await Promise.all([
                api.get('/referrals'),
                api.get('/referrals/stats'),
            ]);
            if (refRes.data.success) setReferidos(refRes.data.data || []);
            if (statsRes.data.success) setStats(statsRes.data.data || { total: 0, registered: 0, purchased: 0 });
        } catch {
            /* silent */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    // Calculate earnings: ₲10,000 per active (purchased) referral
    const REWARD_PER_REFERRAL = 10000;
    const totalEarned = stats.purchased * REWARD_PER_REFERRAL;
    const formatGs = (n: number) => n >= 1000 ? `₲${(n / 1000).toFixed(0)}k` : `₲${n}`;
    const activos = stats.registered + stats.purchased;

    return (
        <div className="space-y-4 pb-24 max-w-xl mx-auto lg:max-w-3xl">
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            {/* Hero Banner */}
            <Reveal variant={scaleIn}>
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[#1a365d] dark:from-blue-600 dark:to-slate-900 text-white p-6 lg:p-8 text-center shadow-xl border border-white/5 transition-colors">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/20 rounded-full blur-2xl opacity-40" />
                    <div className="relative z-10">
                        <motion.div
                            variants={popIn}
                            initial="hidden"
                            animate="show"
                            transition={springPop}
                            className="w-14 h-14 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md"
                        >
                            <Gift size={26} className="text-secondary" />
                        </motion.div>
                        <h1 className="font-headline text-xl lg:text-2xl font-black mb-1">Invitá y Ganá</h1>
                        <p className="text-white/70 text-xs">Por cada amigo que se una al club, ganás</p>
                        <AnimatedNumber
                            value={10000}
                            prefix="₲ "
                            currency
                            className="block text-3xl lg:text-4xl font-headline font-black text-secondary mt-1.5 leading-none"
                        />
                        <p className="text-white/50 text-[11px] mt-1.5 uppercase tracking-widest font-bold">en tu billetera digital</p>
                    </div>
                </div>
            </Reveal>

            {/* Referral Link */}
            <Reveal delay={0.06}>
                <div className="bg-white dark:bg-slate-900/40 p-5 lg:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
                    <h3 className="font-bold text-sm lg:text-base mb-3 dark:text-white">Tu Enlace de Referido</h3>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100/50 dark:border-slate-700">
                        <p className="flex-1 text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{referralLink}</p>
                        <Pressable
                            onClick={handleCopy}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shrink-0 ${copied ? 'bg-emerald-500 text-white' : 'bg-primary dark:bg-blue-500 text-white'}`}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {copied ? (
                                    <motion.span
                                        key="copied"
                                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                                        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={springPop}
                                        className="flex items-center gap-1.5"
                                    >
                                        <CheckCircle2 size={12} /> Copiado
                                    </motion.span>
                                ) : (
                                    <motion.span
                                        key="copy"
                                        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                                        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={springPop}
                                        className="flex items-center gap-1.5"
                                    >
                                        <Copy size={12} /> Copiar
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Pressable>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                        <span className="font-bold uppercase tracking-widest text-[9px]">Tu código:</span>
                        <span className="font-black text-primary dark:text-blue-400 tracking-widest text-[11px]">{referralCode}</span>
                    </div>
                </div>
            </Reveal>
            </div>

            {/* Stats */}
            <StaggerList className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                {[
                    { val: stats.total, label: 'Referidos', color: 'text-primary dark:text-blue-400', currency: false },
                    { val: activos, label: 'Activos', color: 'text-emerald-600 dark:text-emerald-400', currency: false },
                    { val: totalEarned, label: 'Ganado', color: 'text-secondary', currency: true },
                ].map((s) => (
                    <StaggerItem
                        key={s.label}
                        className="bg-white dark:bg-slate-900/40 p-3 lg:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors"
                    >
                        {s.currency ? (
                            <AnimatedNumber
                                value={s.val}
                                prefix="₲"
                                currency
                                className={`block text-lg lg:text-2xl font-black ${s.color}`}
                            />
                        ) : (
                            <AnimatedNumber
                                value={s.val}
                                className={`block text-lg lg:text-2xl font-black ${s.color}`}
                            />
                        )}
                        <p className="text-[9px] lg:text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mt-0.5 lg:mt-1">{s.label}</p>
                    </StaggerItem>
                ))}
            </StaggerList>

            {/* List */}
            <Reveal delay={0.12}>
                <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                    <div className="p-4 lg:p-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-bold text-sm lg:text-base flex items-center gap-2 text-slate-800 dark:text-white">
                            <Users size={15} className="text-primary dark:text-blue-400" /> Mis Referidos
                        </h3>
                        <Pressable
                            onClick={loadData}
                            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <RefreshCw size={12} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                        </Pressable>
                    </div>

                    {loading ? (
                        <div className="p-4 space-y-3">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="w-2/3 h-3 rounded-full" />
                                        <Skeleton className="w-1/3 h-2.5 rounded-full" />
                                    </div>
                                    <Skeleton className="w-12 h-4 rounded-full shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : referidos.length === 0 ? (
                        <div className="py-10 text-center">
                            <Gift size={28} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">Aún no tenés referidos</p>
                            <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">Compartí tu enlace para empezar a ganar</p>
                        </div>
                    ) : (
                        <StaggerList onView>
                            {referidos.map((r: any) => {
                                const isActive = r.status === 'registered' || r.status === 'purchased';
                                const earned = r.status === 'purchased' ? REWARD_PER_REFERRAL : 0;
                                const displayName = r.referredEmail || r.referredPhone || 'Referido';
                                return (
                                    <StaggerItem
                                        key={r.id}
                                        className="flex items-center gap-3 p-4 lg:p-5 border-b border-slate-50 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-sm shrink-0">
                                            {displayName[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-xs lg:text-sm dark:text-slate-200 truncate">{displayName}</p>
                                            <span className={`text-[10px] font-bold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                                                {isActive ? 'Activo' : 'Pendiente'}
                                            </span>
                                        </div>
                                        {earned > 0 && (
                                            <motion.div
                                                variants={popIn}
                                                transition={springPop}
                                                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-xs shrink-0"
                                            >
                                                <Wallet size={12} />
                                                +{formatGs(earned)}
                                            </motion.div>
                                        )}
                                    </StaggerItem>
                                );
                            })}
                        </StaggerList>
                    )}
                </div>
            </Reveal>
        </div>
    );
}
