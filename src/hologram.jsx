// Hologram.jsx
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import './hologram.css';

const SMILE_SHAPES = ['mouthSmile', 'mouthSmileLeft', 'mouthSmileRight', 'mouthDimpleLeft', 'mouthDimpleRight'];
const CHEEK_SHAPES = ['cheekSquintLeft', 'cheekSquintRight', 'cheekPuff'];
const BLINK_SHAPES = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'];
const BROW_UP = ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'];
const BROW_DOWN = ['browDownLeft', 'browDownRight'];
const FROWN_SHAPES = ['mouthFrownLeft', 'mouthFrownRight'];
const WIDE_SHAPES = ['eyeWideLeft', 'eyeWideRight'];
const MOUTH_OPEN = ['jawOpen', 'mouthOpen'];
const EYE_LOOK = [
  'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookDownLeft', 'eyeLookUpRight', 'eyeLookDownRight',
];

function findIdleClip(animations = []) {
  if (!animations?.length) return null;
  return animations.find((clip) => /idle(?:_|\s)?standing/i.test(clip?.name || ''))
    || animations.find((clip) => /idle/i.test(clip?.name || ''))
    || animations[0];
}

function AvatarModel({ emotion = 'neutral', isAnimating = false, spokenText = '', disableAnimations = false, poseMode = 'neutral', assetPreset = 'auto', onReady }) {
  const groupRef = useRef();
  const idleMixerRef = useRef(null);
  const meshesRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const blinkRef = useRef(0);
  const smileRef = useRef(0.55);
  const debugArmBonesRef = useRef(null);
  const boneRestPoseRef = useRef(new Map());
  const gestureStateRef = useRef({ mode: 'neutral', startedAt: 0 });

  const modelPaths = [assetPreset === 'avatar' ? '/sarah-avatar.glb' : '/sarah-idle.glb'];
  const loadedModels = useGLTF(modelPaths);
  const selectedModel = loadedModels[0];
  const displayScene = selectedModel.scene;
  const activeAnims = selectedModel.animations;

  const debugArmBoneTransforms = (scene) => {
    if (!scene) return;

    const armBones = [];
    scene.traverse((child) => {
      if (!child.isBone) return;
      const name = child.name.toLowerCase();
      if (/(upper|fore|hand|wrist|clavicle|shoulder)/i.test(name)) {
        armBones.push({
          name: child.name,
          position: child.position.clone(),
          quaternion: child.quaternion.clone(),
        });
      }
    });

    if (armBones.length > 0) {
      console.info('[hologram] arm bone transforms', armBones);
    }
  };

  useEffect(() => {
    if (!displayScene) return;
    onReady?.();
    const found = [];
    displayScene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        child.frustumCulled = false;
        found.push(child);
      }
      if (child.isBone) boneRestPoseRef.current.set(child.name, child.quaternion.clone());
    });
    meshesRef.current = found;

    found.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      EYE_LOOK.forEach((name) => {
        if (name in dict) inf[dict[name]] = 0;
        const pascal = name.charAt(0).toUpperCase() + name.slice(1);
        if (pascal in dict) inf[dict[pascal]] = 0;
      });
    });
  }, [displayScene, onReady]);

  useEffect(() => {
    if (!displayScene) return;

    const boneNames = [];
    displayScene.traverse((child) => {
      if (child.isBone) boneNames.push(child.name);
    });

    const armBones = boneNames.filter((name) => /(upper|fore|hand|wrist|clavicle|shoulder)/i.test(name));
    console.info('[hologram] all bones', boneNames);
    console.info('[hologram] armature bones', armBones);

    if ((assetPreset === 'idle' || !disableAnimations) && activeAnims && activeAnims.length > 0) {
      const idleClip = findIdleClip(activeAnims);
      const animatedBones = idleClip?.tracks
        ? [...new Set(idleClip.tracks.map((track) => track.name.split('.').slice(0, -1).join('.')))]
        : [];
      const animatedArmBones = animatedBones.filter((name) => /(upper|fore|hand|wrist|clavicle|shoulder)/i.test(name));

      console.info('[hologram] idle clip', idleClip?.name || 'n/a');
      console.info('[hologram] idle clip animated bones', animatedBones);
      console.info('[hologram] idle clip animated arm bones', animatedArmBones);

      if (idleMixerRef.current) idleMixerRef.current.stopAllAction();
      const mixer = new THREE.AnimationMixer(displayScene);
      idleMixerRef.current = mixer;
      const action = idleClip ? mixer.clipAction(idleClip) : null;
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = true;
        action.play();
        mixer.update(0.001);
        debugArmBoneTransforms(displayScene);
        debugArmBonesRef.current = animatedArmBones;
      }
    }

    return () => {
      if (idleMixerRef.current) {
        idleMixerRef.current.stopAllAction();
        idleMixerRef.current = null;
      }
    };
  }, [displayScene, activeAnims, assetPreset, disableAnimations]);

  useEffect(() => {
    smileRef.current = isAnimating ? 0.25 : 0.55;
  }, [isAnimating]);

  useEffect(() => {
    if (!poseMode.startsWith('navigation-')) return;
    gestureStateRef.current = {
      mode: poseMode,
      startedAt: clockRef.current.getElapsedTime(),
    };
  }, [poseMode]);

  const lerpMorph = (name, target, speed = 0.1) => {
    meshesRef.current.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      if (name in dict) {
        inf[dict[name]] = THREE.MathUtils.lerp(inf[dict[name]], target, speed);
        return;
      }
      const pascal = name.charAt(0).toUpperCase() + name.slice(1);
      if (pascal in dict) {
        inf[dict[pascal]] = THREE.MathUtils.lerp(inf[dict[pascal]], target, speed);
      }
    });
  };

  const clearMorph = (name) => lerpMorph(name, 0, 0.12);

  const getBone = (scene, side, segment) => {
    let result = null;
    const pattern = new RegExp(`${side}${segment}`, 'i');
    scene.traverse((child) => {
      if (!result && child.isBone && pattern.test(child.name)) result = child;
    });
    return result;
  };

  const pointBoneToward = (bone, targetDirection, amount = 0.14) => {
    const endpoint = bone?.children.find((child) => child.isBone);
    if (!bone || !endpoint) return null;

    const bonePosition = bone.getWorldPosition(new THREE.Vector3());
    const endpointPosition = endpoint.getWorldPosition(new THREE.Vector3());
    const currentDirection = endpointPosition.sub(bonePosition).normalize();
    const desiredDirection = targetDirection.clone().normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(currentDirection, desiredDirection);
    const currentWorldRotation = bone.getWorldQuaternion(new THREE.Quaternion());
    const targetWorldRotation = delta.multiply(currentWorldRotation);
    const parentWorldRotation = bone.parent?.getWorldQuaternion(new THREE.Quaternion()).invert();
    const targetLocalRotation = parentWorldRotation
      ? parentWorldRotation.multiply(targetWorldRotation)
      : targetWorldRotation;
    bone.quaternion.slerp(targetLocalRotation, amount);
    bone.updateMatrixWorld(true);
  };

  const applyPointingPose = (scene, side, screenDirection, gestureWeight) => {
    scene.updateMatrixWorld(true);
    const arm = getBone(scene, side, 'Arm');
    const forearm = getBone(scene, side, 'ForeArm');
    const hand = getBone(scene, side, 'Hand');
    const horizontal = new THREE.Vector3(screenDirection, 0, 0);

    // The GLB faces the camera: avatar-left is visitor-right, and vice versa.
    pointBoneToward(arm, horizontal.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.68, 0)), 0.42 * gestureWeight);
    scene.updateMatrixWorld(true);
    pointBoneToward(forearm, horizontal.clone().multiplyScalar(0.58).add(new THREE.Vector3(0, 0.42, 0)), 0.38 * gestureWeight);
    const handRest = boneRestPoseRef.current.get(hand?.name);
    if (hand && handRest) {
      const relaxedWrist = handRest.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -screenDirection * 0.1)));
      hand.quaternion.slerp(relaxedWrist, 0.12 * gestureWeight);
    }
  };

  const getGestureWeight = (time) => {
    if (!poseMode.startsWith('navigation-')) return 0;
    const elapsed = Math.max(0, time - gestureStateRef.current.startedAt);
    const rise = THREE.MathUtils.smoothstep(elapsed, 0, 0.45);
    if (isAnimating || elapsed < 1.7) return rise;
    return rise * (1 - THREE.MathUtils.smoothstep(elapsed, 1.7, 2.35));
  };

  const applyPoseMode = (scene, time) => {
    if (!scene) return;

    const pointingSide = poseMode === 'navigation-right' ? 'left' : poseMode === 'navigation-left' ? 'right' : null;
    const screenDirection = poseMode === 'navigation-right' ? 1 : -1;
    const gestureWeight = getGestureWeight(time);
    if (pointingSide && gestureWeight > 0.01) {
      applyPointingPose(scene, pointingSide, screenDirection, gestureWeight);
      const head = getBone(scene, '', 'Head');
      const headRest = boneRestPoseRef.current.get(head?.name);
      if (head && headRest) {
        const headTarget = headRest.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, screenDirection * 0.14, 0)));
        head.quaternion.slerp(headTarget, 0.08 * gestureWeight);
      }
    }

    scene.traverse((child) => {
      if (!child.isBone) return;

      const name = child.name.toLowerCase();
      if ((name.includes('head') || name.includes('neck')) && poseMode === 'wave' && isAnimating) {
        const lean = Math.sin(time * 2.4) * 0.03;
        const tilt = Math.sin(time * 1.8) * 0.02;
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, lean, 0));
        child.quaternion.slerp(target, 0.08);
      }

      if (poseMode === 'navigation-start' && /head|neck/i.test(name)) {
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(time * 2) * 0.025, 0, 0));
        child.quaternion.slerp(target, 0.1);
      }

      if (poseMode === 'navigation-forward' && /spine|chest|upperbody/i.test(name)) {
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.035, 0, 0));
        child.quaternion.slerp(target, 0.1);
      }

      if (poseMode === 'navigation-arrived' && /head|neck/i.test(name)) {
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(time * 5) * 0.035, 0, 0));
        child.quaternion.slerp(target, 0.12);
      }
    });
  };

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (!disableAnimations && idleMixerRef.current) {
      idleMixerRef.current.update(delta);
    }

    if (displayScene) {
      displayScene.visible = true;
      applyPoseMode(displayScene, clockRef.current.getElapsedTime());
    }

    if (meshesRef.current.length === 0) return;
    const t = clockRef.current.getElapsedTime();

    SMILE_SHAPES.forEach((s) => lerpMorph(s, smileRef.current, 0.06));
    CHEEK_SHAPES.forEach((s) => lerpMorph(s, smileRef.current * 0.25, 0.06));

    if (isAnimating && spokenText) {
      const jawRhythm = (Math.sin(t * 8.0) * 0.5 + 0.5) * 0.30;
      const jawVariant = Math.sin(t * 5.0) * 0.08;
      const jawTarget = Math.max(0, jawRhythm + jawVariant);
      MOUTH_OPEN.forEach((s) => lerpMorph(s, jawTarget, 0.25));
    } else {
      MOUTH_OPEN.forEach((s) => lerpMorph(s, 0, 0.1));
    }

    if (!isAnimating) {
      blinkRef.current += delta;
      const phase = blinkRef.current % 4.5;
      const blinkVal = phase < 0.2 ? Math.sin((phase / 0.2) * Math.PI) : 0;
      BLINK_SHAPES.forEach((s) => lerpMorph(s, blinkVal, 0.9));
    } else {
      blinkRef.current = 0;
      BLINK_SHAPES.forEach((s) => lerpMorph(s, 0, 0.9));
    }

    switch (emotion?.toLowerCase()) {
      case 'happy':
        BROW_UP.forEach((s) => lerpMorph(s, 0.2, 0.06));
        BROW_DOWN.forEach((s) => clearMorph(s));
        FROWN_SHAPES.forEach((s) => clearMorph(s));
        break;
      case 'sad':
        lerpMorph('browInnerUp', 0.45, 0.06);
        BROW_DOWN.forEach((s) => lerpMorph(s, 0.25, 0.06));
        FROWN_SHAPES.forEach((s) => lerpMorph(s, 0.38, 0.06));
        break;
      case 'surprised':
        WIDE_SHAPES.forEach((s) => lerpMorph(s, 0.65, 0.06));
        BROW_UP.forEach((s) => lerpMorph(s, 0.6, 0.06));
        break;
      case 'angry':
        BROW_DOWN.forEach((s) => lerpMorph(s, 0.55, 0.06));
        lerpMorph('noseSneerLeft', 0.25, 0.06);
        lerpMorph('noseSneerRight', 0.25, 0.06);
        SMILE_SHAPES.forEach((s) => lerpMorph(s, 0, 0.06));
        break;
      default:
        BROW_UP.forEach((s) => clearMorph(s));
        BROW_DOWN.forEach((s) => clearMorph(s));
        FROWN_SHAPES.forEach((s) => clearMorph(s));
        break;
    }

    if (groupRef.current) {
      groupRef.current.position.y = 0.08;
      const poseRotation = {
        x: poseMode === 'navigation-forward' ? -0.045 : 0,
        y: 0,
        z: 0,
      };
      groupRef.current.rotation.z = poseRotation.z;
      groupRef.current.rotation.x = poseRotation.x + (isAnimating ? Math.sin(t * 1.0) * 0.008 : 0);
      groupRef.current.rotation.y = poseRotation.y + (isAnimating ? Math.sin(t * 1.5) * 0.012 : 0);
      if (poseMode === 'navigation-start' || poseMode === 'navigation-arrived') {
        groupRef.current.position.y = 0.08 + Math.max(0, Math.sin(t * 3)) * 0.035;
        groupRef.current.rotation.z = Math.sin(t * 2.5) * 0.045;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={displayScene} position={[0, 0.04, 0]} scale={1.02} />
    </group>
  );
}

function LoadingFallback() {
  return (
    <mesh position={[0, -0.8, 0]}>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="#5ec7ff" wireframe />
    </mesh>
  );
}

export default function Hologram({ emotion, isAnimating = false, spokenText = '', disableAnimations = false, poseMode = 'neutral', assetPreset = 'auto', onReady }) {
  const [contextGeneration, setContextGeneration] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const canvasRef = useRef(null);
  const lowMemoryDevice = typeof navigator !== 'undefined' && Number(navigator.deviceMemory || 8) <= 4;

  const handleCreated = ({ gl }) => {
    const canvas = gl.domElement;
    if (canvasRef.current === canvas) return;
    canvasRef.current = canvas;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      setContextLost(true);
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      setContextLost(false);
      setContextGeneration((generation) => generation + 1);
    }, false);
  };

  return (
    <div className="hologram-container">
      <Canvas
        key={contextGeneration}
        camera={{ position: [0, 1.3, 4.3], fov: 30 }}
        dpr={lowMemoryDevice ? 1 : [1, 1.25]}
        gl={{ antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false }}
        performance={{ min: 0.5, max: 1, debounce: 200 }}
        onCreated={handleCreated}
      >
        <PerspectiveCamera makeDefault position={[0, 1.35, 3.7]} fov={30} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} />
        <pointLight position={[0, 3, 3]} intensity={0.4} color="#ffffff" />
        <Suspense fallback={<LoadingFallback />}>
          <AvatarModel onReady={onReady} emotion={emotion} isAnimating={isAnimating} spokenText={spokenText} disableAnimations={disableAnimations} poseMode={poseMode} assetPreset={assetPreset} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} target={[0, 1.18, 0]} minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} />
      </Canvas>
      {contextLost && <div className="avatar-placeholder" role="status">Restoring TAYLOR display...</div>}
    </div>
  );
}

