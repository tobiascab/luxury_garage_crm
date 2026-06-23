import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Boxes, ArrowLeftRight, Truck, NotebookText, BellRing } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ItemsTab from './inventory/ItemsTab';
import MovementsTab from './inventory/MovementsTab';
import SuppliersTab from './inventory/SuppliersTab';
import RecipesTab from './inventory/RecipesTab';
import AlertsTab from './inventory/AlertsTab';

const TABS = [
  { id: 'items', label: 'Insumos', icon: Boxes },
  { id: 'movements', label: 'Movimientos', icon: ArrowLeftRight },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
  { id: 'recipes', label: 'Recetas', icon: NotebookText },
  { id: 'alerts', label: 'Alertas', icon: BellRing },
];

export default function InventoryManager() {
  const [activeTab, setActiveTab] = useState('items');
  const reduceMotion = useReducedMotion();
  const tap = reduceMotion ? undefined : { scale: 0.97 };

  return (
    <div className="page-content pb-16">
      <PageHeader
        title="Inventario"
        subtitle="Control de insumos, stock, movimientos y alertas de reposición"
      />

      {/* Tab bar */}
      <div className="mb-6 border-b border-slate-200 dark:border-white/10">
        <div className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                whileTap={tap}
                className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {t.label}
                {active && (
                  reduceMotion ? (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-600 dark:bg-indigo-400" />
                  ) : (
                    <motion.span
                      layoutId="inventory-tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-0.5 bg-indigo-600 dark:bg-indigo-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    />
                  )
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'movements' && <MovementsTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
      {activeTab === 'recipes' && <RecipesTab />}
      {activeTab === 'alerts' && <AlertsTab />}
    </div>
  );
}
