// file location: src/singlescroll/three/Showroom.js
// The 3D content of the hero scene — a "showroom" composition built from
// primitives (no external GLTF model needed):
//
//   - A polished circular reflective floor disc
//   - A glassy chrome TorusKnot centerpiece, slowly floating
//   - Three concentric orbiting chrome rings at different speeds + tilts
//   - A red glowing core sphere casting accent light
//   - <Sparkles> dust particle field
//   - <Environment preset="studio" /> for premium reflections
//
// All animation runs in useFrame (off the React render loop). Scroll progress
// (0..1) is read from a ref passed in via props so we don't re-render React
// every frame.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, Sparkles, Environment, ContactShadows, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

export default function Showroom({ scrollRef, lowQuality = false }) {
  const knotRef = useRef();
  const ringARef = useRef();
  const ringBRef = useRef();
  const ringCRef = useRef();
  const coreLightRef = useRef();

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const scroll = scrollRef?.current ?? 0;

    // Hero range = first ~12% of page scroll. Within that range we drive
    // local 0..1 so the camera/scene "ease into" the scrolled state without
    // continuing to react further down the page.
    const heroLocal = Math.min(1, scroll / 0.12);

    if (knotRef.current) {
      knotRef.current.rotation.x = t * 0.18 + heroLocal * 0.4;
      knotRef.current.rotation.y = t * 0.22 + heroLocal * 0.6;
    }

    if (ringARef.current) {
      ringARef.current.rotation.z = t * 0.28;
      ringARef.current.rotation.y = t * 0.14;
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * 0.22;
      ringBRef.current.rotation.x = t * 0.16;
    }
    if (ringCRef.current) {
      ringCRef.current.rotation.x = t * 0.34;
      ringCRef.current.rotation.y = -t * 0.18;
    }

    if (coreLightRef.current) {
      // Pulsing accent light — drives the bloom on the red core.
      coreLightRef.current.intensity = 6 + Math.sin(t * 1.6) * 1.2;
    }
  });

  return (
    <>
      {/* Soft fill so chrome isn't pitch black where the HDR doesn't reach */}
      <ambientLight intensity={0.25} />

      {/* Key light — directional, from above-front-left */}
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.4}
        color="#ffffff"
        castShadow={!lowQuality}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Red rim accent light from behind */}
      <pointLight position={[-3, 1.5, -3]} intensity={2.2} color="#ff2a2a" distance={10} />

      {/* Centerpiece: glassy chrome torus knot, gently floating.
          Low-quality devices get a cheaper standard material — same shape,
          a fraction of the GPU cost. */}
      <Float speed={1.6} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={knotRef} position={[0, 0.4, 0]} castShadow>
          <torusKnotGeometry args={[0.7, 0.22, lowQuality ? 120 : 220, lowQuality ? 24 : 32]} />
          {lowQuality ? (
            <meshStandardMaterial
              color="#fdf0f0"
              metalness={1}
              roughness={0.18}
              envMapIntensity={1.2}
            />
          ) : (
            <MeshTransmissionMaterial
              samples={8}
              resolution={512}
              thickness={0.6}
              roughness={0.05}
              anisotropy={0.6}
              chromaticAberration={0.04}
              ior={1.4}
              color="#ffffff"
              attenuationColor="#ff5050"
              attenuationDistance={0.6}
            />
          )}
        </mesh>
      </Float>

      {/* Glowing red core inside */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial
          emissive="#ff2020"
          emissiveIntensity={3.5}
          color="#ff2020"
          toneMapped={false}
        />
      </mesh>
      <pointLight ref={coreLightRef} position={[0, 0.4, 0]} color="#ff2020" intensity={6} distance={6} />

      {/* Three orbiting chrome rings at different tilts and radii */}
      <group ref={ringARef} position={[0, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.6, 0.012, 16, 96]} />
          <meshStandardMaterial color="#e8e8ec" metalness={1} roughness={0.18} />
        </mesh>
      </group>
      <group ref={ringBRef} position={[0, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[1.95, 0.008, 16, 96]} />
          <meshStandardMaterial color="#ffd9d9" metalness={1} roughness={0.22} />
        </mesh>
      </group>
      <group ref={ringCRef} position={[0, 0.4, 0]}>
        <mesh>
          <torusGeometry args={[2.3, 0.006, 16, 96]} />
          <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.3} />
        </mesh>
      </group>

      {/* Polished floor disc — chrome material, picks up red rim light */}
      <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.5, 64]} />
        <meshStandardMaterial
          color="#0d0d10"
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>

      {/* Soft contact shadow under the centerpiece */}
      {!lowQuality && (
        <ContactShadows
          position={[0, -0.69, 0]}
          opacity={0.55}
          scale={6}
          blur={2.4}
          far={3}
          color="#000"
        />
      )}

      {/* Particle dust — denser on capable devices */}
      <Sparkles
        count={lowQuality ? 60 : 140}
        scale={[8, 4, 6]}
        size={2.4}
        speed={0.35}
        opacity={0.9}
        color="#ffffff"
        position={[0, 0.4, 0]}
      />
      <Sparkles
        count={lowQuality ? 30 : 80}
        scale={[6, 3, 4]}
        size={3.5}
        speed={0.25}
        opacity={1}
        color="#ff4444"
        position={[0, 0.4, 0]}
      />

      {/* HDRI environment for chrome reflections — drei's built-in studio preset */}
      <Environment preset="studio" />
    </>
  );
}
