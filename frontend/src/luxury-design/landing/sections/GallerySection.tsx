/**
 * GallerySection — Galería parallax multicapa (efecto visual fuerte).
 * Full-bleed: <section> propia con fondo #070708. Cada columna se desplaza a
 * distinta velocidad atada al scroll de la sección (useScroll + useTransform).
 * Respeta reduce-motion: si useReduce() => sin parallax (translateY = 0).
 */
import React, { useRef } from 'react';
import { useScroll, useTransform } from 'framer-motion';
import { SectionHeading, cls } from '../ui';
import { motion, useReduce } from '../../lib/motion';
import { IMG, GALLERY } from '../assets';

// Imagen individual con fondo placeholder mientras carga (hotlink remoto => lazy).
function GalleryImage({ src, alt, ratio = 'aspect-[4/5]' }: { src: string; alt: string; ratio?: string }) {
  return (
    <div className={`relative w-full ${ratio} overflow-hidden rounded-3xl bg-white/5 border border-white/10`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Overlay sutil para integrar con el dark theme */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-3xl" />
    </div>
  );
}

export default function GallerySection() {
  const reduce = useReduce();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Tres velocidades distintas. Si reduce-motion, todo queda en 0 (sin parallax).
  const ySlow = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['8%', '-8%']);
  const yMid = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['16%', '-16%']);
  const yFast = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-6%', '6%']);

  // Reparto de imágenes por columna a partir de assets reales.
  const colA = [IMG.exterior[0], IMG.detailing[0], IMG.night[0], IMG.exterior[3]];
  const colB = [IMG.detailing[1], IMG.interior, IMG.exterior[1], IMG.night[1]];
  const colC = [IMG.night[2], IMG.exterior[2], GALLERY[0], IMG.exterior[4]];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-[#070708] px-5 py-28 sm:py-36"
    >
      <SectionHeading
        eyebrow="Galería"
        title="Resultados que hablan solos"
        subtitle="Cada vehículo que pasa por el club queda impecable. Mirá el nivel de detalle de nuestro trabajo."
      />

      <div className="relative mx-auto mt-4 max-w-6xl">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
          {/* Columna 1 — velocidad lenta */}
          <motion.div style={{ y: ySlow }} className="flex flex-col gap-4 sm:gap-5 will-change-transform">
            {colA.map((src, i) => (
              <GalleryImage key={`a-${i}`} src={src} alt={`Detailing Luxury Garage ${i + 1}`} ratio={i % 2 === 0 ? 'aspect-[4/5]' : 'aspect-[3/4]'} />
            ))}
          </motion.div>

          {/* Columna 2 — velocidad media (desfasada hacia abajo en desktop) */}
          <motion.div style={{ y: yMid }} className="flex flex-col gap-4 sm:gap-5 will-change-transform md:mt-12">
            {colB.map((src, i) => (
              <GalleryImage key={`b-${i}`} src={src} alt={`Vehículo premium ${i + 1}`} ratio={i % 2 === 0 ? 'aspect-[3/4]' : 'aspect-[4/5]'} />
            ))}
          </motion.div>

          {/* Columna 3 — velocidad rápida e inversa (solo desktop) */}
          <motion.div style={{ y: yFast }} className="hidden flex-col gap-4 sm:gap-5 will-change-transform md:flex md:mt-4">
            {colC.map((src, i) => (
              <GalleryImage key={`c-${i}`} src={src} alt={`Auto de noche ${i + 1}`} ratio={i % 2 === 0 ? 'aspect-[4/5]' : 'aspect-[3/4]'} />
            ))}
          </motion.div>
        </div>

        {/* Difuminados arriba/abajo para que el parallax entre y salga suave */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#070708] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#070708] to-transparent" />
      </div>
    </section>
  );
}
