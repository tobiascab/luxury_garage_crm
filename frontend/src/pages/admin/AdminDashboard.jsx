import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Bell, MessageSquare, Gift, Settings, Search, Calendar, ChevronDown,
  ArrowUpRight, ArrowDownRight, MoreVertical, CreditCard, ChevronRight, Zap, Users
} from 'lucide-react';
import api from '../../services/api';

const PLAN_COLORS = ['#fbbf24', '#3b82f6', '#10b981', '#f43f5e'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/dashboard/admin');
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const d = data || {};
  const revenueData = d.monthlyRevenue || [
    { name: 'Week 01', revenue: 200, expenses: 100 },
    { name: 'Week 02', revenue: 150, expenses: 150 },
    { name: 'Week 03', revenue: 300, expenses: 200 },
    { name: 'Week 04', revenue: 250, expenses: 180 },
    { name: 'Week 05', revenue: 400, expenses: 250 },
    { name: 'Week 06', revenue: 380, expenses: 200 },
    { name: 'Week 07', revenue: 500, expenses: 300 },
    { name: 'Week 08', revenue: 748, expenses: 400 },
    { name: 'Week 09', revenue: 600, expenses: 350 },
  ];

  const planData = [
    { name: 'Standard', value: 30 },
    { name: 'Premium', value: 45 },
    { name: 'VIP', value: 15 },
    { name: 'Elite', value: 10 }
  ];

  return (
    <div className="bg-[#f8f9fa] min-h-screen text-slate-800 p-6 lg:p-10 font-sans selection:bg-blue-200">

      {/* ── Navbar ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar en el sistema..."
            className="w-full bg-white border-0 rounded-full py-3.5 pl-12 pr-4 text-sm font-medium shadow-[0_2px_15px_rgba(0,0,0,0.03)] outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-500">
            <a href="#" className="hover:text-slate-900 transition-colors">Sociales</a>
            <a href="#" className="hover:text-slate-900 transition-colors relative">
              <span className="absolute -left-3 top-1.5 w-1.5 h-1.5 rounded-full bg-red-500"></span>
              Live Training
            </a>
            <a href="#" className="hover:text-slate-900 transition-colors">Blog</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Noticias</a>
          </div>

          <div className="flex items-center gap-4">
            <NavIcon icon={<Bell size={18} />} badge="12" />
            <NavIcon icon={<MessageSquare size={18} />} badge="5" />
            <NavIcon icon={<Gift size={18} />} badge="2" />
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-pointer shadow-lg shadow-blue-600/20 hover:scale-105 transition-transform">
              <Settings size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800">Dashboard</h1>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full text-sm font-bold text-slate-600 shadow-[0_2px_15px_rgba(0,0,0,0.03)] cursor-pointer">
            <span>Asunción, PY</span>
            <ChevronDown size={16} />
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95">
            <Calendar size={16} /> Filter Periods
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          icon={<div className="w-4 h-4 rounded-full bg-yellow-400" />}
          iconBg="bg-yellow-50 text-yellow-500"
          value="₲ 45M"
          trend="+45%"
          trendLabel="This week"
        />
        <KPICard
          icon={<div className="font-extrabold text-lg tracking-tighter">M</div>}
          iconBg="bg-orange-50 text-orange-500"
          value="1,280"
          trend="+15%"
          trendLabel="This week"
        />
        <KPICard
          icon={<Zap size={20} />}
          iconBg="bg-blue-50 text-blue-600"
          value="450"
          trend="+5%"
          trendLabel="This week"
          up={false}
        />
        <KPICard
          icon={<Users size={20} />}
          iconBg="bg-slate-800 text-white"
          value="784"
          trend="+8%"
          trendLabel="This week"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Doughnut */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6">Membresías Activas</h3>
          <div className="flex-1 min-h-[200px] flex items-center justify-center relative -mt-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={planData}
                  cx="50%"
                  cy="80%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={10}
                >
                  {planData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-[30px] flex gap-4 w-full justify-center px-4">
              {planData.map((p, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: PLAN_COLORS[i] }} />
                    <span className="text-[10px] font-bold text-slate-400">{p.name} ({p.value}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-50">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-800">Crecimiento Mensual</h3>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="chart" className="accent-blue-600" defaultChecked /> Ingresos
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="chart" className="accent-orange-500" /> Gastos
                </label>
              </div>
              <div className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
                Octubre (2026) <ChevronDown size={14} />
              </div>
            </div>
          </div>

          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={10} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 800, color: '#1e293b' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="expenses" stroke="#f97316" strokeWidth={4} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Balance Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BalanceCard title="Ingresos Suscripción" amount="₲ 22.4M" valid="08/26" name="Standard" bg="bg-emerald-500" />
        <BalanceCard title="Ingresos Servicios" amount="₲ 67.8M" valid="08/26" name="Premium" bg="bg-blue-500" />
        <BalanceCard title="Crédito a Favor" amount="₲ 2.4M" valid="08/26" name="Billetera" bg="bg-indigo-600" icon="B" />
        <BalanceCard title="Pagos Pendientes" amount="₲ 6.7M" valid="08/26" name="Deudas" bg="bg-orange-500" />
      </div>

      {/* ── Bottom Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Actividad Reciente</h3>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100">Monthly</button>
              <button className="px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100">Weekly</button>
              <button className="px-4 py-1.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-md shadow-blue-600/20">Today</button>
            </div>
          </div>
          <div className="space-y-4">
            <ActivityRow name="Juan Pérez" time="06:24:45 AM" amount="+₲ 45,000" status="Completed" color="green" icon={<ChevronDown />} />
            <ActivityRow name="María González" time="10:12:30 AM" amount="+₲ 150,000" status="Pending" color="yellow" icon={<ChevronDown />} />
            <ActivityRow name="Carlos Ruiz" time="02:45:10 PM" amount="-₲ 20,000" status="Cancelled" color="red" icon={<ChevronRight />} />
          </div>
        </div>

        <div className="space-y-6">
          <OrderForm title="Crear Factura" coin="Servicio Lavado" btnText="Emitir Ahora" />
          <OrderForm title="Enviar Notificación" coin="Promo Premium" btnText="Enviar" isBuy />
        </div>
      </div>

    </div>
  );
}

// ── Atomic Components ──

function NavIcon({ icon, badge }) {
  return (
    <div className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-[0_2px_15px_rgba(0,0,0,0.03)] cursor-pointer hover:bg-slate-50 transition-colors">
      {icon}
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white text-[8px] font-black text-white flex items-center justify-center">
          {badge}
        </span>
      )}
    </div>
  );
}

function KPICard({ icon, iconBg, value, trend, trendLabel, up = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-6 flex flex-col shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-50 hover:shadow-[0_10px_35px_rgba(0,0,0,0.06)] transition-shadow cursor-default"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{value}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            {up ? (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            )}
            <span className={`text-xs font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{trend}</span>
            <span className="text-xs font-bold text-slate-400 capitalize">{trendLabel}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BalanceCard({ title, amount, valid, name, bg, icon }) {
  return (
    <div className={`relative p-6 rounded-[24px] ${bg} text-white shadow-xl shadow-current/20 overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer`}>
      {/* Decorative vector lines mimicking the credit card wave */}
      <svg className="absolute inset-0 w-full h-full opacity-30 group-hover:opacity-40 transition-opacity" viewBox="0 0 200 100" preserveAspectRatio="none">
        <path d="M0,50 Q50,0 100,50 T200,50 L200,100 L0,100 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5" />
        <path d="M0,70 Q50,20 100,70 T200,70 L200,100 L0,100 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      </svg>

      <div className="relative z-10 flex flex-col h-full justify-between gap-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{title}</span>
          <h3 className="text-2xl font-extrabold tracking-tighter mt-1">{amount}</h3>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex gap-6 text-[9px] font-bold uppercase tracking-widest opacity-90">
            <div>
              <span className="block opacity-60 mb-0.5">Valid Thru</span>
              <span>{valid}</span>
            </div>
            <div>
              <span className="block opacity-60 mb-0.5">Detalle</span>
              <span>{name}</span>
            </div>
          </div>
          {icon ? (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg backdrop-blur-sm">
              {icon}
            </div>
          ) : (
            <div className="flex -space-x-3">
              <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm"></div>
              <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ name, time, amount, status, color, icon }) {
  const isGreen = color === 'green';
  const isReq = color === 'yellow';
  return (
    <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isGreen ? 'bg-emerald-100 text-emerald-500' : isReq ? 'bg-yellow-100 text-yellow-500' : 'bg-rose-100 text-rose-500'}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-extrabold text-slate-800">{name}</p>
          <p className="text-xs font-bold text-slate-400">{time}</p>
        </div>
      </div>
      <div className="font-extrabold text-slate-800">{amount}</div>
      <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${isGreen ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
          isReq ? 'border-amber-200 text-amber-600 bg-amber-50' :
            'border-slate-200 text-slate-500 bg-slate-50'
        }`}>
        {status}
      </div>
    </div>
  );
}

function OrderForm({ title, coin, btnText, isBuy }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden group">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <MoreVertical size={18} className="text-slate-400 cursor-pointer" />
      </div>

      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f8f9fa] border border-slate-100 mb-4 cursor-pointer hover:border-slate-200 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-md">
            {coin[0]}
          </div>
          <span className="text-sm font-bold text-slate-700">{coin}</span>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-400 mb-1 block">Costo Base</label>
          <input type="text" placeholder="₲ 0" className="w-full bg-transparent border-b-2 border-slate-100 py-1 font-bold text-slate-800 outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-400 mb-1 block">Adicional</label>
          <input type="text" placeholder="0" className="w-full bg-transparent border-b-2 border-slate-100 py-1 font-bold text-slate-800 outline-none focus:border-blue-500" />
        </div>
      </div>

      <button className="w-full py-3.5 bg-[#f8f9fa] border-2 border-slate-100 rounded-2xl text-sm font-extrabold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all active:scale-95 shadow-sm">
        {btnText}
      </button>
    </div>
  );
}
