import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

export type Phase = 'idle' | 'opening' | 'bursting' | 'orbiting';

/**
 * Exact cubic-bezier(x1, y1, x2, y2) solver using Newton-Raphson iteration
 * Used for cubic-bezier(0.34, 1.56, 0.64, 1) door overshoot easing.
 */
function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const sampleCurveX = (t: number) => ((1 - 3 * x2 + 3 * x1) * t * t * t) + ((3 * x2 - 6 * x1) * t * t) + (3 * x1 * t);
  const sampleCurveY = (t: number) => ((1 - 3 * y2 + 3 * y1) * t * t * t) + ((3 * y2 - 6 * y1) * t * t) + (3 * y1 * t);
  const sampleCurveDerivativeX = (t: number) => (3 * (1 - 3 * x2 + 3 * x1) * t * t) + (2 * (3 * x2 - 6 * x1) * t) + (3 * x1);

  let t2 = x;
  for (let i = 0; i < 8; i++) {
    const xEst = sampleCurveX(t2) - x;
    if (Math.abs(xEst) < 1e-6) break;
    const d2 = sampleCurveDerivativeX(t2);
    if (Math.abs(d2) < 1e-6) break;
    t2 = t2 - xEst / d2;
  }

  return sampleCurveY(Math.max(0, Math.min(1, t2)));
}

function doorOvershootEase(t: number): number {
  return solveCubicBezier(0.34, 1.56, 0.64, 1, t);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface FoodItemConfig {
  id: string;
  name: string;
  recipeHint: string;
  shape: 'sphere' | 'cylinder' | 'box' | 'cone';
  color: THREE.Color;
  accentColor?: THREE.Color;
  scale: [number, number, number];
  startPos: THREE.Vector3;
  velocity: THREE.Vector3;
  orbitAngle: number;
  orbitRadius: number;
  orbitY: number;
  staggerDelay: number; // in seconds (80-120ms steps)
  rotSpeed: [number, number, number];
  floatPhase: number;
}

const FOOD_ITEMS_DATA: Array<{
  id: string;
  name: string;
  recipeHint: string;
  shape: 'sphere' | 'cylinder' | 'box' | 'cone';
  hex: string;
  accentHex?: string;
  scale: [number, number, number];
  shelfY: number;
}> = [
  {
    id: 'tomato',
    name: 'Vine Tomato',
    recipeHint: 'Roasted Pomodoro & Burrata Pasta',
    shape: 'sphere',
    hex: '#ef4444',
    accentHex: '#22c55e',
    scale: [0.22, 0.2, 0.22],
    shelfY: 0.45,
  },
  {
    id: 'egg',
    name: 'Pasture Egg',
    recipeHint: 'Cloud Eggs with Chili Crisp',
    shape: 'sphere',
    hex: '#fef3c7',
    scale: [0.16, 0.22, 0.16],
    shelfY: 0.52,
  },
  {
    id: 'milk',
    name: 'Oat Milk Carton',
    recipeHint: 'Golden Turmeric Velvet Latte',
    shape: 'box',
    hex: '#f8fafc',
    accentHex: '#38bdf8',
    scale: [0.28, 0.52, 0.28],
    shelfY: 0.1,
  },
  {
    id: 'cheese',
    name: 'Aged Cheddar Wedge',
    recipeHint: 'Caramelized Shallot Gruyère Tart',
    shape: 'box',
    hex: '#facc15',
    accentHex: '#eab308',
    scale: [0.34, 0.2, 0.28],
    shelfY: 0.05,
  },
  {
    id: 'carrot',
    name: 'Heirloom Carrot',
    recipeHint: 'Harissa Honey Glazed Carrots',
    shape: 'cylinder',
    hex: '#f97316',
    accentHex: '#16a34a',
    scale: [0.09, 0.48, 0.09],
    shelfY: -0.35,
  },
  {
    id: 'lettuce',
    name: 'Crisp Romaine',
    recipeHint: 'Charred Caesar with Crispy Capers',
    shape: 'sphere',
    hex: '#4ade80',
    accentHex: '#86efac',
    scale: [0.28, 0.25, 0.26],
    shelfY: -0.42,
  },
  {
    id: 'apple',
    name: 'Honeycrisp Apple',
    recipeHint: 'Fennel & Apple Slaw with Cider Vinaigrette',
    shape: 'sphere',
    hex: '#dc2626',
    accentHex: '#fbbf24',
    scale: [0.21, 0.22, 0.21],
    shelfY: 0.48,
  },
  {
    id: 'broccoli',
    name: 'Broccoli Crown',
    recipeHint: 'Garlic Charred Broccoli & Tahini Bowl',
    shape: 'cone',
    hex: '#15803d',
    accentHex: '#4ade80',
    scale: [0.26, 0.36, 0.26],
    shelfY: -0.38,
  },
  {
    id: 'lemon',
    name: 'Amalfi Lemon',
    recipeHint: 'Lemon Ricotta Agnotti with Herbs',
    shape: 'cylinder',
    hex: '#fde047',
    scale: [0.15, 0.28, 0.15],
    shelfY: 0.12,
  },
  {
    id: 'bread',
    name: 'Artisan Brioche Loaf',
    recipeHint: 'Savory Herb & Cheese Strata',
    shape: 'box',
    hex: '#d97706',
    accentHex: '#fef08a',
    scale: [0.38, 0.26, 0.28],
    shelfY: -0.05,
  },
];

/**
 * Error boundary around Environment HDRI loader so if external CDN fails,
 * the studio lights still render without crashing the Canvas.
 */
class SafeEnvironmentBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface FridgeSceneProps {
  runKey: number;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onPhaseChange: (phase: Phase) => void;
}

function FoodPrimitive({
  config,
  isSelected,
  onSelect,
}: {
  config: FoodItemConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  const emissiveIntensity = isSelected ? 0.38 : hovered ? 0.2 : 0.04;

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {config.shape === 'sphere' && (
        <group>
          <mesh castShadow receiveShadow scale={config.scale}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshStandardMaterial
              color={config.color}
              roughness={0.4}
              metalness={0.05}
              emissive={config.color}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Subtle stem for tomato / apple */}
          {(config.id === 'tomato' || config.id === 'apple') && config.accentColor && (
            <mesh position={[0, config.scale[1] * 0.95, 0]} castShadow>
              <cylinderGeometry args={[0.018, 0.028, 0.09, 8]} />
              <meshStandardMaterial color={config.accentColor} roughness={0.5} />
            </mesh>
          )}
        </group>
      )}

      {config.shape === 'cylinder' && (
        <group>
          <mesh castShadow receiveShadow scale={config.scale}>
            <cylinderGeometry
              args={[
                config.id === 'carrot' ? 0.35 : 0.85,
                1,
                1,
                20,
              ]}
            />
            <meshStandardMaterial
              color={config.color}
              roughness={0.4}
              metalness={0.05}
              emissive={config.color}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Leafy top for carrot */}
          {config.id === 'carrot' && config.accentColor && (
            <mesh position={[0, -config.scale[1] * 0.55, 0]} rotation={[Math.PI, 0, 0]} castShadow>
              <coneGeometry args={[0.08, 0.18, 8]} />
              <meshStandardMaterial color={config.accentColor} roughness={0.45} />
            </mesh>
          )}
        </group>
      )}

      {config.shape === 'box' && (
        <group>
          <mesh castShadow receiveShadow scale={config.scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={config.color}
              roughness={0.4}
              metalness={0.05}
              emissive={config.color}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Milk carton gable roof or bread crust band */}
          {config.id === 'milk' && config.accentColor && (
            <mesh position={[0, config.scale[1] * 0.1, 0]}>
              <boxGeometry
                args={[
                  config.scale[0] * 1.02,
                  config.scale[1] * 0.35,
                  config.scale[2] * 1.02,
                ]}
              />
              <meshStandardMaterial color={config.accentColor} roughness={0.35} />
            </mesh>
          )}
        </group>
      )}

      {config.shape === 'cone' && (
        <group>
          {/* Broccoli tree crown */}
          <mesh castShadow receiveShadow scale={config.scale} position={[0, 0.06, 0]}>
            <coneGeometry args={[1, 1, 12]} />
            <meshStandardMaterial
              color={config.color}
              roughness={0.4}
              metalness={0.05}
              emissive={config.color}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Broccoli stalk */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.22, 10]} />
            <meshStandardMaterial
              color={config.accentColor || config.color}
              roughness={0.5}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

function FridgeStage({
  runKey,
  selectedItemId,
  onSelectItem,
  onPhaseChange,
}: FridgeSceneProps) {
  const elapsedRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');

  const fridgeRootRef = useRef<THREE.Group>(null);
  const doorPivotRef = useRef<THREE.Group>(null);
  const seamLightRef = useRef<THREE.PointLight>(null);
  const interiorLightRef = useRef<THREE.PointLight>(null);
  const seamMeshMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const foodGroupRefs = useRef<Array<THREE.Group | null>>([]);

  // Precompute deterministic, vibrant food item trajectories and orbital targets
  const foodItems = useMemo<FoodItemConfig[]>(() => {
    const count = FOOD_ITEMS_DATA.length;
    return FOOD_ITEMS_DATA.map((item, idx) => {
      // Spread items around a 360° loose orbital ring around the fridge
      const angleOffset = (idx / count) * Math.PI * 2 + 0.35;
      const orbitRadius = 2.15 + (idx % 3) * 0.32;
      const orbitY = -0.55 + ((idx * 0.37) % 1.45);

      // Outward burst velocity magnitude between 2.0 and 4.0 units/s
      const speed = 2.3 + (idx % 4) * 0.45;
      const dirX = Math.cos(angleOffset) * 0.85;
      const dirZ = Math.abs(Math.sin(angleOffset)) * 0.9 + 0.55; // Launch forward out of door first
      const dirVec = new THREE.Vector3(dirX, 0.45 + (idx % 3) * 0.22, dirZ).normalize();
      const velocity = dirVec.multiplyScalar(speed);

      // Stagger between 80ms and 120ms per item
      const staggerStep = 0.095; // 95ms average step (within 80-120ms)
      const staggerDelay = idx * staggerStep;

      return {
        id: item.id,
        name: item.name,
        recipeHint: item.recipeHint,
        shape: item.shape,
        color: new THREE.Color(item.hex),
        accentColor: item.accentHex ? new THREE.Color(item.accentHex) : undefined,
        scale: item.scale,
        startPos: new THREE.Vector3(
          (idx % 2 === 0 ? -1 : 1) * 0.22,
          item.shelfY,
          0.05
        ),
        velocity,
        orbitAngle: angleOffset,
        orbitRadius,
        orbitY,
        staggerDelay,
        rotSpeed: [
          1.4 + (idx % 3) * 0.8,
          1.8 + (idx % 4) * 0.7,
          1.1 + (idx % 2) * 0.9,
        ],
        floatPhase: idx * 0.65,
      };
    });
  }, [runKey]);

  // Reset clock when runKey increments (replay)
  useEffect(() => {
    elapsedRef.current = 0;
    phaseRef.current = 'idle';
    onPhaseChange('idle');
  }, [runKey, onPhaseChange]);

  useFrame((_, delta) => {
    // Clamp delta to avoid huge jumps on tab switch
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;
    const t = elapsedRef.current;

    // State machine transitions
    let nextPhase: Phase = 'idle';
    if (t >= 3.5) {
      nextPhase = 'orbiting';
    } else if (t >= 2.2) {
      nextPhase = 'bursting';
    } else if (t >= 1.8) {
      nextPhase = 'opening';
    } else {
      nextPhase = 'idle';
    }

    if (nextPhase !== phaseRef.current) {
      phaseRef.current = nextPhase;
      onPhaseChange(nextPhase);
    }

    // 1. Subtle idle breathing: scale 1.0 -> 1.005 over 3s, ease-in-out, infinite
    if (fridgeRootRef.current) {
      const breathe = 1.0 + 0.0025 * (1 - Math.cos((t * 2 * Math.PI) / 3.0));
      fridgeRootRef.current.scale.setScalar(breathe);
    }

    // 2. After 1.2s -> soft white light leaks from the door seam
    const leakProgress = smoothstep(1.2, 1.8, t);
    if (seamLightRef.current) {
      // Peaks around door opening, softens slightly once open
      const openFade = 1 - 0.35 * smoothstep(2.2, 3.5, t);
      seamLightRef.current.intensity = leakProgress * 6.5 * openFade;
    }
    if (interiorLightRef.current) {
      interiorLightRef.current.intensity = leakProgress * 9.0;
    }
    if (seamMeshMatRef.current) {
      seamMeshMatRef.current.emissiveIntensity = leakProgress * 4.5;
      seamMeshMatRef.current.opacity = leakProgress * 0.95;
    }

    // 3. At 1.8s -> door swings OPEN (rotation.y from 0 to -110°) over 1.4s
    // with cubic-bezier(0.34, 1.56, 0.64, 1) overshoot ease
    if (doorPivotRef.current) {
      if (t < 1.8) {
        doorPivotRef.current.rotation.y = 0;
      } else {
        const doorNorm = Math.min(1, (t - 1.8) / 1.4);
        const eased = doorOvershootEase(doorNorm);
        const targetRad = (-110 * Math.PI) / 180;
        doorPivotRef.current.rotation.y = eased * targetRad;
      }
    }

    // 4. At 2.2s -> food items FLY OUT in a burst with gravity arc,
    // settling into a loose orbital ring at 3.5s with gentle floating (±0.15 units, 2s period)
    const gravity = -3.8;

    foodItems.forEach((item, idx) => {
      const group = foodGroupRefs.current[idx];
      if (!group) return;

      const launchTime = 2.2 + item.staggerDelay;

      if (t < launchTime) {
        // Inside fridge on shelves
        group.position.copy(item.startPos);
        group.rotation.set(0, 0, 0);
        group.scale.setScalar(t >= 1.8 ? 1 : 0.001);
        return;
      }

      group.scale.setScalar(1);
      const flightElapsed = t - launchTime;

      // Ballistic arc position under gravity during burst
      const burstTime = Math.min(flightElapsed, 1.4);
      const ballisticX = item.startPos.x + item.velocity.x * burstTime;
      const ballisticY =
        item.startPos.y +
        item.velocity.y * burstTime +
        0.5 * gravity * burstTime * burstTime;
      const ballisticZ = item.startPos.z + item.velocity.z * burstTime;

      // Orbital ring position (slow azimuthal drift + ±0.15 Y sin wave with 2s period)
      const orbitDrift = Math.max(0, t - 2.6) * 0.22;
      const currentAngle = item.orbitAngle + orbitDrift;
      const floatOffset =
        Math.sin(((t - 3.5) * 2 * Math.PI) / 2.0 + item.floatPhase) * 0.15;

      const orbitX = Math.cos(currentAngle) * item.orbitRadius;
      const orbitZ = Math.sin(currentAngle) * item.orbitRadius;
      const orbitY = item.orbitY + floatOffset;

      // Smoothly blend from ballistic burst trajectory into orbital ring settling at 3.5s
      const settleBlend = smoothstep(launchTime + 0.18, 3.5, t);

      group.position.set(
        THREE.MathUtils.lerp(ballisticX, orbitX, settleBlend),
        THREE.MathUtils.lerp(ballisticY, orbitY, settleBlend),
        THREE.MathUtils.lerp(ballisticZ, orbitZ, settleBlend)
      );

      // Spin on all axes during burst, settling into gentle tumble in orbit
      const spinRateMultiplier = THREE.MathUtils.lerp(1.0, 0.25, settleBlend);
      group.rotation.x += item.rotSpeed[0] * spinRateMultiplier * dt;
      group.rotation.y += item.rotSpeed[1] * spinRateMultiplier * dt;
      group.rotation.z += item.rotSpeed[2] * spinRateMultiplier * dt;
    });
  });

  // Fridge dimensions
  const fridgeWidth = 1.65;
  const fridgeHeight = 2.85;
  const fridgeDepth = 1.35;
  const wallThickness = 0.1;
  const doorThickness = 0.12;

  return (
    <group>
      {/* Studio Environment Reflections (wrapped for resilience) */}
      <SafeEnvironmentBoundary>
        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>
      </SafeEnvironmentBoundary>

      {/* Atmospheric fog matching #0a0a0a stage */}
      <fog attach="fog" args={['#0a0a0a', 9, 22]} />

      {/* Subtle ambient fill */}
      <ambientLight intensity={0.35} color="#dbeafe" />

      {/* Single dramatic spotlight from above for product reveal */}
      <spotLight
        position={[0.6, 6.5, 2.5]}
        angle={0.48}
        penumbra={0.85}
        intensity={38}
        distance={18}
        color="#ffffff"
        castShadow={false}
      />

      {/* Rim light from back-left to sculpt fridge silhouette */}
      <pointLight position={[-3.5, 2.5, -2.5]} intensity={10} color="#93c5fd" />

      {/* One directionalLight with castShadow as specified in technical requirements */}
      <directionalLight
        position={[2.5, 6.0, 4.0]}
        intensity={1.8}
        color="#f8fafc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={16}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-bias={-0.0005}
      />

      {/* Stage group rotated -15° on Y so the eye-level camera at [0, 0, 8] views the fridge angled 15° to the right */}
      <group rotation={[0, -Math.PI / 12, 0]} position={[0.35, -0.1, 0]}>
        {/* Breathing Fridge Assembly */}
        <group ref={fridgeRootRef}>
          {/* Outer Fridge Cabinet built from BoxGeometry primitives so interior cavity is visible when door swings open */}
          {/* Back wall */}
          <mesh
            position={[0, 0, -fridgeDepth / 2 + wallThickness / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[fridgeWidth, fridgeHeight, wallThickness]} />
            <meshStandardMaterial
              color="#262930"
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>

          {/* Left wall */}
          <mesh
            position={[-fridgeWidth / 2 + wallThickness / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wallThickness, fridgeHeight, fridgeDepth]} />
            <meshStandardMaterial
              color="#262930"
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>

          {/* Right wall */}
          <mesh
            position={[fridgeWidth / 2 - wallThickness / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[wallThickness, fridgeHeight, fridgeDepth]} />
            <meshStandardMaterial
              color="#262930"
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>

          {/* Top wall */}
          <mesh
            position={[0, fridgeHeight / 2 - wallThickness / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[fridgeWidth, wallThickness, fridgeDepth]} />
            <meshStandardMaterial
              color="#262930"
              metalness={0.78}
              roughness={0.22}
            />
          </mesh>

          {/* Bottom wall / base */}
          <mesh
            position={[0, -fridgeHeight / 2 + wallThickness / 2, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[fridgeWidth, wallThickness, fridgeDepth]} />
            <meshStandardMaterial
              color="#1e2026"
              metalness={0.75}
              roughness={0.28}
            />
          </mesh>

          {/* Bright White Insulated Interior Liner */}
          <mesh position={[0, 0, -fridgeDepth / 2 + wallThickness + 0.01]} receiveShadow>
            <boxGeometry
              args={[
                fridgeWidth - wallThickness * 2,
                fridgeHeight - wallThickness * 2,
                0.02,
              ]}
            />
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.25}
              metalness={0.05}
              emissive="#fffbeb"
              emissiveIntensity={0.25}
            />
          </mesh>

          {/* Glass Shelves inside the Fridge */}
          {[-0.55, 0.0, 0.55].map((shelfY, idx) => (
            <mesh
              key={idx}
              position={[0, shelfY, -0.05]}
              receiveShadow
            >
              <boxGeometry
                args={[
                  fridgeWidth - wallThickness * 2.2,
                  0.025,
                  fridgeDepth - wallThickness * 2.5,
                ]}
              />
              <meshStandardMaterial
                color="#e0f2fe"
                roughness={0.15}
                metalness={0.1}
                transparent
                opacity={0.65}
              />
            </mesh>
          ))}

          {/* Interior Warm-White Light (activates at 1.2s) */}
          <pointLight
            ref={interiorLightRef}
            position={[0, 0.7, 0.1]}
            intensity={0}
            distance={4.5}
            color="#fff7ed"
          />

          {/* Door Seam Light Leak (at right edge seam, activates at 1.2s) */}
          <pointLight
            ref={seamLightRef}
            position={[fridgeWidth / 2 + 0.04, 0, fridgeDepth / 2 + 0.06]}
            intensity={0}
            distance={3.5}
            color="#ffffff"
          />

          {/* Glowing vertical light-leak strip along the right door seam */}
          <mesh
            position={[
              fridgeWidth / 2 - 0.015,
              0,
              fridgeDepth / 2 + 0.005,
            ]}
          >
            <boxGeometry args={[0.025, fridgeHeight - 0.08, 0.025]} />
            <meshStandardMaterial
              ref={seamMeshMatRef}
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0}
              transparent
              opacity={0}
            />
          </mesh>

          {/* Fridge Door with hinge pivot at left front edge */}
          <group
            ref={doorPivotRef}
            position={[-fridgeWidth / 2, 0, fridgeDepth / 2]}
          >
            {/* Main Brushed Stainless Door Panel offset from hinge pivot */}
            <mesh
              position={[fridgeWidth / 2, 0, doorThickness / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[fridgeWidth, fridgeHeight, doorThickness]} />
              <meshStandardMaterial
                color="#32363f"
                metalness={0.84}
                roughness={0.18}
              />
            </mesh>

            {/* Inner Door White Liner */}
            <mesh
              position={[fridgeWidth / 2, 0, -0.005]}
              receiveShadow
            >
              <boxGeometry
                args={[fridgeWidth - 0.14, fridgeHeight - 0.14, 0.02]}
              />
              <meshStandardMaterial
                color="#f1f5f9"
                roughness={0.3}
                metalness={0.05}
              />
            </mesh>

            {/* Minimalist Vertical Bar Handle on the right side of the door */}
            <mesh
              position={[fridgeWidth - 0.16, 0.1, doorThickness + 0.045]}
              castShadow
            >
              <boxGeometry args={[0.035, 1.15, 0.04]} />
              <meshStandardMaterial
                color="#e2e8f0"
                metalness={0.92}
                roughness={0.12}
              />
            </mesh>
            {/* Handle standoffs */}
            <mesh
              position={[fridgeWidth - 0.16, 0.6, doorThickness + 0.02]}
            >
              <boxGeometry args={[0.035, 0.035, 0.05]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
            <mesh
              position={[fridgeWidth - 0.16, -0.4, doorThickness + 0.02]}
            >
              <boxGeometry args={[0.035, 0.035, 0.05]} />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.9}
                roughness={0.15}
              />
            </mesh>
          </group>
        </group>

        {/* Flying & Orbiting Stylized Low-Poly Food Items */}
        {foodItems.map((item, idx) => (
          <group
            key={item.id}
            ref={(el) => {
              foodGroupRefs.current[idx] = el;
            }}
          >
            <FoodPrimitive
              config={item}
              isSelected={selectedItemId === item.id}
              onSelect={() =>
                onSelectItem(selectedItemId === item.id ? null : item.id)
              }
            />
          </group>
        ))}
      </group>

      {/* Large dark shadow-receiving stage floor with subtle reflection */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -fridgeHeight / 2 - 0.1, 0]}
        receiveShadow
        onClick={() => onSelectItem(null)}
      >
        <planeGeometry args={[45, 45]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.28}
          metalness={0.35}
        />
      </mesh>
    </group>
  );
}

function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-white animate-ping" />
      </div>
    </div>
  );
}

export default function HeroScene() {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [showHeadline, setShowHeadline] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [recipeDrawerOpen, setRecipeDrawerOpen] = useState(false);

  // Sync HTML text overlay transitions with the exact 3.5s and 4.0s choreography
  useEffect(() => {
    setShowHeadline(false);
    setShowCta(false);

    const headlineTimer = window.setTimeout(() => {
      setShowHeadline(true);
    }, 3500);

    const ctaTimer = window.setTimeout(() => {
      setShowCta(true);
    }, 4000);

    return () => {
      window.clearTimeout(headlineTimer);
      window.clearTimeout(ctaTimer);
    };
  }, [runKey]);

  const selectedIngredient = useMemo(
    () => FOOD_ITEMS_DATA.find((item) => item.id === selectedItemId) || null,
    [selectedItemId]
  );

  const handleReplay = () => {
    setSelectedItemId(null);
    setRecipeDrawerOpen(false);
    setRunKey((prev) => prev + 1);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a] select-none"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Soft radial stage vignette backdrop */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(circle at 54% 45%, rgba(255,255,255,0.05) 0%, rgba(10,10,10,0.45) 48%, rgba(10,10,10,0.94) 100%)',
        }}
      />

      {/* 3D Canvas with Suspense dark pulsing-dot fallback */}
      <Suspense fallback={<LoadingScreen />}>
        <div className="relative z-[2] w-full h-full">
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [0, 0, 8], fov: 45 }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
          >
            <FridgeStage
              runKey={runKey}
              selectedItemId={selectedItemId}
              onSelectItem={(id) => {
                setSelectedItemId(id);
              }}
              onPhaseChange={setPhase}
            />
          </Canvas>
        </div>
      </Suspense>

      {/* Top Subtle Navigation / Replay Action */}
      <header className="pointer-events-none absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-[8vw] py-7">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleReplay();
          }}
          className="pointer-events-auto text-sm font-semibold tracking-tight text-white/90 hover:text-white transition-colors"
        >
          FridgeOS
        </a>

        <div className="pointer-events-auto flex items-center gap-5">
          {phase === 'orbiting' && (
            <button
              type="button"
              onClick={handleReplay}
              className="px-3.5 py-1.5 text-xs font-medium text-white/75 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all duration-150 cursor-pointer whitespace-nowrap"
            >
              Replay Reveal
            </button>
          )}
        </div>
      </header>

      {/* Selected Orbiting Ingredient Floating Card (when user clicks a 3D food item) */}
      {selectedIngredient && (
        <div className="pointer-events-auto absolute top-20 right-[8vw] z-20 max-w-xs bg-black/65 backdrop-blur-md border border-white/15 rounded-2xl p-5 text-white transition-all duration-200">
          <div className="flex items-center justify-between gap-4 mb-1.5">
            <span className="text-xs font-medium text-white/60">
              Detected Ingredient · Fresh
            </span>
            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
              className="text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            {selectedIngredient.name}
          </h2>
          <p className="mt-1 text-xs text-[#a0a0a0] leading-relaxed">
            Instant Match: {selectedIngredient.recipeHint}
          </p>
        </div>
      )}

      {/* Bottom-left HTML Text Overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 z-10"
        style={{ padding: '8vw' }}
      >
        {/* Headline & Subhead fade in from below at 3.5s */}
        <div
          className={`transition-all duration-700 ease-out ${
            showHeadline
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6'
          }`}
        >
          <h1
            className="text-white"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(2.5rem, 5vw, 64px)',
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              textWrap: 'balance',
            }}
          >
            Your fridge. Reinvented.
          </h1>

          <p
            className="mt-3"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              color: '#a0a0a0',
              lineHeight: 1.5,
            }}
          >
            Snap a photo. Get recipes. In seconds.
          </p>
        </div>

        {/* CTA Button fades in at 4.0s */}
        <div
          className={`mt-7 transition-all duration-700 ease-out ${
            showCta
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => setRecipeDrawerOpen((prev) => !prev)}
            className="px-7 py-3.5 rounded-full bg-white text-black font-medium text-base tracking-tight transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] cursor-pointer whitespace-nowrap"
            style={{
              boxShadow:
                '0 0 32px rgba(255, 255, 255, 0.38), 0 4px 16px rgba(0, 0, 0, 0.5)',
            }}
          >
            Open your fridge →
          </button>
        </div>
      </div>

      {/* Interactive Instant Recipe Preview Panel (triggered when clicking the CTA) */}
      {recipeDrawerOpen && (
        <div className="pointer-events-auto absolute bottom-[8vw] right-[8vw] z-20 w-full max-w-sm bg-black/75 backdrop-blur-xl border border-white/15 rounded-2xl p-6 text-white shadow-2xl transition-all duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">
                10 Ingredients Scanned
              </h2>
              <p className="text-xs text-[#a0a0a0] mt-0.5">
                Click any floating ingredient in 3D or select a recipe below
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecipeDrawerOpen(false)}
              className="px-2.5 py-1 text-xs text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {FOOD_ITEMS_DATA.slice(0, 5).map((item) => {
              const active = selectedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(active ? null : item.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-white/15 border-white/30'
                      : 'bg-white/5 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-[#a0a0a0]">
                    <span>{item.name}</span>
                    <span className="tabular-nums">12 min</span>
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-white">
                    {item.recipeHint}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-xs text-[#a0a0a0]">
              Want to watch the reveal again?
            </span>
            <button
              type="button"
              onClick={handleReplay}
              className="text-xs font-medium text-white underline underline-offset-4 hover:text-white/80 cursor-pointer whitespace-nowrap"
            >
              Replay Animation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
