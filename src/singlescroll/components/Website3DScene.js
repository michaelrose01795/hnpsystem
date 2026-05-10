// file location: src/singlescroll/components/Website3DScene.js
// Master 3D showroom for the public single-scroll /website page.
//
// Improvements in this revision:
//   - Per-model auto-orientation: the longest horizontal axis of each
//     glTF is detected and the model rotated so the body always runs
//     front-to-back, regardless of how the author exported it.
//   - Frame-rate-independent exponential damping replaces the old
//     fixed-factor lerp. Scene transitions feel smooth at any refresh
//     rate without depending on the 60Hz tick.
//   - Subtler motion: the constant yaw drift is gone, the vertical
//     bob is reduced. Cars settle quietly when the user stops scrolling
//     instead of spinning gently in place.
//   - Subtle camera mouse parallax (±0.25 unit) adds dealership-style
//     depth without making the cars themselves react to the cursor.
//   - Per-section presets refined to FRAME cars beside / behind the
//     content cards rather than under them — service goes side-on like
//     a workshop bay, sell pushes the cars to the wings, contact
//     settles into a single hero car.
//   - The #cars chapter listens to the New / Used filter the top-nav
//     tabs lift into the gallery and switches the scene preset so the
//     cars on screen match the cars the user is browsing.
//   - On mobile, the canvas still renders but ScrollTrigger and the
//     bob/parallax animations are disabled — the scene shows a calm
//     static hero shot so the page stays usable and inexpensive.
//   - Per-car ErrorBoundary so a single missing/broken glTF doesn't
//     kill the rest of the scene.

import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Sparkles,
  useGLTF,
} from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { carModels } from "../models";
import useReducedMotion from "../hooks/useReducedMotion";
import useIs3DCapable from "../hooks/useIs3DCapable";
import styles from "../styles/singlescroll.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Section anchor ids the page exposes — must match the ids each chapter
// component renders. Order matches scroll order so back-tracking works.
const SECTION_IDS = [
  "top",
  "cars",
  "offers",
  "sell",
  "service",
  "motability",
  "about",
  "blog",
  "contact",
];

// ---------------------------------------------------------------------
// SCENE PRESETS
// ---------------------------------------------------------------------
// Each preset describes the camera + the four cars for one section.
//
// Layout intent for every section:
//   * cars sit OUTSIDE the centre column where the page text & cards
//     live, so they frame the content rather than block it
//   * rotation conveys what the section is about — head-on / 3-quarter
//     for showcase, side-on for service, focal for offers / contact
//   * receded cars use deeper z and smaller scale so they read as
//     atmospheric depth, not competing focal points

const PI_2 = Math.PI / 2;

const SCENES = {
  // Hero — showroom angle, slight 3/4 front. All four cars in a fan.
  top: {
    cameraPos: [0, 0.85, 6.4],
    cameraLookAt: [0, -0.2, 0],
    cars: {
      swift:     { position: [-2.2, -0.6, 0.6], scale: 1.0,  rotY:  0.55 },
      vitara:    { position: [-0.75, -0.6, 0.0], scale: 0.95, rotY:  0.25 },
      "s-cross": { position: [ 0.75, -0.6, 0.0], scale: 0.95, rotY: -0.25 },
      "a-cross": { position: [ 2.2, -0.6, 0.6], scale: 1.0,  rotY: -0.55 },
    },
  },

  // Cars (default / All) — closer; the front pair sits at the wings,
  // the rear pair tucks below the grid as ambient depth.
  cars: {
    cameraPos: [0, 0.55, 5.4],
    cameraLookAt: [0, -0.4, 0],
    cars: {
      swift:     { position: [-3.4, -0.55, 0.4], scale: 1.05, rotY:  0.65 },
      vitara:    { position: [-1.4, -1.7,  0.8], scale: 0.7,  rotY:  0.35 },
      "s-cross": { position: [ 1.4, -1.7,  0.8], scale: 0.7,  rotY: -0.35 },
      "a-cross": { position: [ 3.4, -0.55, 0.4], scale: 1.05, rotY: -0.65 },
    },
  },

  // Cars / New — focus on Swift + Across, push the others deep.
  cars_new: {
    cameraPos: [0, 0.55, 5.0],
    cameraLookAt: [0, -0.3, 0],
    cars: {
      swift:     { position: [-2.6, -0.55, 0.7], scale: 1.15, rotY:  0.55 },
      "a-cross": { position: [ 2.6, -0.55, 0.7], scale: 1.15, rotY: -0.55 },
      vitara:    { position: [-3.8,  0.4, -2.6], scale: 0.55, rotY:  0.50 },
      "s-cross": { position: [ 3.8,  0.4, -2.6], scale: 0.55, rotY: -0.50 },
    },
  },

  // Cars / Used — flip the focus to Vitara + S-Cross, recede the
  // others. Camera pulls back a touch and lifts so the used cars feel
  // grounded below the user.
  cars_used: {
    cameraPos: [0, 0.7, 5.4],
    cameraLookAt: [0, -0.4, 0],
    cars: {
      vitara:    { position: [-2.6, -0.55, 0.7], scale: 1.15, rotY:  0.55 },
      "s-cross": { position: [ 2.6, -0.55, 0.7], scale: 1.15, rotY: -0.55 },
      swift:     { position: [-3.8,  0.4, -2.6], scale: 0.55, rotY:  0.50 },
      "a-cross": { position: [ 3.8,  0.4, -2.6], scale: 0.55, rotY: -0.50 },
    },
  },

  // Offers — single hero focus on Swift, others recede deep.
  offers: {
    cameraPos: [-0.4, 0.4, 4.0],
    cameraLookAt: [0, -0.2, 0],
    cars: {
      swift:     { position: [ 0.0, -0.45,  0.6], scale: 1.45, rotY:  0.6 },
      vitara:    { position: [-3.6,  0.5, -2.6], scale: 0.55, rotY:  0.5 },
      "s-cross": { position: [ 3.6,  0.5, -2.6], scale: 0.55, rotY: -0.5 },
      "a-cross": { position: [ 0.2,  1.7, -3.6], scale: 0.5,  rotY:  0.0 },
    },
  },

  // Sell Your Car — three-step cards centre. Cars at the extreme
  // wings, low and angled inward like flanking display plinths.
  sell: {
    cameraPos: [0, 0.95, 5.6],
    cameraLookAt: [0, -0.2, 0],
    cars: {
      swift:     { position: [-3.7, -0.55,  0.0], scale: 0.95, rotY:  0.4 },
      vitara:    { position: [ 3.7, -0.55,  0.0], scale: 0.95, rotY: -0.4 },
      "s-cross": { position: [ 0.0,  1.9, -3.0], scale: 0.55, rotY:  0.0 },
      "a-cross": { position: [ 0.0, -1.9, -2.4], scale: 0.5,  rotY:  0.0 },
    },
  },

  // Service & Parts — workshop bay. Cars rotated side-on so the user
  // sees a profile silhouette, like a car parked on a service ramp.
  // Centre stays clear for the split image+text card.
  service: {
    cameraPos: [0, 0.55, 5.2],
    cameraLookAt: [0, -0.1, 0],
    cars: {
      swift:     { position: [-3.6, -0.55,  0.0], scale: 1.0, rotY:  PI_2 },
      vitara:    { position: [ 3.6, -0.55,  0.0], scale: 1.0, rotY: -PI_2 },
      "s-cross": { position: [ 0.0, -1.9, -2.6], scale: 0.5, rotY:  PI_2 },
      "a-cross": { position: [ 0.0,  1.9, -3.0], scale: 0.5, rotY: -PI_2 },
    },
  },

  // Motability — calmer, softer. Cars at gentle angles, slightly
  // raised so they feel approachable rather than displayed.
  motability: {
    cameraPos: [0, 0.7, 5.4],
    cameraLookAt: [0, -0.2, 0],
    cars: {
      swift:     { position: [-2.8, -0.5,  0.4], scale: 0.95, rotY:  0.35 },
      vitara:    { position: [ 2.8, -0.5,  0.4], scale: 0.95, rotY: -0.35 },
      "s-cross": { position: [ 0.0,  1.5, -3.2], scale: 0.5,  rotY:  0.0 },
      "a-cross": { position: [ 0.0, -1.7, -2.5], scale: 0.45, rotY:  0.0 },
    },
  },

  // About — pulled back, dramatic angle. Cars become a background
  // storytelling element behind the timeline / story chapter.
  about: {
    cameraPos: [1.4, 1.4, 7.4],
    cameraLookAt: [0, 0.0, 0],
    cars: {
      swift:     { position: [-2.6, -0.45, 0.3], scale: 0.95, rotY:  0.5 },
      vitara:    { position: [-0.85, -0.45, -0.3], scale: 0.9, rotY:  0.3 },
      "s-cross": { position: [ 0.85, -0.45, -0.3], scale: 0.9, rotY: -0.3 },
      "a-cross": { position: [ 2.6, -0.45, 0.3], scale: 0.95, rotY: -0.5 },
    },
  },

  // Blog — minimal car presence; all four sit at the deep edges so
  // the article cards in the foreground stay easy to read.
  blog: {
    cameraPos: [0, 1.0, 6.6],
    cameraLookAt: [0, 0.0, 0],
    cars: {
      swift:     { position: [-3.8,  0.4, -1.6], scale: 0.6, rotY:  0.5 },
      vitara:    { position: [ 3.8,  0.4, -1.6], scale: 0.6, rotY: -0.5 },
      "s-cross": { position: [ 0.0, -2.4, -2.6], scale: 0.45, rotY: 0.0 },
      "a-cross": { position: [ 0.0,  2.4, -3.0], scale: 0.45, rotY: 0.0 },
    },
  },

  // Contact — settled, single hero car. Camera lower / closer for a
  // dealership "final shot" feel.
  contact: {
    cameraPos: [0, 0.45, 4.4],
    cameraLookAt: [0, -0.2, 0],
    cars: {
      swift:     { position: [ 0.0, -0.55,  0.0], scale: 1.25, rotY:  0.55 },
      vitara:    { position: [-3.0,  0.0, -2.2], scale: 0.55, rotY:  0.40 },
      "s-cross": { position: [ 3.0,  0.0, -2.2], scale: 0.55, rotY: -0.40 },
      "a-cross": { position: [ 0.0,  1.7, -3.6], scale: 0.5,  rotY:  0.0 },
    },
  },
};

// Resolve the active scene preset given the section currently in view
// and the new/used filter the gallery is showing. The latter only
// matters while the cars chapter is active; everywhere else the
// section id alone picks the preset.
function pickScene(sectionId, filter) {
  if (sectionId === "cars") {
    if (filter === "new") return SCENES.cars_new;
    if (filter === "used") return SCENES.cars_used;
    return SCENES.cars;
  }
  return SCENES[sectionId] || SCENES.top;
}

// Preload every model on client module-load so they fetch in parallel.
if (typeof window !== "undefined") {
  carModels.forEach((m) => useGLTF.preload(m.url));
}

// Target diagonal (in world units) every car normalises to before the
// per-scene `scale` value applies. Different Sketchfab authors export
// at different unit scales, so without this only the cars that happen
// to use sensible units would be visible.
const TARGET_DIAGONAL = 3.4;

// Sketchfab exports often include stray helper meshes (ground planes,
// lights, environment props) authored at a wildly different scale to
// the body. Including them in the model's AABB drags the
// normalisation factor toward the outliers and shrinks the actual car
// to nothing. We compare each mesh's world-space AABB diagonal to the
// median; meshes more than this many times the median count as
// outliers and are hidden + excluded from the AABB.
const OUTLIER_RATIO = 6;

// Damping `lambda` for frame-rate-independent transitions. Higher =
// snappier. λ=3 reaches ~95% in one second.
const DAMP = 3;

// ---------------------------------------------------------------------
// CAR INSTANCE
// ---------------------------------------------------------------------
// Wraps one glTF model. Computes (once) a base scale, centre offset
// and orientation fix from the filtered AABB so every model normalises
// to the same on-screen footprint and faces the same direction
// regardless of how it was authored.

function CarInstance({ url, slug, sceneRef, manifest, motion, reduced, phase }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef();

  const { baseScale, centerOffset, orientationFix } = useMemo(() => {
    scene.updateMatrixWorld(true);

    const meshes = [];
    scene.traverse((o) => {
      if (o.isMesh && o.geometry) meshes.push(o);
    });

    const boxes = meshes.map((m) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    });

    const sizeBuf = new THREE.Vector3();
    const diagonals = boxes.map((b) => b.getSize(sizeBuf).length());

    let cap = Infinity;
    if (diagonals.length > 1) {
      const sorted = [...diagonals].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      if (median > 0) cap = median * OUTLIER_RATIO;
    }

    meshes.forEach((m, i) => {
      if (diagonals[i] > cap) m.visible = false;
    });

    const aggregate = new THREE.Box3();
    boxes.forEach((b, i) => {
      if (diagonals[i] <= cap) aggregate.union(b);
    });
    if (aggregate.isEmpty()) aggregate.setFromObject(scene);

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    aggregate.getSize(size);
    aggregate.getCenter(center);

    const diagonal = size.length();
    const s = diagonal > 1e-6 ? TARGET_DIAGONAL / diagonal : 1;

    // Orientation: align the long horizontal axis with Z so the body
    // runs front-to-back in scene-local space. If x is the longer
    // axis, rotate 90°. Manifest can override entirely.
    let rot = 0;
    if (manifest?.orientationFix !== null && manifest?.orientationFix !== undefined) {
      rot = manifest.orientationFix;
    } else if (size.x > size.z * 1.25) {
      rot = PI_2;
    }

    return {
      baseScale: s,
      centerOffset: [-center.x, -center.y, -center.z],
      orientationFix: rot,
    };
  }, [scene, manifest]);

  useFrame((state, delta) => {
    const target = sceneRef.current?.cars?.[slug];
    if (!groupRef.current || !target) return;

    // Frame-rate-independent damping. Reduced motion = instant snap.
    const dt = Math.min(delta, 0.05);
    const k = reduced ? 1 : 1 - Math.exp(-DAMP * dt);

    const t = state.clock.elapsedTime;
    const bob = motion ? Math.sin(t * 0.5 + phase) * 0.018 : 0;

    const tx = target.position[0];
    const ty = target.position[1] + bob;
    const tz = target.position[2];

    const g = groupRef.current;
    g.position.x = THREE.MathUtils.lerp(g.position.x, tx, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, ty, k);
    g.position.z = THREE.MathUtils.lerp(g.position.z, tz, k);

    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, target.rotY, k);

    const targetScale = target.scale * baseScale;
    const sc = THREE.MathUtils.lerp(g.scale.x, targetScale, k);
    g.scale.set(sc, sc, sc);
  });

  return (
    <group ref={groupRef}>
      <group rotation={[0, orientationFix, 0]}>
        <primitive object={scene} position={centerOffset} />
      </group>
    </group>
  );
}

// Catch a single bad model without nuking the rest of the scene.
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    if (typeof console !== "undefined") {
      console.warn("[Website3DScene] glTF failed to load:", err);
    }
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// ---------------------------------------------------------------------
// SCENE CONTROLLER
// ---------------------------------------------------------------------
// Lerps the camera + lookAt every frame and applies the optional
// mouse-parallax offset. Also owns the scene lights, sparkles and
// shadow plane so the canvas only mounts one of each.

function SceneController({ sceneRef, lowQuality, reduced, motion, mouseRef }) {
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));
  const camTargetBuf = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const target = sceneRef.current;
    if (!target) return;

    const dt = Math.min(delta, 0.05);
    const k = reduced ? 1 : 1 - Math.exp(-DAMP * dt);

    const [cx, cy, cz] = target.cameraPos;
    const mx = motion ? mouseRef.current.x * 0.25 : 0;
    const my = motion ? mouseRef.current.y * 0.15 : 0;

    camTargetBuf.current.set(cx + mx, cy + my, cz);
    state.camera.position.lerp(camTargetBuf.current, k);

    const [lx, ly, lz] = target.cameraLookAt;
    lookAt.current.x = THREE.MathUtils.lerp(lookAt.current.x, lx, k);
    lookAt.current.y = THREE.MathUtils.lerp(lookAt.current.y, ly, k);
    lookAt.current.z = THREE.MathUtils.lerp(lookAt.current.z, lz, k);
    state.camera.lookAt(lookAt.current);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} color="#ffffff" />
      <pointLight position={[-3, 1.5, -3]} intensity={2.4} color="#ff3030" distance={11} />
      <pointLight position={[ 3, 1.5, -3]} intensity={1.6} color="#ff5050" distance={9} />

      {carModels.map((m, i) => (
        <ModelErrorBoundary key={m.slug}>
          <Suspense fallback={null}>
            <CarInstance
              url={m.url}
              slug={m.slug}
              manifest={m}
              sceneRef={sceneRef}
              phase={i * 1.2}
              motion={motion}
              reduced={reduced}
            />
          </Suspense>
        </ModelErrorBoundary>
      ))}

      <Sparkles
        count={lowQuality ? 60 : 140}
        scale={[10, 5, 6]}
        size={2.4}
        speed={0.3}
        opacity={0.85}
        color="#ffffff"
        position={[0, 0.4, 0]}
      />
      <Sparkles
        count={lowQuality ? 30 : 80}
        scale={[8, 4, 5]}
        size={3.6}
        speed={0.2}
        opacity={1}
        color="#ff5050"
        position={[0, 0.4, 0]}
      />

      {!lowQuality && <Environment preset="studio" />}

      <ContactShadows
        position={[0, -1.4, 0]}
        opacity={0.45}
        scale={14}
        blur={2.4}
        far={5}
      />
    </>
  );
}

// ---------------------------------------------------------------------
// PUBLIC COMPONENT
// ---------------------------------------------------------------------

export default function Website3DScene({ galleryFilter = "all" } = {}) {
  const reduced = useReducedMotion();
  const { capable, lowQuality } = useIs3DCapable();
  const [isMobile, setIsMobile] = useState(false);

  // Refs the canvas reads every frame. We update sceneRef from
  // ScrollTrigger / prop changes WITHOUT triggering a React render —
  // the canvas pulls the latest target on its own clock.
  const sceneRef = useRef(SCENES.top);
  const activeSection = useRef("top");
  const filterRef = useRef(galleryFilter);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Pull the latest scene target whenever section or filter changes.
  // Defined inline so the effects below can call it.
  const applyScene = () => {
    sceneRef.current = pickScene(activeSection.current, filterRef.current);
  };

  // Mobile gate — small viewports drop the scroll-driven scene
  // switching but still render a static hero version of the showroom.
  // Returning null entirely would leave a flat black backdrop on
  // phones, which feels worse than a calm static car shot.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  // Mouse parallax — driven from a ref so it doesn't re-render the
  // component tree. Sample is consumed once per frame by SceneController.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMobile || reduced) {
      mouseRef.current.x = 0;
      mouseRef.current.y = 0;
      return undefined;
    }
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [isMobile, reduced]);

  // Whenever the gallery filter changes (top-nav New / Used tab), pull
  // the matching cars chapter preset.
  useEffect(() => {
    filterRef.current = galleryFilter;
    applyScene();
  }, [galleryFilter]);

  // ScrollTrigger — switch scene preset when each section reaches the
  // viewport centre. Triggers update sceneRef directly so the canvas
  // doesn't re-render on every scroll change.
  useEffect(() => {
    if (!capable || isMobile) return;

    const triggers = SECTION_IDS.map((id) =>
      ScrollTrigger.create({
        trigger: `#${id}`,
        start: "top 60%",
        end: "bottom 40%",
        onEnter: () => {
          activeSection.current = id;
          applyScene();
        },
        onEnterBack: () => {
          activeSection.current = id;
          applyScene();
        },
      }),
    );

    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => triggers.forEach((t) => t.kill());
  }, [capable, isMobile]);

  // Bail entirely only when WebGL itself is unavailable. Reduced
  // motion and mobile both still get the canvas — they just see a
  // static / simplified version.
  if (!capable) return null;

  // motion = full bobs, drift, parallax. Mobile + reduced motion both
  // suppress those so the scene stays calm.
  const motion = !reduced && !isMobile;

  return (
    <div className={styles.bg3d} aria-hidden="true">
      <Canvas
        dpr={lowQuality || isMobile ? [1, 1.2] : [1, 1.6]}
        camera={{ position: [0, 0.85, 6.4], fov: 36 }}
        gl={{
          antialias: !lowQuality && !isMobile,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#06060a"]} />
        <fog attach="fog" args={["#06060a", 7, 18]} />

        <Suspense fallback={null}>
          <SceneController
            sceneRef={sceneRef}
            lowQuality={lowQuality || isMobile}
            reduced={reduced}
            motion={motion}
            mouseRef={mouseRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
