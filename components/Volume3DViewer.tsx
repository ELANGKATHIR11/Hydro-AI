import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Props
interface Volume3DViewerProps {
    currentVolume: number; // For water level height
    maxVolume: number;
}

const WaterPlane: React.FC<{ level: number }> = ({ level }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    
    useFrame(() => {
        if (meshRef.current) {
            // Smooth lerp for water level
            meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, level, 0.05);
        }
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial 
                color="#3b82f6" 
                transparent={true} 
                opacity={0.6} 
                roughness={0.1}
                metalness={0.8}
            />
        </mesh>
    );
};

const Contours: React.FC = () => {
    const [contours, setContours] = useState<any>(null);

    useEffect(() => {
        fetch('/contours.geojson')
            .then(res => res.json())
            .then(data => setContours(data))
            .catch(err => console.error("Err loading 3D contours", err));
    }, []);

    const lines = useMemo(() => {
        if (!contours) return [];
        
        const lineGeoms: React.ReactNode[] = [];
        
        // Simple normalization (Lat/Lon is too big for ThreeJS scene center)
        // Find bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        // Pass 1: Bounds
        contours.features.forEach((f: any) => {
             const coords = f.geometry.coordinates; // MultiLineString usually [[ [x,y], [x,y] ]]
             // Handle MultiLineString vs LineString structure
             const lines = f.geometry.type === "MultiLineString" ? coords : [coords];
             
             lines.forEach((line: any[]) => {
                 line.forEach((pt: number[]) => {
                     const [x, y] = pt; // Lon, Lat
                     if (x < minX) minX = x;
                     if (x > maxX) maxX = x;
                     if (y < minY) minY = y;
                     if (y > maxY) maxY = y;
                 });
             });
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const scale = 5000; // Scale lat/lon to scene units

        // Pass 2: Create Geometries
        contours.features.forEach((f: any, idx: number) => {
             const elev = f.properties.elevation;
             const coords = f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates];
             
             // Normalize Elevation:
             // Our Z is Up. 
             // Map Elevation (e.g., 50m) directly to Y.
             // Need to center the drawing X/Z.
             
             coords.forEach((line: any[], lineIdx: number) => {
                 const points = line.map((pt: number[]) => {
                     // X = (Lon - CenterX) * Scale
                     // Z = (Lat - CenterY) * Scale (flipped Z usually for mapping)
                     // Y = Elevation
                     const x = (pt[0] - centerX) * scale;
                     const z = -(pt[1] - centerY) * scale; // Latitude to Z
                     // Height scaling
                     const y = (elev - 40) * 1.5; // Offset 40m baseline, exaggerate height
                     return new THREE.Vector3(x, y, z);
                 });
                 
                 const geometry = new THREE.BufferGeometry().setFromPoints(points);
                 
                 lineGeoms.push(
                     <line key={`${idx}-${lineIdx}`}>
                         <bufferGeometry attach="geometry" {...geometry} />
                         <lineBasicMaterial attach="material" color="#f97316" linewidth={1} opacity={0.4} transparent />
                     </line>
                 );
             });
        });
        
        return lineGeoms;
    }, [contours]);

    return <group>{lines}</group>;
};


const Volume3DViewer: React.FC<Volume3DViewerProps> = ({ currentVolume, maxVolume }) => {

    // Simple mapper: Volume -> Height
    // In God Mode, MaxVol ~ 26 MCM.
    // Elevation typically 45m - 60m. 
    // Let's assume linear mapping for viz for now if we don't fetch the curve here.
    // Or just map 0-100% capacity to height range.
    
    // Baseline height = 5 (scaled from (45-40)*1.5)
    // Max height = 30 (scaled from (60-40)*1.5)
    
    const fillPct = Math.min(100, (currentVolume / 26.24) * 100); 
    // Normalized height
    const waterHeight = 0 + (fillPct / 100) * 35; 

    return (
        <div className="w-full h-full rounded-xl overflow-hidden bg-black/40 border border-slate-700 relative">
            <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-xs text-white">
                <h3 className="font-bold text-orange-400">3D Bathymetry</h3>
                <p>Drag to Rotate • Scroll to Zoom</p>
            </div>
            
            <Canvas>
                <PerspectiveCamera makeDefault position={[50, 50, 50]} fov={50} />
                <OrbitControls autoRotate autoRotateSpeed={0.5} maxPolarAngle={Math.PI / 2.1} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                
                <Contours />
                <WaterPlane level={waterHeight} />
                
                <gridHelper args={[200, 20]} position={[0, 0, 0]} />
            </Canvas>
        </div>
    );
};

export default Volume3DViewer;
