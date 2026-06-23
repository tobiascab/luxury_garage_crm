import { Smartphone, Check, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SectionShell, Eyebrow, cls } from '../ui'
import { Reveal, Pressable, motion, useReduce } from '../../lib/motion'

const VENTAJAS = [
  'Tu garage digital y tus reservas siempre a mano.',
  'Pase QR y pagos con Bancard desde el teléfono.',
  'Notificaciones push cuando tu auto está listo.',
]

export default function AppPwaSection() {
  const navigate = useNavigate()
  const reduce = useReduce()

  return (
    <SectionShell alt>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Columna izquierda */}
        <Reveal onView>
          <div>
            <Eyebrow icon={Smartphone}>Llevá la app</Eyebrow>
            <h2 className="font-headline text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
              Tu club premium, en el bolsillo.
            </h2>
            <p className="mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
              Instalá <span className="brand-wordmark">LUXURY GARAGE</span> como app en tu
              teléfono y gestioná todo sin descargas pesadas: reservás, escaneás tu pase y
              seguís el estado de cada lavado en segundos.
            </p>

            <ul className="mt-8 space-y-4">
              {VENTAJAS.map((v) => (
                <li key={v} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10">
                    <Check className="h-4 w-4 text-secondary" />
                  </span>
                  <span className="text-sm text-slate-300 sm:text-base">{v}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Pressable>
                <button
                  onClick={() => navigate('/login')}
                  className={`${cls.btnGold} px-8 py-4 text-sm`}
                >
                  Iniciar sesión
                </button>
              </Pressable>
              <p className="mt-4 max-w-md text-xs text-slate-500">
                Una vez dentro, usá la opción de tu navegador
                <span className="text-slate-400"> “Agregar a pantalla de inicio” </span>
                para tenerla como una app más.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Columna derecha: mockup de teléfono */}
        <Reveal onView delay={0.15}>
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-[280px] overflow-hidden rounded-[2.5rem] border-4 border-white/15 bg-gradient-to-b from-[#101013] to-[#070708] shadow-2xl shadow-black/60"
              style={{ aspectRatio: '9 / 19' }}
            >
              {/* Notch */}
              <div className="absolute left-1/2 top-3 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-black/70 border border-white/10" />

              {/* Resplandor dorado de fondo */}
              <div className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-56 w-56 rounded-full bg-secondary/20 blur-3xl" />

              <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8 pt-10">
                <motion.img
                  src="/logo.png"
                  alt="Luxury Garage"
                  className="h-20 w-20 object-contain drop-shadow-[0_8px_24px_rgba(254,183,0,0.35)]"
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                />

                <div className="brand-wordmark text-center text-lg leading-tight">
                  LUXURY GARAGE
                </div>

                <p className="text-center text-xs text-slate-400">
                  Detailing premium · Asunción
                </p>

                <div className="mt-2 w-full">
                  <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-black">
                    <LogIn className="h-4 w-4" />
                    Iniciar sesión
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </SectionShell>
  )
}
