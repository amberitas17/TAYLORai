// Hologram.jsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import './hologram.css'

useGLTF.preload("https://models.readyplayer.me/68d0e8b7cfced3382ad21320.glb");

function AvatarModel({ url, emotion }) {
  const { scene } = useGLTF(url);
  const rightArmBones = useRef([]);
  const [bonesFound, setBonesFound] = useState(false);

  useEffect(() => {
    const rightBones = [];
    scene.traverse((child) => {
      const name = child.name.toLowerCase();
      if (name.includes("right") && (name.includes("arm") || name.includes("upperarm"))) {
        rightBones.push(child);
      }
    });
    rightArmBones.current = rightBones;
    setBonesFound(rightBones.length > 0);
  }, [scene]);

  useFrame(() => {
    if (!bonesFound) return;

    rightArmBones.current.forEach((bone, i) => {
      const scale = 1 - i * 0.2; // reduce rotation down the chain
      if (["happy", "surprised", "neutral"].includes(emotion?.toLowerCase())) {
        // Raise arm forward
        bone.rotation.x = 1.2 * scale;
        bone.rotation.y = 0;
        bone.rotation.z = 0;
      } else if (["sad", "angry"].includes(emotion?.toLowerCase())) {
        // Comforting pose: slightly bent down
        bone.rotation.x = 0.5 * scale;
        bone.rotation.y = 0;
        bone.rotation.z = 0;
      } else {
        // Default idle
        bone.rotation.x = 0;
        bone.rotation.y = 0;
        bone.rotation.z = 0;
      }
    });
  });

  return <primitive object={scene} scale={1.4} position={[0, -0.8, 0]} />;
}

function LoadingFallback() {
  return (
    <mesh position={[0, -0.8, 0]}>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="cyan" wireframe />
    </mesh>
  );
}

export default function Hologram({ emotion }) {
  return (
    <div
      className="hologram-container"
    >
      <Canvas camera={{ position: [0, 1.2, 5], fov: 35 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <Suspense fallback={<LoadingFallback />}>
          <AvatarModel
            url="https://models.readyplayer.me/68d0e8b7cfced3382ad21320.glb"
            emotion={emotion}
          />
        </Suspense>
        <OrbitControls enableZoom={false} target={[0, 0.5, 0]} />
      </Canvas>
    </div>
  );
}

