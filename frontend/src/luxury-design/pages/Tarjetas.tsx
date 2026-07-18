import React from 'react';
import BancardCardManager from '../components/BancardCardManager';
import { motion, Reveal, staggerContainer } from '../lib/motion';

interface TarjetasProps {
    user: any;
    onUpdate?: () => void;
}

export default function Tarjetas({ user, onUpdate }: TarjetasProps) {
    return (
        <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-4 lg:space-y-6 pb-24"
        >
            {/* Header */}
            <Reveal className="text-center">
                <h1 className="font-headline text-2xl lg:text-3xl font-extrabold tracking-tight dark:text-white">💳 Mis Tarjetas</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm lg:text-base mt-1">Gestioná tus métodos de pago</p>
            </Reveal>

            {/* Gestión de tarjetas con Bancard (listar / agregar / eliminar / principal) */}
            <Reveal delay={0.08}>
                <BancardCardManager onChange={onUpdate} />
            </Reveal>
        </motion.div>
    );
}
