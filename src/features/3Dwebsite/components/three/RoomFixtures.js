// file location: src/features/3Dwebsite/components/three/RoomFixtures.js
// Every room's 3D contents — furniture, fittings, vehicles and the animated
// actors (spray gun, sponge). All positions are LOCAL to the room centre; the
// scene wraps each room in a group placed at the room's X position.
//
// Default export `RoomContent` switches on the room index so the scene can
// render any room with one component.

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, stageReveal } from "@/features/3Dwebsite/data/threeDWebsiteMockData";
import SimpleCar from "./SimpleCar";
import Mechanic from "./Mechanic";

const FLOOR_CAR_Y = 0; // a car resting on the room floor

/* ======================================================================== */
/*  Shared static primitives                                                 */
/* ======================================================================== */

function Desk({ position = [0, 0, 0], rotation = [0, 0, 0], width = 3.2, frontColor = PALETTE.red }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[width, 1.0, 1.1]} radius={0.06} smoothness={2} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.06, 0.5]} castShadow>
        <boxGeometry args={[width + 0.1, 0.86, 0.12]} />
        <meshStandardMaterial color={frontColor} roughness={0.5} />
      </mesh>
      <RoundedBox args={[width + 0.4, 0.1, 1.3]} radius={0.04} smoothness={2} position={[0, 1.05, 0]} castShadow>
        <meshStandardMaterial color="#f3f3f5" roughness={0.4} />
      </RoundedBox>
      <mesh position={[width * 0.28, 1.42, -0.1]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.66, 0.4, 0.05]} />
        <meshStandardMaterial color={PALETTE.glass} metalness={0.3} roughness={0.2} />
      </mesh>
    </group>
  );
}

function SignPanel({ position = [0, 2.7, -5.32] }) {
  return (
    <group position={position}>
      <RoundedBox args={[4.6, 1.7, 0.16]} radius={0.05} smoothness={2}>
        <meshStandardMaterial color={PALETTE.red} roughness={0.45} />
      </RoundedBox>
      <mesh position={[-1.2, 0, 0.1]}>
        <boxGeometry args={[1.0, 1.0, 0.06]} />
        <meshStandardMaterial color="#fff" roughness={0.5} />
      </mesh>
      <mesh position={[0.55, 0.18, 0.1]}>
        <boxGeometry args={[2.4, 0.34, 0.05]} />
        <meshStandardMaterial color="#fff" roughness={0.5} />
      </mesh>
      <mesh position={[0.2, -0.32, 0.1]}>
        <boxGeometry args={[1.7, 0.2, 0.05]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Seat({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.9, 0.3, 0.85]} radius={0.1} smoothness={2} position={[0, 0.45, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.7} />
      </RoundedBox>
      <RoundedBox args={[0.9, 0.7, 0.22]} radius={0.1} smoothness={2} position={[0, 0.8, -0.32]} castShadow>
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.1, 14]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.7} roughness={0.35} />
      </mesh>
    </group>
  );
}

function FloorRug({ position = [0, 0.02, 0], size = [4, 3], color = "#d9d9de" }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

function Pylon({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.5, 2.8, 0.5]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
      </mesh>
      <RoundedBox args={[0.72, 0.95, 0.72]} radius={0.06} smoothness={2} position={[0, 2.5, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.red} roughness={0.4} />
      </RoundedBox>
    </group>
  );
}

function Podium({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.2, 3.4, 0.32, 40]} />
        <meshStandardMaterial color="#101116" metalness={0.4} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.95, 0.06, 10, 48]} />
        <meshStandardMaterial color={PALETTE.redBright} emissive={PALETTE.red} emissiveIntensity={1.3} />
      </mesh>
    </group>
  );
}

function RampRig({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {[-1.95, 1.95].map((x) => (
        <mesh key={x} position={[x, 0.735, 0]} castShadow>
          <boxGeometry args={[0.46, 1.47, 0.5]} />
          <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
        </mesh>
      ))}
      {[-1.95, 1.95].map((x) => (
        <mesh key={`b${x}`} position={[x, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.1, 1.4]} />
          <meshStandardMaterial color={PALETTE.charcoal} roughness={0.7} />
        </mesh>
      ))}
      {[-1.3, 1.3].map((z) => (
        <RoundedBox key={z} args={[5.0, 0.26, 0.78]} radius={0.05} smoothness={2} position={[0, 1.6, z]} castShadow receiveShadow>
          <meshStandardMaterial color="#3a3c44" metalness={0.3} roughness={0.6} />
        </RoundedBox>
      ))}
    </group>
  );
}

function ToolCabinet({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.7, 1.9, 0.8]} radius={0.06} smoothness={2} position={[0, 0.95, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.red} roughness={0.45} />
      </RoundedBox>
      {[0.3, 0.85, 1.4].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0.42]}>
            <boxGeometry args={[1.45, 0.36, 0.04]} />
            <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
          </mesh>
          <mesh position={[0, y, 0.46]}>
            <boxGeometry args={[0.6, 0.07, 0.06]} />
            <meshStandardMaterial color={PALETTE.chrome} metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TyreStack({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {[0.32, 0.66, 1.0].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.5, 0.22, 12, 24]} />
          <meshStandardMaterial color={PALETTE.tyre} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function PartsRack({ position = [0, 0, 0] }) {
  const parcelColors = [PALETTE.red, "#e9e9ec", PALETTE.charcoal, "#e9e9ec", PALETTE.red];
  return (
    <group position={position}>
      {[-1.65, 1.65].map((x) => (
        <mesh key={x} position={[x, 1.3, 0]} castShadow>
          <boxGeometry args={[0.14, 2.6, 0.7]} />
          <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
        </mesh>
      ))}
      {[0.5, 1.3, 2.1].map((y, shelfIdx) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.4, 0.1, 0.74]} />
            <meshStandardMaterial color="#9a9ca3" metalness={0.3} roughness={0.6} />
          </mesh>
          {[-1.0, -0.1, 0.85].map((x, boxIdx) => (
            <mesh key={x} position={[x, y + 0.27, 0]} castShadow>
              <boxGeometry args={[0.6, 0.44, 0.5]} />
              <meshStandardMaterial color={parcelColors[(shelfIdx * 3 + boxIdx) % parcelColors.length]} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function BoothFrame({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {[
        [-3.2, -2.6],
        [3.2, -2.6],
        [-3.2, 2.6],
        [3.2, 2.6],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 1.9, z]} castShadow>
          <boxGeometry args={[0.18, 3.8, 0.18]} />
          <meshStandardMaterial color="#c9cace" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {[-2.6, 2.6].map((z) => (
        <mesh key={z} position={[0, 3.7, z]} castShadow>
          <boxGeometry args={[6.6, 0.16, 0.16]} />
          <meshStandardMaterial color="#c9cace" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {[-2.6, 2.6].map((z) => (
        <mesh key={`l${z}`} position={[0, 3.55, z]}>
          <boxGeometry args={[5.6, 0.12, 0.5]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Bucket({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.32, 0.64, 18]} />
        <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.06, 18]} />
        <meshStandardMaterial color="#cfe6f2" metalness={0.2} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Counter({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[3.6, 1.05, 0.9]} radius={0.05} smoothness={2} position={[0, 0.52, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e7e7ea" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.1, 0.4]} castShadow>
        <boxGeometry args={[3.5, 0.86, 0.1]} />
        <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ======================================================================== */
/*  Animated actors                                                          */
/* ======================================================================== */

// Spray gun — sweeps across the smart-repair panel as stage 5 reveals.
function SprayGun({ scrollRef, reducedMotion, stageIndex = 4 }) {
  const gunRef = useRef();
  const mistRef = useRef();
  useFrame(() => {
    const sf = scrollRef?.current?.stageFloat ?? stageIndex;
    const reveal = reducedMotion ? 1 : stageReveal(sf, stageIndex);
    if (gunRef.current) gunRef.current.position.x = THREE.MathUtils.lerp(-1.6, 1.1, reveal);
    if (mistRef.current) {
      mistRef.current.material.opacity = !reducedMotion && reveal > 0.05 && reveal < 0.97 ? 0.4 : 0;
    }
  });
  return (
    <group ref={gunRef} position={[-1.6, 1.2, 2.25]}>
      <mesh rotation={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[0.18, 0.18, 0.52]} />
        <meshStandardMaterial color={PALETTE.charcoal} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.24, 0.04]} castShadow>
        <boxGeometry args={[0.13, 0.34, 0.13]} />
        <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 0.2, 14]} />
        <meshStandardMaterial color={PALETTE.chrome} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh ref={mistRef} position={[0, 0, -0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.1, 18, 1, true]} />
        <meshStandardMaterial color={PALETTE.carGrey} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Sponge — wipes across the valet car as stage 6 reveals (dirt washes off).
function Sponge({ scrollRef, reducedMotion, stageIndex = 5 }) {
  const ref = useRef();
  useFrame(() => {
    const sf = scrollRef?.current?.stageFloat ?? stageIndex;
    const reveal = reducedMotion ? 1 : stageReveal(sf, stageIndex);
    if (ref.current) {
      ref.current.position.x = THREE.MathUtils.lerp(-2.5, 2.5, reveal);
      ref.current.position.y = 1.34 + (reducedMotion ? 0 : Math.sin(reveal * Math.PI * 6) * 0.16);
    }
  });
  return (
    <group ref={ref} position={[-2.5, 1.34, 1.55]}>
      <RoundedBox args={[0.52, 0.26, 0.44]} radius={0.1} smoothness={2} castShadow>
        <meshStandardMaterial color="#f2c94c" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, -0.18, 0]}>
        <boxGeometry args={[0.48, 0.12, 0.4]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </mesh>
    </group>
  );
}

/* ======================================================================== */
/*  Room compositions                                                        */
/* ======================================================================== */

function EntryRoom() {
  return (
    <group>
      <SignPanel />
      <FloorRug position={[0, 0.03, 2.4]} size={[6.2, 4.2]} color="#dedee3" />
      <Desk position={[-0.4, 0, -1.9]} width={3.4} />
      <Seat position={[3.4, 0, 1.6]} rotation={[0, -0.5, 0]} />
      <Seat position={[4.4, 0, 0.3]} rotation={[0, -0.9, 0]} />
      <Pylon position={[-4.8, 0, 0.6]} />
      <mesh position={[5.2, 0.4, -3.6]} castShadow>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
      </mesh>
    </group>
  );
}

function SalesRoom() {
  return (
    <group>
      <Podium position={[0, 0, -0.6]} />
      <SimpleCar position={[0, 0.32, -0.6]} rotation={[0, -0.6, 0]} bodyColor={PALETTE.carRed} effect="spin" />
      <pointLight position={[0, 4.4, 1.4]} intensity={26} distance={16} decay={2} color="#ffe9d4" />
      <pointLight position={[-3, 3.6, -2]} intensity={14} distance={13} decay={2} color="#ffffff" />
      {[-2.4, 0, 2.4].map((x) => (
        <mesh key={x} position={[x, 4.3, -0.6]}>
          <cylinderGeometry args={[0.26, 0.26, 0.14, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.1} />
        </mesh>
      ))}
      <Desk position={[4.6, 0, 2.2]} rotation={[0, -0.8, 0]} width={2.4} />
      <FloorRug position={[0, 0.03, -0.6]} size={[8.4, 8.4]} color="#191a20" />
    </group>
  );
}

function WorkshopRoom({ scrollRef, reducedMotion }) {
  return (
    <group>
      <RampRig position={[0, 0, 0]} />
      <SimpleCar position={[0, 1.73, 0]} bodyColor={PALETTE.carGrey} effect="static" />
      <Mechanic position={[2.9, 0, 1.9]} rotation={[0, Math.PI / 2, 0]} reducedMotion={reducedMotion} />
      <ToolCabinet position={[-4.5, 0, -4.3]} />
      <TyreStack position={[4.7, 0, -4.2]} />
      <mesh position={[-2.4, 0.2, 3.4]} castShadow>
        <boxGeometry args={[1.1, 0.4, 0.6]} />
        <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
      </mesh>
      <FloorRug position={[0, 0.03, 0]} size={[7, 5]} color="#3b3d46" />
    </group>
  );
}

function PartsRoom({ scrollRef, reducedMotion }) {
  return (
    <group>
      <PartsRack position={[-3.0, 0, -4.6]} />
      <PartsRack position={[2.6, 0, -4.6]} />
      <Counter position={[4.8, 0, 1.6]} rotation={[0, -1.0, 0]} />
      <SimpleCar
        position={[-0.4, FLOOR_CAR_Y, 0.7]}
        rotation={[0, -0.35, 0]}
        bodyColor={PALETTE.carGrey}
        effect="explode"
        stageIndex={3}
        scrollRef={scrollRef}
        reducedMotion={reducedMotion}
      />
      <FloorRug position={[-0.4, 0.03, 0.7]} size={[6.4, 5]} color="#cdced3" />
    </group>
  );
}

function SmartRepairRoom({ scrollRef, reducedMotion }) {
  return (
    <group>
      <BoothFrame position={[0, 0, 0.3]} />
      <pointLight position={[0, 3.4, 1.6]} intensity={20} distance={13} decay={2} color="#eef3ff" />
      <SimpleCar
        position={[0, FLOOR_CAR_Y, 0.4]}
        bodyColor={PALETTE.carGrey}
        effect="static"
        repairPanel
        stageIndex={4}
        scrollRef={scrollRef}
        reducedMotion={reducedMotion}
      />
      <SprayGun scrollRef={scrollRef} reducedMotion={reducedMotion} stageIndex={4} />
      <group position={[3.7, 0, 2.3]}>
        <RoundedBox args={[1.0, 0.7, 0.7]} radius={0.05} smoothness={2} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
        </RoundedBox>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 14]} />
          <meshStandardMaterial color={PALETTE.red} roughness={0.5} />
        </mesh>
      </group>
      <FloorRug position={[0, 0.03, 0.4]} size={[7, 5.4]} color="#e2e2e7" />
    </group>
  );
}

function ValetRoom({ scrollRef, reducedMotion }) {
  return (
    <group>
      <SimpleCar
        position={[0, FLOOR_CAR_Y, 0.6]}
        rotation={[0, -0.2, 0]}
        bodyColor={PALETTE.carGrey}
        effect="grime"
        stageIndex={5}
        scrollRef={scrollRef}
        reducedMotion={reducedMotion}
      />
      <Sponge scrollRef={scrollRef} reducedMotion={reducedMotion} stageIndex={5} />
      <Bucket position={[3.4, 0, 2.6]} />
      <Bucket position={[-3.8, 0, 2.2]} />
      <mesh position={[-4.9, 1.7, -3.5]} castShadow>
        <torusGeometry args={[0.6, 0.16, 10, 22]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
      </mesh>
      <FloorRug position={[0, 0.03, 0.6]} size={[7.4, 5.4]} color="#30323b" />
    </group>
  );
}

function CollectionRoom({ scrollRef, reducedMotion }) {
  return (
    <group>
      <SimpleCar
        position={[-2.6, FLOOR_CAR_Y, 0.8]}
        bodyColor={PALETTE.carGrey}
        effect="driveOff"
        stageIndex={6}
        scrollRef={scrollRef}
        reducedMotion={reducedMotion}
      />
      <Counter position={[-4.6, 0, -2.0]} rotation={[0, 0.7, 0]} />
      {/* Key on the counter */}
      <group position={[-4.4, 1.12, -1.8]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.04, 0.26]} />
          <meshStandardMaterial color={PALETTE.charcoal} roughness={0.5} />
        </mesh>
        <mesh position={[0.16, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 12]} />
          <meshStandardMaterial color={PALETTE.red} roughness={0.4} />
        </mesh>
      </group>
      {/* Way-out arrow on the floor pointing toward the exit */}
      {[2.0, 3.4, 4.8].map((x, i) => (
        <mesh key={x} position={[x, 0.05, 2.6]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
          <planeGeometry args={[0.5 - i * 0.05, 0.5 - i * 0.05]} />
          <meshStandardMaterial color={PALETTE.red} roughness={0.8} transparent opacity={0.75} />
        </mesh>
      ))}
      <Pylon position={[5.0, 0, -3.6]} />
      <FloorRug position={[0, 0.03, 1.4]} size={[8, 4]} color="#dedee3" />
    </group>
  );
}

const ROOMS = [EntryRoom, SalesRoom, WorkshopRoom, PartsRoom, SmartRepairRoom, ValetRoom, CollectionRoom];

export default function RoomContent({ index, scrollRef, reducedMotion }) {
  const Room = ROOMS[index];
  if (!Room) return null;
  return <Room scrollRef={scrollRef} reducedMotion={reducedMotion} />;
}
