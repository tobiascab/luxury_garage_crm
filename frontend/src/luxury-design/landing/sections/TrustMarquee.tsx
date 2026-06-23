import { motion, useReduce } from '../../lib/motion'

const ITEMS = [
  'Detailing premium',
  'Pagos seguros con Bancard',
  'Reservas online',
  'Tu garage digital',
  'Pase QR',
  'Membresías flexibles',
  'Programa de referidos',
]

export default function TrustMarquee() {
  const reduce = useReduce()

  // Una sola pasada del contenido; se duplica abajo para lograr el loop sin saltos.
  const Track = ({ ariaHidden = false }: { ariaHidden?: boolean }) => (
    <div
      className="flex shrink-0 items-center gap-8 pr-8"
      aria-hidden={ariaHidden || undefined}
    >
      {ITEMS.map((item, i) => (
        <div key={`${item}-${i}`} className="flex shrink-0 items-center gap-8">
          <span
            className={`font-headline whitespace-nowrap text-sm font-black uppercase tracking-widest ${
              i % 2 === 0 ? 'text-white' : 'text-secondary'
            }`}
          >
            {item}
          </span>
          <span className="text-secondary text-lg leading-none" aria-hidden="true">
            •
          </span>
        </div>
      ))}
    </div>
  )

  return (
    <section
      className="overflow-hidden border-y border-white/10 py-8"
      style={{ backgroundColor: '#0b0b0d' }}
      aria-label="Beneficios de Luxury Garage"
    >
      <motion.div
        className="flex w-max items-center"
        animate={reduce ? undefined : { x: ['0%', '-50%'] }}
        transition={
          reduce
            ? undefined
            : { duration: 25, ease: 'linear', repeat: Infinity }
        }
      >
        <Track />
        <Track ariaHidden />
      </motion.div>
    </section>
  )
}
