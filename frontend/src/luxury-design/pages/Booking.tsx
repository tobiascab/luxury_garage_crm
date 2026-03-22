import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, Sparkles, History, ChevronRight, Loader2
} from 'lucide-react';

import { API_URL } from '../config';

interface BookingProps {
  user: any;
  onBookingComplete: () => void;
}

export default function Booking({ user, onBookingComplete }: BookingProps) {
  const [selectedService, setSelectedService] = useState('Lavado Premium');
  const [selectedDate, setSelectedDate] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchBookings(); }, [user.id]);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/bookings`);
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      console.error('Error fetching bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate) return alert('Seleccioná una fecha');
    setIsBooking(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: user.vehicles?.[0]?.id,
          service_type: selectedService,
          booking_date: selectedDate
        })
      });
      if (res.ok) {
        fetchBookings();
        onBookingComplete();
        setSelectedDate('');
      }
    } catch (e) {
      alert('Error al reservar');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 pb-24"
    >
      {/* New Booking Form */}
      <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary/10 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-primary dark:text-blue-400">
            <Sparkles size={18} />
          </div>
          <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Nueva Reserva</h2>
        </div>

        {/* Service Selection */}
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Tipo de Servicio</p>
          <div className="grid grid-cols-2 gap-2">
            {['Lavado Premium', 'Lavado Básico', 'Detailing Interior', 'Tratamiento Cerámico'].map(s => (
              <button
                key={s}
                onClick={() => setSelectedService(s)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all active:scale-95 text-left ${selectedService === s
                  ? 'bg-primary/5 dark:bg-blue-500/10 border-primary dark:border-blue-500 text-primary dark:text-blue-400 shadow-sm shadow-primary/10'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-primary/20 dark:hover:border-blue-500/20'
                  }`}
              >
                <Sparkles size={13} />
                <span className="font-bold text-xs leading-tight">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date Input */}
        <div className="mb-5">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Fecha y Hora</p>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary dark:text-blue-400" size={16} />
            <input
              type="datetime-local"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/10 transition-all color-scheme-dark"
              style={{ colorScheme: 'dark' }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleBooking}
          disabled={isBooking}
          className="w-full py-3.5 bg-primary dark:bg-blue-500 text-white rounded-xl font-black tracking-widest uppercase text-xs shadow-lg shadow-primary/20 dark:shadow-blue-500/20 hover:shadow-primary/30 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isBooking ? <Loader2 className="animate-spin" size={18} /> : <>Confirmar Reserva <ChevronRight size={16} /></>}
        </button>
      </div>

      {/* Booking History */}
      <div className="bg-white dark:bg-slate-900/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="flex items-center gap-2 p-5 border-b border-slate-50 dark:border-slate-800">
          <History size={16} className="text-primary dark:text-blue-400" />
          <h3 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">Historial de Reservas</h3>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-primary dark:text-blue-400" size={24} />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-center text-sm font-medium py-10">Aún no tenés reservas.</p>
          ) : (
            bookings.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${b.status === 'Completado'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-400'
                  }`}>
                  <CheckCircle2 size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-200 truncate">{b.service_type}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    <Calendar size={10} />
                    <span>{new Date(b.booking_date).toLocaleDateString('es-ES')}</span>
                    <Clock size={10} />
                    <span>{new Date(b.booking_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${b.status === 'Completado'
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}>
                  {b.status}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}
