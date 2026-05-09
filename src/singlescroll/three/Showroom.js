// file location: src/singlescroll/three/Showroom.js
// Showroom scene built from REAL Humphries & Parks website imagery rather
// than abstract primitives:
//
//   - A backdrop plane showing the dealership storefront photo (dimmed)
//   - Four floating textured planes showing actual H&P cars (Swift, Vitara,
//     S-Cross, e-Vitara) — the same images served from humphriesandparks.net
//   - Subtle drift animation (each plane bobs on its own phase)
//   - Particle dust + soft red/white pinpoint lights for atmosphere
//   - HDRI environment so the planes pick up reflective tint at glancing
//     angles (not strictly necessary for unlit images, but it lifts the
//     scene's contrast)
//
// All animation runs in useFrame, so when the canvas's `frameloop` is set
// to "never" (idle / no-scroll) the whole scene freezes.

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Image as DreiImage, Sparkles, Environment } from "@react-three/drei";

// Three.js loads textures via an <img> tag with crossOrigin="anonymous",
// so remote URLs need CORS headers to be usable as WebGL textures — the
// humphriesandparks.net CDN does not send them. Route through our
// dedicated /api/img-proxy endpoint which serves the image same-origin
// with the right headers and is not subject to Next 16's image-optimizer
// quality/width restrictions. Adding a new upstream host? Add it to the
// ALLOWED_HOSTS allowlist in src/pages/api/img-proxy.js.
const proxy = (url) => `/api/img-proxy?url=${encodeURIComponent(url)}`;

const RAW_BACKDROP =
  "https://images.67degreescdn.co.uk/OxvrVgI7NLjSg9hGumadDgUC4eM=/459x500/smart/144/6/1738080472679900d86a1f5_p1123308-edit.jpg";

const RAW_CARS = [
  {
    url: "https://images.67degreescdn.co.uk/TFK7QKvuB5vSgQ8a4JwwCH48hzA=/459x/144/6/0e11e749a4f9f7b8c0d0_q2-2026-uk-swift_web_banner_1920x873px_v2.jpg",
    pos: [-2.4, 0.4, 0.5], rot: [0, 0.34, 0], scale: 1.7, phase: 0,
  },
  {
    url: "https://images.67degreescdn.co.uk/gyEfuN1I3-fOixzTQvMqg37i_HU=/459x/144/6/a0d5bf05ac46154454fe_q2-2026-uk-vitara_facelift-web_1920x873px.jpg",
    pos: [2.4, 0.6, 0.2], rot: [0, -0.34, 0], scale: 1.7, phase: 1.2,
  },
  {
    url: "https://images.67degreescdn.co.uk/hBhV9Gbp44dEsw52VTga7T9Pjrw=/459x/144/6/9c10a56552d3b2795a73_q2-2026-uk-s-cross_web-1920x873px_v2.jpg",
    pos: [-1.0, -0.7, -0.6], rot: [0, 0.2, 0], scale: 1.45, phase: 2.4,
  },
  {
    url: "https://images.67degreescdn.co.uk/afZfv58mznDRosA8FiLaIkM49fY=/459x/144/6/c8c7152a46ab73307016_q2-2026-uk-e-vitara_web-banner_1920x873px.jpg",
    pos: [1.0, 1.0, -0.5], rot: [0, -0.2, 0], scale: 1.45, phase: 3.6,
  },
];

const BACKDROP_URL = proxy(RAW_BACKDROP);
const CARS = RAW_CARS.map((c) => ({ ...c, url: proxy(c.url) }));

function FloatingCar({ url, pos, rot, scale, phase }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!ref.current) return;
    // Gentle bob + slight rotation drift on each panel's own phase.
    ref.current.position.y = pos[1] + Math.sin(t * 0.6 + phase) * 0.08;
    ref.current.rotation.y = rot[1] + Math.sin(t * 0.3 + phase) * 0.03;
  });
  return (
    <DreiImage
      ref={ref}
      url={url}
      position={pos}
      rotation={rot}
      scale={[scale * 1.6, scale * 0.9, 1]}
      transparent
      radius={0.08}
      toneMapped={false}
    />
  );
}

export default function Showroom({ lowQuality = false }) {
  return (
    <>
      {/* Soft fill */}
      <ambientLight intensity={0.55} />

      {/* Key light from above-front */}
      <directionalLight position={[3, 5, 4]} intensity={0.9} color="#ffffff" />

      {/* Red rim from behind to tint the back of the planes */}
      <pointLight position={[-3, 1.5, -3]} intensity={2.4} color="#ff3030" distance={11} />
      <pointLight position={[3, 1.5, -3]} intensity={1.6} color="#ff5050" distance={9} />

      {/* Dealership storefront — the "place" the cars sit in front of */}
      <DreiImage
        url={BACKDROP_URL}
        position={[0, 0.3, -4]}
        scale={[14, 8, 1]}
        transparent
        opacity={0.45}
        toneMapped={false}
      />

      {/* The four floating cars */}
      {CARS.map((car, i) => (
        <FloatingCar key={i} {...car} />
      ))}

      {/* Particle dust — premium atmosphere */}
      <Sparkles
        count={lowQuality ? 60 : 140}
        scale={[10, 5, 6]}
        size={2.4}
        speed={0.35}
        opacity={0.85}
        color="#ffffff"
        position={[0, 0.4, 0]}
      />
      <Sparkles
        count={lowQuality ? 30 : 80}
        scale={[8, 4, 5]}
        size={3.6}
        speed={0.25}
        opacity={1}
        color="#ff5050"
        position={[0, 0.4, 0]}
      />

      {/* HDRI for soft reflective tint at glancing angles */}
      {!lowQuality && <Environment preset="studio" />}
    </>
  );
}
