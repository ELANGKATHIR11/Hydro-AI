import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface Reservoir3DProps {
  waterLevel: number; // 0 to 100
}

const WaterMesh: React.FC<{ level: number }> = ({ level }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Normalize level (0-100) to mesh height (0-5)
  const targetHeight = (level / 100) * 5;

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Smooth interpolation for water movement
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        targetHeight - 2.5, // Center around 0
        delta * 2
      );
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <planeGeometry args={[10, 10, 32, 32]} />
      <meshStandardMaterial 
        color="#0ea5e9" 
        transparent 
        opacity={0.8} 
        roughness={0.1}
        metalness={0.8} 
      />
    </mesh>
  );
};

const Terrain: React.FC = () => {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
            <planeGeometry args={[12, 12, 64, 64]} />
            <meshStandardMaterial color="#334155" wireframe />
        </mesh>
    );
};

const Reservoir3D: React.FC<Reservoir3DProps> = ({ waterLevel }) => {
  return (
    <div className="h-full w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-700 relative">
        <div className="absolute top-2 right-2 z-10 bg-slate-900/80 p-2 rounded text-xs text-blue-200">
            3D Digital Twin (Live)
        </div>
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.0} />
        <Sky sunPosition={[10, 10, 100]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <WaterMesh level={waterLevel} />
        <Terrain />
        
        <OrbitControls enableZoom={true} minDistance={5} maxDistance={20} />
        <gridHelper args={[20, 20, 0xffffff, 0x555555]} position={[0, -3, 0]} />
      </Canvas>
    </div>
  );
};

export default Reservoir3D;
