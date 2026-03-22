import { useAuth } from '../../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import PageHeader from '../../components/PageHeader';

export default function DigitalCard() {
  const { user } = useAuth();
  const membership = user?.memberships?.[0];
  const plan = membership?.plan;

  const planGradient = plan?.name === 'VIP' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : plan?.name === 'Premium' ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)' : 'linear-gradient(135deg, #1E90FF, #0070E0)';

  return (
    <div className="page-content">
      <PageHeader title="💳 Tarjeta Digital" subtitle="Mostrá este QR al llegar al lavadero" />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
        <motion.div
          className="digital-card"
          initial={{ opacity: 0, rotateY: -20, scale: 0.9 }}
          animate={{ opacity: 1, rotateY: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: planGradient, perspective: '1000px' }}
        >
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '-20px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Logo */}
            <div style={{ fontSize: '0.7rem', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: 600 }}>
              LUXURY GARAGE
            </div>

            {/* Plan Badge */}
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '4px 16px', fontSize: '0.75rem', fontWeight: 700, color: 'white', marginBottom: '24px', letterSpacing: '1px' }}>
              {plan?.name || 'MIEMBRO'} {plan?.name === 'VIP' ? '👑' : plan?.name === 'Premium' ? '💎' : '⭐'}
            </div>

            {/* QR Code */}
            <motion.div
              style={{ background: 'white', borderRadius: '16px', padding: '16px', display: 'inline-block', marginBottom: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
              whileHover={{ scale: 1.05 }}
            >
              <QRCodeSVG
                value={JSON.stringify({ userId: user?.id, plan: plan?.name, member: `${user?.firstName} ${user?.lastName}` })}
                size={160}
                level="H"
                bgColor="#ffffff"
                fgColor="#0A1628"
              />
            </motion.div>

            {/* Member Info */}
            <div style={{ marginTop: '4px' }}>
              <p style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
                {user?.firstName} {user?.lastName}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
                {user?.email}
              </p>
              {membership && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>
                  Válido hasta: {new Date(membership.endDate).toLocaleDateString('es-PY')}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>
        Presentá este código QR al llegar al lavadero para una verificación rápida
      </p>
    </div>
  );
}
