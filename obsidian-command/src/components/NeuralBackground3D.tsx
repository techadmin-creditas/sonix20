import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  MeshTransmissionMaterial, 
  Float, 
  Environment, 
  ContactShadows, 
  PerspectiveCamera,
  Stars,
  Sparkles,
  Float as DreiFloat
} from '@react-three/drei';
import * as THREE from 'three';

function NeuralCore() {
  const mesh = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    mesh.current.rotation.x = Math.cos(t / 4) / 8;
    mesh.current.rotation.y = Math.sin(t / 4) / 8;
    mesh.current.rotation.z = Math.sin(t / 4) / 8;
    mesh.current.position.y = (1 + Math.sin(t / 1.5)) / 10;
  });

  return (
    <DreiFloat speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={mesh}>
        <octahedronGeometry args={[1, 32]} />
        <MeshTransmissionMaterial
          backside
          samples={2}
          thickness={2.5}
          chromaticAberration={0.03}
          distortion={0.1}
          distortionScale={0.1}
          temporalDistortion={0.05}
          clearcoat={1}
          attenuationDistance={0.5}
          attenuationColor="#ffb77b"
          color="#1a1a1a"
        />
      </mesh>
    </DreiFloat>
  );
}

function NeuralUniverse() {
  const ref = useRef<THREE.Group>(null!);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.015;
    ref.current.rotation.x = Math.sin(t * 0.08) * 0.05;
  });

  return (
    <group ref={ref}>
      {/* Optimized Starfield */}
      <Stars 
        radius={100} 
        depth={50} 
        count={2500} 
        factor={4} 
        saturation={0} 
        fade 
        speed={1} 
      />
      
      {/* Hyper-Speed Data Nodes (Sparkles) */}
      <Sparkles 
        count={30} 
        scale={15} 
        size={1.5} 
        speed={0.4} 
        opacity={0.2} 
        color="#ffb77b" 
      />

      {/* Nebula Glooms */}
      <pointLight position={[10, 5, 10]} intensity={1.5} color="#ffb77b" />
      <pointLight position={[-10, -5, -10]} intensity={1} color="#4c1d95" />
    </group>
  );
}

export function NeuralBackground3D() {
  return (
    <div className="fixed inset-0 z-0 h-screen w-full bg-[#050608]">
      <Canvas 
        shadows={{ type: THREE.BasicShadowMap }}
        dpr={1}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={45} />
        
        <ambientLight intensity={0.2} />
        <spotLight position={[15, 20, 5]} angle={0.3} penumbra={1} intensity={1.5} castShadow color="#ffb77b" />
        
        <NeuralUniverse />
        <NeuralCore />
        
        <Environment preset="night" />
        <ContactShadows 
          position={[0, -2, 0]} 
          opacity={0.4} 
          scale={8} 
          blur={2.5} 
          far={4} 
        />
      </Canvas>
      
      {/* Milky Way Nebula Gradient Overlay */}
      <div className="absolute inset-0 bg-linear-to-tr from-purple-950/20 via-transparent to-orange-950/20 pointer-events-none mix-blend-screen" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#050608] pointer-events-none" />
    </div>
  );
}

