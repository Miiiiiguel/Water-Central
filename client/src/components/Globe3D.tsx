import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function destinationPoints(count: number) {
  const points: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = 1.52;
    points.push([
      r * Math.cos(theta) * Math.sin(phi),
      r * Math.sin(theta) * Math.sin(phi),
      r * Math.cos(phi),
    ]);
  }
  return points;
}

function RotatingGlobe() {
  const groupRef = useRef<THREE.Group>(null);
  const points = useMemo(() => destinationPoints(42), []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });

  return (
    <group ref={groupRef}>
      {/* Wireframe sphere */}
      <mesh>
        <sphereGeometry args={[1.5, 28, 20]} />
        <meshBasicMaterial color="#342F7A" wireframe transparent opacity={0.35} />
      </mesh>
      {/* Inner solid glow sphere */}
      <mesh>
        <sphereGeometry args={[1.42, 32, 32]} />
        <meshStandardMaterial color="#1B1A45" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Destination dots */}
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color="#FF5A36" emissive="#FF5A36" emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

export default function Globe3D({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 42 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <ambientLight intensity={0.7} />
        <pointLight position={[4, 3, 4]} intensity={60} color="#FF8552" />
        <pointLight position={[-4, -2, -3]} intensity={30} color="#5B57C9" />
        <RotatingGlobe />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 2 - 0.5}
          maxPolarAngle={Math.PI / 2 + 0.5}
        />
      </Canvas>
    </div>
  );
}
