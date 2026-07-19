import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

// Curve points generator for flowing neon pathing
const getCurvePoints = (start, end) => {
  const pStart = new THREE.Vector3(...start);
  const pEnd = new THREE.Vector3(...end);
  const pMid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
  pMid.y += 3.5; // lift the center for a beautiful 3D arc
  const curve = new THREE.QuadraticBezierCurve3(pStart, pMid, pEnd);
  return curve.getPoints(40);
};

// Animated Line path
function GlowingPath({ start, end, color = '#06B6D4', width = 3 }) {
  const lineRef = useRef();
  const points = useMemo(() => getCurvePoints(start, end), [start, end]);

  useFrame((_state) => {
    if (lineRef.current?.material) {
      lineRef.current.material.dashOffset -= 0.015;
    }
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={width}
      dashed
      dashScale={2}
      dashSize={0.4}
      gapSize={0.2}
    />
  );
}

// Camera and controls controller for smooth sweeps
function CameraController({ focusTarget, controlsRef, telemetry, transitHubs, safetyZones: _safetyZones }) {
  const { camera } = useThree();
  const isTransitioningRef = useRef(false);

  const targetCoords = useMemo(() => {
    const defaultPos = { camera: [0, 22, 28], lookAt: [0, 0, 0] };
    if (!focusTarget) return defaultPos;

    // Check if focusing a gate
    if (telemetry.gates[focusTarget]) {
      const gate = telemetry.gates[focusTarget];
      // Position camera offset from gate
      const [gx, gy, gz] = gate.coords;
      return {
        camera: [gx * 1.6, gy + 7, gz * 1.6],
        lookAt: [gx, gy, gz],
      };
    }

    // Check transit hubs
    if (transitHubs[focusTarget]) {
      const hub = transitHubs[focusTarget];
      const [hx, hy, hz] = hub.coords;
      return {
        camera: [hx + (hx > 0 ? -6 : 6), hy + 7, hz + (hz > 0 ? -6 : 6)],
        lookAt: [hx, hy, hz],
      };
    }

    // Check SOS target
    if (focusTarget === 'sos') {
      return {
        camera: [0, 28, 34],
        lookAt: [0, 0, 0],
      };
    }

    return defaultPos;
  }, [focusTarget, telemetry, transitHubs]);

  // Trigger transition when focusTarget changes
  useEffect(() => {
    isTransitioningRef.current = true;
  }, [focusTarget]);

  useFrame(() => {
    if (isTransitioningRef.current) {
      const cTarget = new THREE.Vector3(...targetCoords.camera);
      const lTarget = new THREE.Vector3(...targetCoords.lookAt);

      // Smoothly interpolate camera position
      camera.position.lerp(cTarget, 0.08);

      // Smoothly interpolate orbit controls target
      if (controlsRef.current) {
        controlsRef.current.target.lerp(lTarget, 0.08);
        controlsRef.current.update();
      }

      // Check distance to stop transition
      const distCam = camera.position.distanceTo(cTarget);
      const distLook = controlsRef.current
        ? controlsRef.current.target.distanceTo(lTarget)
        : camera.position.distanceTo(lTarget);

      if (distCam < 0.15 && distLook < 0.15) {
        isTransitioningRef.current = false;
      }
    }
  });

  return null;
}

// Visual beacon for emergency zones
function EmergencyBeacon({ position, color = '#10B981' }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      meshRef.current.scale.setScalar(1 + Math.sin(time * 4) * 0.15);
      meshRef.current.material.opacity = 0.3 + Math.sin(time * 4) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <cylinderGeometry args={[2, 2, 6, 16, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Ambient Red light pulses for emergency
function AmbientEmergencyLight({ active }) {
  const lightRef = useRef();

  useFrame((state) => {
    if (lightRef.current && active) {
      const time = state.clock.getElapsedTime();
      lightRef.current.intensity = 1.5 + Math.sin(time * 5) * 1.0;
    }
  });

  if (!active) return null;

  return <pointLight ref={lightRef} color="#EF4444" intensity={1.5} position={[0, 12, 0]} />;
}

export default function StadiumCanvas({ 
  telemetry, 
  sosActive, 
  activeGate, 
  setActiveGate, 
  focusTarget, 
  setFocusTarget,
  transitHubs,
  safetyZones 
}) {
  const controlsRef = useRef();

  // Helper to resolve gate status colors
  const getGateColorHex = (status) => {
    if (sosActive) return '#ff0055'; // everything locked to neon magenta warning in SOS
    switch (status) {
      case 'clear': return '#00ff88'; // Vibrant Mint Green
      case 'moderate': return '#ff9f43'; // Electric Tangerine Orange
      case 'heavy': return '#ff007f'; // Vibrant Hot Pink / Magenta
      default: return '#818cf8';
    }
  };

  // Find nearest transit hub for a gate path
  const getNearestTransit = (gateKey) => {
    if (gateKey === 'gateA' || gateKey === 'gateB' || gateKey === 'gateC') return 'metro';
    if (gateKey === 'gateD' || gateKey === 'gateE') return 'parking';
    return 'bus'; // gateF, gateG
  };

  // Find nearest safety zone for evacuation
  const getNearestSafetyZone = (gateCoords) => {
    // Determine closest safety zone by simple X-Z distance
    let closestZone = 'northSafety';
    let minDist = Infinity;
    
    Object.entries(safetyZones).forEach(([key, zone]) => {
      const dx = gateCoords[0] - zone.coords[0];
      const dz = gateCoords[2] - zone.coords[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closestZone = key;
      }
    });
    return closestZone;
  };

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 22, 28], fov: 45 }}
        gl={{ antialias: true }}
        onPointerDown={(e) => {
          // Clear active gate selection if user clicks on background canvas
          if (e.target === e.currentTarget) {
            setActiveGate(null);
            setFocusTarget(null);
          }
        }}
      >
        {/* Lights */}
        <ambientLight intensity={sosActive ? 0.3 : 0.7} />
        <directionalLight position={[10, 20, 10]} intensity={sosActive ? 0.4 : 1.2} castShadow />
        <pointLight position={[-15, 10, -15]} intensity={0.5} />
        
        {/* Emergency blinking ambient light */}
        <AmbientEmergencyLight active={sosActive} />

        {/* Floor Grid - Glowing Violet / Crimson holographic grid */}
        <gridHelper args={[60, 60, sosActive ? '#ff0055' : '#8b5cf6', sosActive ? '#450a0a' : '#120b2e']} position={[0, 0.01, 0]} />

        {/* --- STADIUM GEOMETRY --- */}
        {/* Pitch - Futuristic Indigo Deep space floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
          <planeGeometry args={[14, 10]} />
          <meshStandardMaterial color={sosActive ? '#2d0615' : '#070b19'} roughness={0.6} metalness={0.2} />
        </mesh>
        
        {/* Pitch Boundary Line - Neon border */}
        <Line 
          points={[
            [-7, 0.06, -5], [7, 0.06, -5], [7, 0.06, 5], [-7, 0.06, 5], [-7, 0.06, -5]
          ]} 
          color={sosActive ? '#ff0055' : '#a78bfa'} 
          lineWidth={2} 
        />

        {/* Seating Stands (Stacked stylized box geometry with neon ambient glows) */}
        {/* North Stand */}
        <mesh position={[0, 1.2, -7.5]} castShadow receiveShadow>
          <boxGeometry args={[16, 2.4, 2]} />
          <meshStandardMaterial color="#13142e" roughness={0.4} metalness={0.5} emissive="#1f1847" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 2.8, -8.8]} castShadow>
          <boxGeometry args={[18, 1.6, 1.5]} />
          <meshStandardMaterial color="#0e0f24" roughness={0.5} emissive="#0d081f" />
        </mesh>

        {/* South Stand */}
        <mesh position={[0, 1.2, 7.5]} castShadow receiveShadow>
          <boxGeometry args={[16, 2.4, 2]} />
          <meshStandardMaterial color="#13142e" roughness={0.4} metalness={0.5} emissive="#1f1847" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 2.8, 8.8]} castShadow>
          <boxGeometry args={[18, 1.6, 1.5]} />
          <meshStandardMaterial color="#0e0f24" roughness={0.5} emissive="#0d081f" />
        </mesh>

        {/* East Stand */}
        <mesh position={[9.5, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 2.4, 13]} />
          <meshStandardMaterial color="#13142e" roughness={0.4} metalness={0.5} emissive="#1f1847" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[10.8, 2.8, 0]} castShadow>
          <boxGeometry args={[1.5, 1.6, 15]} />
          <meshStandardMaterial color="#0e0f24" roughness={0.5} emissive="#0d081f" />
        </mesh>

        {/* West Stand */}
        <mesh position={[-9.5, 1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[2, 2.4, 13]} />
          <meshStandardMaterial color="#13142e" roughness={0.4} metalness={0.5} emissive="#1f1847" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[-10.8, 2.8, 0]} castShadow>
          <boxGeometry args={[1.5, 1.6, 15]} />
          <meshStandardMaterial color="#0e0f24" roughness={0.5} emissive="#0d081f" />
        </mesh>

        {/* Stylized Roof Structure - Glowing Violet Halo */}
        <mesh position={[0, 4.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[11, 0.4, 8, 48]} />
          <meshStandardMaterial color="#7c3aed" transparent opacity={0.5} roughness={0.1} metalness={0.9} emissive="#6d28d9" emissiveIntensity={0.8} />
        </mesh>

        {/* --- GATES (Glowing spheres with HTML badges) --- */}
        {Object.entries(telemetry.gates).map(([key, gate]) => {
          const isSelected = activeGate === key;
          const colorHex = getGateColorHex(gate.status);

          return (
            <group key={key} position={gate.coords}>
              {/* Gate Node */}
              <mesh 
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveGate(key);
                  setFocusTarget(key);
                }}
                castShadow
              >
                <sphereGeometry args={[isSelected ? 0.75 : 0.5, 16, 16]} />
                <meshStandardMaterial 
                  color={colorHex} 
                  emissive={colorHex} 
                  emissiveIntensity={isSelected ? 1.8 : 0.8} 
                  roughness={0.1}
                />
              </mesh>

              {/* Glowing ring under gate */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
                <ringGeometry args={[isSelected ? 0.9 : 0.6, isSelected ? 1.1 : 0.7, 16]} />
                <meshBasicMaterial color={colorHex} transparent opacity={0.6} side={THREE.DoubleSide} />
              </mesh>

              {/* Floating label badge */}
              <Html distanceFactor={14} position={[0, 1.4, 0]} center>
                <div 
                  onClick={() => {
                    setActiveGate(key);
                    setFocusTarget(key);
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider select-none pointer-events-auto cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/50 border border-pink-400/40' 
                      : 'bg-slate-950/80 text-slate-300 border border-indigo-500/30 hover:bg-indigo-950/50'
                  }`}
                >
                  {gate.name.split(' - ')[0]}
                </div>
              </Html>
            </group>
          );
        })}

        {/* --- TRANSIT HUBS --- */}
        {Object.entries(transitHubs).map(([key, hub]) => {
          const isFocused = focusTarget === key;
          return (
            <group key={key} position={hub.coords}>
              {/* Hub geometric block */}
              <mesh castShadow receiveShadow>
                <cylinderGeometry args={[1, 1, 1.2, 6]} />
                <meshStandardMaterial color="#1e1b4b" roughness={0.3} metalness={0.6} emissive="#0d9488" emissiveIntensity={0.5} />
              </mesh>
              <mesh position={[0, 0.8, 0]}>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={isFocused ? 1.8 : 0.4} />
              </mesh>

              {/* Label */}
              <Html distanceFactor={16} position={[0, 1.8, 0]} center>
                <div className="px-2 py-0.5 rounded text-[8px] bg-teal-950/95 text-teal-300 border border-teal-800/80 font-bold whitespace-nowrap">
                  {hub.name}
                </div>
              </Html>
            </group>
          );
        })}

        {/* --- EMERGENCY SAFETY ZONES --- */}
        {sosActive && Object.entries(safetyZones).map(([key, zone]) => (
          <group key={key} position={zone.coords}>
            {/* Pulsing ring on floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.5, 2, 32]} />
              <meshBasicMaterial color="#00ff88" side={THREE.DoubleSide} />
            </mesh>
            {/* Visual Beacon pillar */}
            <EmergencyBeacon position={[0, 3, 0]} color="#00ff88" />

            {/* Label */}
            <Html distanceFactor={15} position={[0, 3.2, 0]} center>
              <div className="px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/50 font-bold text-[9px] animate-pulse tracking-widest whitespace-nowrap shadow-lg shadow-emerald-900/40">
                🚨 {zone.name}
              </div>
            </Html>
          </group>
        ))}

        {/* --- PATH ROUTING OVERLAYS --- */}
        {/* Standard Waypoint Navigation: active gate to its transit hub */}
        {!sosActive && activeGate && (
          <GlowingPath 
            start={telemetry.gates[activeGate].coords}
            end={transitHubs[getNearestTransit(activeGate)].coords}
            color="#00f3ff"
            width={4.5}
          />
        )}

        {/* Evacuation Visual Layer: All gates route to nearest safety zones in SOS */}
        {sosActive && Object.entries(telemetry.gates).map(([key, gate]) => {
          const targetSafety = getNearestSafetyZone(gate.coords);
          return (
            <GlowingPath 
              key={`evac-${key}`}
              start={gate.coords}
              end={safetyZones[targetSafety].coords}
              color="#00ff66"
              width={4}
            />
          );
        })}

        {/* Orbit Controls */}
        <OrbitControls 
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2.1} // don't go below floor
          minDistance={8}
          maxDistance={45}
        />

        {/* Camera sweep driver */}
        <CameraController 
          focusTarget={focusTarget}
          controlsRef={controlsRef}
          telemetry={telemetry}
          transitHubs={transitHubs}
          safetyZones={safetyZones}
        />
      </Canvas>
    </div>
  );
}
