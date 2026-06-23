/**
 * Escena 3D premium (React Three Fiber) — pieza "wow" de la landing.
 * Blob metálico dorado distorsionado + anillo orbitando + bloom, sobre fondo
 * transparente (se funde con el degradé de la sección).
 *
 * IMPORTANTE: este archivo importa three/R3F/drei/postprocessing. Se carga SIEMPRE
 * con React.lazy + Suspense y se monta SOLO en desktop con buena GPU y sin
 * prefers-reduced-motion (el padre decide). Así three (~600KB) no entra al
 * critical path. Entorno de luz autocontenido (Lightformers, sin HDRI externo).
 */
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, Lightformer, ContactShadows, MeshDistortMaterial } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { Mesh } from 'three';

function GoldBlob() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.18;
    ref.current.rotation.x += dt * 0.05;
  });
  return (
    <Float speed={1.3} rotationIntensity={0.5} floatIntensity={1.1}>
      <mesh ref={ref} scale={1.55}>
        <icosahedronGeometry args={[1, 16]} />
        <MeshDistortMaterial
          color="#feb700"
          metalness={1}
          roughness={0.16}
          distort={0.3}
          speed={1.5}
          envMapIntensity={1.5}
        />
      </mesh>
    </Float>
  );
}

function OrbitRing() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * 0.14;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.1, 0, 0]} scale={2.7}>
      <torusGeometry args={[1, 0.012, 16, 140]} />
      <meshStandardMaterial color="#f8d987" metalness={1} roughness={0.25} emissive="#241900" emissiveIntensity={0.6} />
    </mesh>
  );
}

export default function Scene3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.35} />
      <spotLight position={[6, 6, 6]} intensity={45} angle={0.4} penumbra={1} color="#fff3c8" />
      <spotLight position={[-6, -2, 4]} intensity={20} angle={0.5} penumbra={1} color="#e7b84d" />

      <GoldBlob />
      <OrbitRing />

      <ContactShadows position={[0, -2.3, 0]} opacity={0.5} scale={14} blur={2.8} far={4.5} color="#000000" />

      {/* Entorno de reflexión autocontenido (sin archivo HDRI externo). */}
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 3, 3]} scale={[6, 6, 1]} color="#fff3c8" />
        <Lightformer intensity={1.4} position={[-4, 1, -3]} scale={[5, 5, 1]} color="#e7b84d" />
        <Lightformer intensity={1.1} position={[4, -2, 2]} scale={[4, 4, 1]} color="#ffffff" />
      </Environment>

      <EffectComposer>
        <Bloom intensity={0.75} luminanceThreshold={0.5} luminanceSmoothing={0.32} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
