import { motion } from 'framer-motion';

export default function StatCard({ title, value, icon, trend, trendValue, color = 'var(--blue)' }) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
      transition={{ duration: 0.3 }}
      style={{ '--accent': color }}
    >
      <div className="stat-card-header">
        <span className="stat-card-icon" style={{ background: `${color}20`, color }}>{icon}</span>
        {trend && (
          <span className={`stat-card-trend ${trend === 'up' ? 'trend-up' : 'trend-down'}`}>
            {trend === 'up' ? '↑' : '↓'} {trendValue}
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-title">{title}</div>
    </motion.div>
  );
}
