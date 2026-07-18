/**
 * ============================================================================
 *  Landing pública de Luxury Garage — versión premium (scroll cinematográfico)
 * ============================================================================
 *  La ve un visitante NUEVO desde el navegador (no la PWA instalada).
 *  - Smooth scroll global (Lenis) + animaciones (framer-motion) + pieza 3D (R3F).
 *  - Video real de fondo en el hero, imágenes reales (Unsplash) y galería parallax.
 *  - Sección de PLANES con datos REALES del backend (lo que edita el admin).
 *  - Todo el peso pesado (three, lenis, secciones) va en este chunk lazy; three
 *    además se carga aparte y solo en desktop capaz (ver Showcase3D / Scene3D).
 *  Estética dark premium siempre (negro + dorado), sin depender del theme guardado.
 * ============================================================================
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Crown } from 'lucide-react';
import { Pressable } from '../lib/motion';
import { cls } from '../landing/ui';
import SmoothScroll from '../landing/SmoothScroll';

import Hero from '../landing/sections/Hero';
import TrustMarquee from '../landing/sections/TrustMarquee';
import ServiciosSection from '../landing/sections/ServiciosSection';
import ProcesoSection from '../landing/sections/ProcesoSection';
import DetailingVideoBand from '../landing/sections/DetailingVideoBand';
import BenefitsSection from '../landing/sections/BenefitsSection';
import HowItWorksSection from '../landing/sections/HowItWorksSection';
import GallerySection from '../landing/sections/GallerySection';
import Showcase3D from '../landing/sections/Showcase3D';
import PlanesSection from '../landing/sections/PlanesSection';
import ConfianzaBand from '../landing/sections/ConfianzaBand';
import TestimoniosSection from '../landing/sections/TestimoniosSection';
import FaqSection from '../landing/sections/FaqSection';
import AppPwaSection from '../landing/sections/AppPwaSection';
import FooterSection from '../landing/sections/FooterSection';

// Cuestionario de solicitud de membresía (lo crea otro agente en components/).
import MembershipRequestForm from '../components/MembershipRequestForm';

// Widget de chat (GHL) — se autoposiciona en la landing.
import GhlChatWidget from '../landing/sections/GhlChatWidget';

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  // Cuestionario "Solicitar membresía": abierto/cerrado + plan pre-seleccionado opcional.
  const [formOpen, setFormOpen] = useState(false);
  const [formPlan, setFormPlan] = useState<string | undefined>(undefined);

  const openMembershipForm = (plan?: string) => {
    setFormPlan(plan);
    setFormOpen(true);
  };

  // Fondo oscuro a nivel <body> (evita flash blanco en overscroll). Se restaura al salir.
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#070708';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  // Nav sólida al hacer scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToPlans = () => document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <SmoothScroll>
      <div className="relative isolate min-h-screen bg-[#070708] text-white font-body antialiased overflow-x-clip selection:bg-secondary/30">
        {/* Ambiente de color fijo (glows dorado/azul) → da profundidad y rompe el negro plano */}
        <div
          aria-hidden
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(50% 50% at 15% 18%, rgba(254,183,0,0.10), transparent 60%), radial-gradient(45% 50% at 85% 28%, rgba(15,43,128,0.26), transparent 60%), radial-gradient(45% 45% at 70% 88%, rgba(254,183,0,0.07), transparent 60%), radial-gradient(40% 40% at 25% 75%, rgba(15,43,128,0.16), transparent 60%)',
          }}
        />
        {/* ── NAV ── */}
        <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#070708]/85 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-5'}`}>
          <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Luxury Garage" className="w-8 h-8 object-contain" />
              <span className="brand-wordmark text-lg sm:text-xl">LUXURY GARAGE</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={scrollToPlans} className="hidden sm:inline-flex text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors px-3 py-2">
                Ver planes
              </button>
              <Pressable onClick={() => openMembershipForm()} className={`hidden sm:inline-flex ${cls.btnGold} text-[11px] sm:text-xs px-4 sm:px-5 py-2.5`}>
                <Crown size={15} /> Solicitar membresía
              </Pressable>
              <Pressable onClick={() => navigate('/login')} className={`${cls.btnGhost} text-[11px] sm:text-xs px-4 sm:px-5 py-2.5`}>
                <LogIn size={15} /> Iniciar sesión
              </Pressable>
            </div>
          </div>
        </header>

        {/* ── SECCIONES ── */}
        <main>
          <Hero onRequestMembership={() => openMembershipForm()} />
          <TrustMarquee />
          <ServiciosSection />
          <ProcesoSection />
          <DetailingVideoBand />
          <GallerySection />
          <Showcase3D />
          <BenefitsSection />
          <ConfianzaBand />
          <HowItWorksSection />
          <PlanesSection onRequestMembership={openMembershipForm} />
          <TestimoniosSection />
          <FaqSection />
          <AppPwaSection />

          {/* Franja CTA final — abre el cuestionario de membresía */}
          <section className="relative isolate py-28 lg:py-32 px-5 sm:px-6 text-center overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(254,183,0,0.10),transparent_70%)]" />
            <img src="/logo.png" alt="" className="w-16 h-16 lg:w-20 lg:h-20 object-contain mx-auto mb-6 drop-shadow-2xl" />
            <h2 className="font-headline text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-5 lg:max-w-3xl lg:mx-auto">
              Tu vehículo merece el club.
            </h2>
            <p className="text-slate-400 text-lg mb-9 max-w-xl mx-auto font-light">
              Sumate a Luxury Garage y viví el cuidado automotor premium desde tu celular.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Pressable onClick={() => openMembershipForm()} className={`${cls.btnGold} w-full sm:w-auto text-sm px-10 py-5`}>
                <Crown size={18} /> Solicitar membresía
              </Pressable>
              <Pressable onClick={() => navigate('/login')} className={`${cls.btnGhost} w-full sm:w-auto text-sm px-10 py-5`}>
                <LogIn size={18} /> Iniciar sesión
              </Pressable>
            </div>
          </section>

          <FooterSection />
        </main>

        {/* Cuestionario de solicitud de membresía (montado por otro agente) */}
        <MembershipRequestForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          source="landing"
          defaultPlan={formPlan}
        />

        {/* Widget de chat (se autoposiciona) */}
        <GhlChatWidget />
      </div>
    </SmoothScroll>
  );
}
