import { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CreditCard, RefreshCcw, Crown, Calendar, Mail, Phone,
  ArrowLeftRight, ArrowDownCircle, ShieldCheck, XCircle,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import { SkeletonTable } from '../../components/Skeleton';

const fmtGs = (n) => '₲ ' + Number(n || 0).toLocaleString('es-PY');
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function MembershipsManager() {
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.96 };
  const tapSm = reduceMotion ? undefined : { scale: 0.9 };
  const [memberships, setMemberships] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Cambiar plan
  const [showChange, setShowChange] = useState(false);
  const [changeTarget, setChangeTarget] = useState(null);
  const [changePlanId, setChangePlanId] = useState('');
  const [savingChange, setSavingChange] = useState(false);

  // Cancelar
  const [toCancel, setToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Estado de la acción de baja por fila (id de membresía en curso)
  const [downgradeBusy, setDowngradeBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await api.get('/memberships/admin/list', { _noCache: true });
      setMemberships(r.data.data || []);
    } catch (err) {
      setError(true);
      toast.error(err.response?.data?.message || 'No se pudieron cargar las membresías');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const r = await api.get('/plans');
      setPlans(r.data.data || []);
    } catch {
      setPlans([]);
    }
  }, []);

  useEffect(() => { load(); loadPlans(); }, [load, loadPlans]);

  // ── Cambiar plan ──
  const openChange = (m) => {
    setChangeTarget(m);
    setChangePlanId(m.plan?.id || '');
    setShowChange(true);
  };

  const handleChangePlan = async (e) => {
    e.preventDefault();
    if (!changePlanId) { toast.error('Seleccioná un plan'); return; }
    setSavingChange(true);
    try {
      const r = await api.post('/memberships/admin/change-plan', {
        userId: changeTarget.user.id,
        planId: changePlanId,
      });
      toast.success(r.data?.message || 'Plan actualizado');
      setShowChange(false);
      setChangeTarget(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cambiar el plan');
    } finally {
      setSavingChange(false);
    }
  };

  // ── Habilitar / revocar baja ──
  const toggleDowngrade = async (m) => {
    setDowngradeBusy(m.id);
    try {
      const r = await api.post('/memberships/admin/authorize-downgrade', {
        userId: m.user.id,
        allowed: !m.downgradeAllowed,
      });
      toast.success(r.data?.message || (m.downgradeAllowed ? 'Baja revocada' : 'Baja habilitada'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo actualizar la baja');
    } finally {
      setDowngradeBusy(null);
    }
  };

  // ── Cancelar membresía ──
  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      const r = await api.post('/memberships/admin/cancel', { userId: toCancel.user.id });
      toast.success(r.data?.message || 'Membresía cancelada');
      setToCancel(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'No se pudo cancelar la membresía');
    } finally {
      setCancelling(false);
    }
  };

  const fullName = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || '—';

  // ── render ──
  return (
    <div className="page-content pb-16">
      {/* Header */}
      <div className="admin-page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="admin-itile admin-itile-violet w-11 h-11 rounded-2xl">
            <CreditCard size={22} className="text-white" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Membresías</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gestión de planes de los clientes</p>
          </div>
        </div>
        <motion.button
          whileTap={tapSm}
          onClick={load}
          title="Recargar"
          className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors"
        >
          <RefreshCcw size={16} />
        </motion.button>
      </div>

      {/* Estados */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : error ? (
        <EmptyState
          icon="⚠️"
          title="Error al cargar"
          message="No se pudieron obtener las membresías."
          action="Reintentar"
          onAction={load}
        />
      ) : memberships.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No hay membresías activas"
          message="Cuando un cliente tenga un plan activo, aparecerá acá."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-white/[0.02] text-xs font-medium text-slate-400 uppercase tracking-wide">
                  <th className="px-5 py-3.5">Cliente</th>
                  <th className="px-5 py-3.5">Plan actual</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Desde</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Vence</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Cliente */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-semibold text-xs shrink-0">
                          {m.user?.firstName?.[0]}{m.user?.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {fullName(m.user)}
                          </p>
                          {m.user?.email && (
                            <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                              <Mail size={11} className="text-slate-400" /> {m.user.email}
                            </p>
                          )}
                          {m.user?.phone && (
                            <p className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                              <Phone size={11} className="text-slate-400" /> {m.user.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Plan actual */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-medium">
                          <Crown size={12} /> {m.plan?.name || '—'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                          {fmtGs(m.plan?.priceGs)}
                        </span>
                        {m.downgradeAllowed && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                            <ArrowDownCircle size={11} /> Baja habilitada
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Desde */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-slate-500 tabular-nums">{fmtDate(m.createdAt)}</span>
                    </td>

                    {/* Vence */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="text-sm text-slate-500 tabular-nums flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" /> {fmtDate(m.endDate)}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <motion.button
                          whileTap={tap}
                          onClick={() => openChange(m)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                          <ArrowLeftRight size={14} /> Cambiar plan
                        </motion.button>
                        <motion.button
                          whileTap={downgradeBusy === m.id ? undefined : tap}
                          onClick={() => toggleDowngrade(m)}
                          disabled={downgradeBusy === m.id}
                          title={m.downgradeAllowed
                            ? 'Revocar la habilitación de baja'
                            : 'Permitir que el cliente baje de plan una vez'}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                            m.downgradeAllowed
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20'
                              : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10'
                          }`}
                        >
                          {m.downgradeAllowed
                            ? <><XCircle size={14} /> Revocar baja</>
                            : <><ShieldCheck size={14} /> Habilitar baja</>}
                        </motion.button>
                        <motion.button
                          whileTap={tapSm}
                          onClick={() => setToCancel(m)}
                          title="Cancelar membresía"
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <XCircle size={16} />
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CAMBIAR PLAN MODAL ── */}
      <FormModal
        isOpen={showChange}
        onClose={() => setShowChange(false)}
        title="Cambiar plan"
        subtitle={changeTarget ? `Para ${fullName(changeTarget.user)}` : ''}
        icon={<ArrowLeftRight size={18} />}
        formId="change-plan-form"
        submitting={savingChange}
        submitLabel="Cambiar plan"
        size="md"
      >
        <form id="change-plan-form" onSubmit={handleChangePlan} className="space-y-4">
          <FormField
            as="select"
            label="Nuevo plan"
            name="planId"
            required
            value={changePlanId}
            onChange={(e) => setChangePlanId(e.target.value)}
          >
            <option value="">Seleccioná un plan</option>
            {plans
              .filter((p) => p.isActive || p.id === changeTarget?.plan?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {fmtGs(p.priceGs)}</option>
              ))}
          </FormField>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              El admin puede cambiar a cualquier plan, incluido uno más económico.
            </p>
          </div>
        </form>
      </FormModal>

      {/* ── CONFIRM: cancelar membresía ── */}
      <ConfirmDialog
        isOpen={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={confirmCancel}
        loading={cancelling}
        variant="danger"
        title="Cancelar membresía"
        confirmLabel="Cancelar membresía"
        message={toCancel
          ? `¿Confirmás cancelar la membresía de ${fullName(toCancel.user)}? El cliente quedará sin plan activo.`
          : ''}
      />
    </div>
  );
}
