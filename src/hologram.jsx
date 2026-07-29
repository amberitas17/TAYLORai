// Hologram.jsx
import React, { Suspense, useEffect, useRef } from 'react';
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

function capturePose(scene) {
  const pose = {};
  scene.traverse((child) => {
    if (child.isBone) {
      pose[child.name] = {
        position: child.position.clone(),
        quaternion: child.quaternion.clone(),
        scale: child.scale.clone(),
      };
    }
  });
  return pose;
}

function applyPoseWithCorrection(targetScene, pose, alpha, rotationY = 0) {
  const correction = new THREE.Quaternion();
  correction.setFromEuler(new THREE.Euler(0, rotationY, 0));

  targetScene.traverse((child) => {
    if (child.isBone && pose[child.name]) {
      child.position.lerp(pose[child.name].position, alpha);
      if (child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('root') || (child.name.toLowerCase().includes('spine') && !child.parent?.isBone)) {
        const corrected = pose[child.name].quaternion.clone().multiply(correction);
        child.quaternion.slerp(corrected, alpha);
      } else {
        child.quaternion.slerp(pose[child.name].quaternion, alpha);
      }
      child.scale.lerp(pose[child.name].scale, alpha);
    }
  });
}

function buildNeutralStandingPose(scene) {
  const pose = capturePose(scene);

  scene.traverse((child) => {
    if (!child.isBone) return;

    const name = child.name.toLowerCase();
    const isLeft = name.includes('left');
    const isRight = name.includes('right');

    if (/upperarm|upper_arm|shoulder|clavicle/.test(name) && pose[child.name]) {
      const sideSign = isLeft ? 1 : -1;
      const adjust = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.95, 0, sideSign * 0.18));
      pose[child.name].quaternion.multiply(adjust);
    }

    if (/forearm|lowerarm|elbow/.test(name) && pose[child.name]) {
      const sideSign = isLeft ? 1 : -1;
      const bend = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, sideSign * -0.12));
      pose[child.name].quaternion.multiply(bend);
    }

    if (/hand|wrist/.test(name) && pose[child.name]) {
      const sideSign = isLeft ? 1 : -1;
      const relax = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18, 0, sideSign * -0.05));
      pose[child.name].quaternion.multiply(relax);
    }

    if (/shoulder|clavicle/.test(name) && pose[child.name]) {
      const sideSign = isLeft ? 1 : -1;
      const relaxShoulder = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, sideSign * 0.05));
      pose[child.name].quaternion.multiply(relaxShoulder);
    }
  });

  return pose;
}

function findIdleClip(animations = []) {
  if (!animations?.length) return null;
  return animations.find((clip) => /idle(?:_|\s)?standing/i.test(clip?.name || ''))
    || animations.find((clip) => /idle/i.test(clip?.name || ''))
    || animations[0];
}

function AvatarModel({ emotion = 'neutral', isAnimating = false, spokenText = '', disableAnimations = false, poseMode = 'neutral', assetPreset = 'auto' }) {
  const groupRef = useRef();
  const idleMixerRef = useRef(null);
  const meshesRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const blinkRef = useRef(0);
  const smileRef = useRef(0.55);
  const debugArmBonesRef = useRef(null);

  const { scene: avatarScene, animations: avatarAnims } = useGLTF('/sarah-avatar.glb');
  const { scene: idleScene, animations: idleAnims } = useGLTF('/sarah-idle.glb');
  const displayScene = assetPreset === 'idle' ? idleScene : assetPreset === 'avatar' ? avatarScene : (idleScene || avatarScene);
  const activeAnims = assetPreset === 'idle'
    ? (idleAnims || [])
    : assetPreset === 'avatar'
      ? (avatarAnims || [])
      : (idleAnims?.length ? idleAnims : avatarAnims);

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
    const found = [];
    displayScene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        child.frustumCulled = false;
        found.push(child);
      }
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
  }, [displayScene]);

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
  }, [displayScene, activeAnims, disableAnimations]);

  useEffect(() => {
    smileRef.current = isAnimating ? 0.25 : 0.55;
  }, [isAnimating]);

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
  const zeroMorph = (name) => lerpMorph(name, 0, 1.0);

  const applyPoseMode = (scene, time) => {
    if (!scene) return;

    scene.traverse((child) => {
      if (!child.isBone) return;

      const name = child.name.toLowerCase();
      if ((name.includes('head') || name.includes('neck')) && poseMode === 'wave' && isAnimating) {
        const lean = Math.sin(time * 2.4) * 0.03;
        const tilt = Math.sin(time * 1.8) * 0.02;
        const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, lean, 0));
        child.quaternion.slerp(target, 0.08);
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
      groupRef.current.rotation.z = 0;
      groupRef.current.rotation.x = isAnimating ? Math.sin(t * 1.0) * 0.008 : 0;
      groupRef.current.rotation.y = isAnimating ? Math.sin(t * 1.5) * 0.012 : 0;
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

export default function Hologram({ emotion, isAnimating = false, spokenText = '', disableAnimations = false, poseMode = 'neutral', assetPreset = 'auto' }) {
  return (
    <div className="hologram-container">
      <Canvas camera={{ position: [0, 1.3, 4.3], fov: 30 }} dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 1.35, 2.9]} fov={30} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} />
        <pointLight position={[0, 3, 3]} intensity={0.4} color="#ffffff" />
        <Suspense fallback={<LoadingFallback />}>
          <AvatarModel emotion={emotion} isAnimating={isAnimating} spokenText={spokenText} disableAnimations={disableAnimations} poseMode={poseMode} assetPreset={assetPreset} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} target={[0, 1.18, 0]} minPolarAngle={Math.PI / 2} maxPolarAngle={Math.PI / 2} />
      </Canvas>
    </div>
  );
}

