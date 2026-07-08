"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

const HUMAN_MODEL_URL = "https://threejs.org/examples/models/gltf/Xbot.glb";

useGLTF.preload(HUMAN_MODEL_URL);

type Tone = "ok" | "warn" | "info";

const toneColor: Record<Tone, string> = {
  ok: "#38f0b4",
  warn: "#ffb648",
  info: "#7dd3fc",
};

export type TwinNode3D = {
  id: string;
  info?: string;
  label: string;
  value: number;
  tone: Tone;
  pos: [number, number, number];
};

const defaultNodes: TwinNode3D[] = [
  {
    id: "uv",
    label: "UV / Skin",
    value: 61,
    tone: "warn",
    pos: [0, 1.65, 0.18],
    info: "Estimates outdoor skin and eye exposure from the strongest UV window in the local forecast.",
  },
  {
    id: "resp",
    label: "Respiratory",
    value: 72,
    tone: "warn",
    pos: [0.05, 1.1, 0.25],
    info: "Combines illness activity, air quality, and pollutant context that can affect breathing.",
  },
  {
    id: "cardio",
    label: "Cardio",
    value: 44,
    tone: "info",
    pos: [-0.12, 0.95, 0.25],
    info: "Represents heat stress and exertion burden from temperature, humidity, and baseline risk.",
  },
  {
    id: "immune",
    label: "Immune",
    value: 38,
    tone: "ok",
    pos: [0.1, 0.65, 0.25],
    info: "Shows how illness and environmental stressors are stacking in the current local snapshot.",
  },
  {
    id: "hydration",
    label: "Hydration",
    value: 55,
    tone: "info",
    pos: [0, 0.35, 0.25],
    info: "Flags heat and activity conditions where fluid breaks may matter more.",
  },
];

function Humanoid() {
  const { scene } = useGLTF(HUMAN_MODEL_URL) as unknown as {
    scene: THREE.Group;
  };
  const groupRef = useRef<THREE.Group>(null);

  const { holoScene, points } = useMemo(() => {
    const cyan = new THREE.Color("#7dd3fc");
    const iceBlue = new THREE.Color("#bfe6ff");
    const holoMat = new THREE.MeshPhysicalMaterial({
      color: iceBlue,
      emissive: new THREE.Color("#4B9CD3"),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.15,
      transmission: 0.55,
      thickness: 1.2,
      transparent: true,
      opacity: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
      flatShading: false,
    });
    const holo = scene.clone(true);

    holo.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (mesh.isMesh) {
        const geometry = mesh.geometry as THREE.BufferGeometry;

        if (geometry?.attributes.position) {
          const cloned = geometry.clone();
          cloned.computeVertexNormals();
          mesh.geometry = cloned;
        }

        mesh.material = holoMat;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });

    const particleCount = 6000;
    const positions = new Float32Array(particleCount * 3);
    const meshes: THREE.Mesh[] = [];

    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;

      if (
        mesh.isMesh &&
        mesh.geometry &&
        (mesh.geometry as THREE.BufferGeometry).attributes.position
      ) {
        meshes.push(mesh);
      }
    });

    if (meshes.length > 0) {
      const samplers = meshes.map((mesh) => {
        mesh.updateWorldMatrix(true, false);
        mesh.geometry.computeBoundingSphere();

        return {
          mesh,
          sampler: new MeshSurfaceSampler(mesh).build(),
          weight: (mesh.geometry.boundingSphere?.radius ?? 1) ** 2,
        };
      });
      const totalWeight = samplers.reduce(
        (total, sampler) => total + sampler.weight,
        0
      );
      const temp = new THREE.Vector3();

      for (let index = 0; index < particleCount; index += 1) {
        let roll = Math.random() * totalWeight;
        let selected = samplers[0];

        for (const sampler of samplers) {
          roll -= sampler.weight;
          if (roll <= 0) {
            selected = sampler;
            break;
          }
        }

        selected.sampler.sample(temp);
        temp.applyMatrix4(selected.mesh.matrixWorld);
        positions[index * 3] = temp.x;
        positions[index * 3 + 1] = temp.y;
        positions[index * 3 + 2] = temp.z;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: cyan,
      size: 0.014,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { holoScene: holo, points: new THREE.Points(geometry, material) };
  }, [scene]);

  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.2) * 0.006;
    groupRef.current?.scale.set(pulse, pulse, pulse);
  });

  return (
    <group ref={groupRef} position={[0, -0.95, 0]}>
      <primitive object={holoScene} />
      <primitive object={points} />
      <pointLight
        position={[-0.05, 1.15, 0.15]}
        color="#4B9CD3"
        intensity={2.4}
        distance={2.5}
      />
      <mesh position={[-0.05, 1.15, 0.18]}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function ScanRing() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (ref.current) {
      ref.current.position.y = Math.sin(elapsed * 0.9) * 1.25 + 0.15;
      const material = ref.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.cos(elapsed * 0.9));
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.82, 0.012, 8, 64]} />
      <meshBasicMaterial color="#7dd3fc" transparent opacity={0.6} />
    </mesh>
  );
}

function NodeMarker({
  active,
  node,
  onActivate,
  onDeactivate,
  onTogglePin,
  pinned,
}: {
  active: boolean;
  node: TwinNode3D;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onTogglePin: (id: string) => void;
  pinned: boolean;
}) {
  const color = toneColor[node.tone];
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const scale = 1 + 0.35 * Math.sin(clock.getElapsedTime() * 2 + node.pos[1] * 3);
    ref.current?.scale.setScalar(scale);
  });

  return (
    <group position={node.pos}>
      <mesh>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ref}>
        <ringGeometry args={[0.045, 0.06, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Html
        distanceFactor={6}
        position={[node.pos[0] > 0 ? 0.4 : -0.4, 0.02, 0]}
        style={{ pointerEvents: "auto", transform: "translate(-50%, -50%)" }}
      >
        <div
          className="twin3d-node-wrap"
          onMouseEnter={() => onActivate(node.id)}
          onMouseLeave={() => onDeactivate(node.id)}
        >
          <button
            type="button"
            aria-expanded={active}
            className={`twin3d-node-label ${active ? "is-active" : ""}`}
            onBlur={() => onDeactivate(node.id)}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(node.id);
            }}
            onFocus={() => onActivate(node.id)}
          >
            <span
              className="twin3d-node-dot"
              style={{ background: color, boxShadow: `0 0 8px ${color}` }}
            />
            <span className="twin3d-node-name">{node.label}</span>
            <span className="twin3d-node-value">{node.value}</span>
          </button>
          {active && (
            <div className="twin3d-node-popover">
              <p className="twin3d-node-popover-title">{node.label}</p>
              <p>
                {node.info ??
                  "This layer contributes to the exposure twin score."}
              </p>
              <span>{pinned ? "Click again to unpin" : "Click to pin"}</span>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

function FloorDisc() {
  return (
    <group position={[0, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.5, 1.6, 64]} />
        <meshBasicMaterial
          color="#4B9CD3"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh>
        <ringGeometry args={[0.32, 0.36, 64]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function Twin3D({
  className = "",
  nodes = defaultNodes,
  scanLabel = "SCAN · LIVE",
}: {
  className?: string;
  nodes?: TwinNode3D[];
  scanLabel?: string;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const activeNodeId = pinnedNodeId ?? hoveredNodeId;

  const handleDeactivate = (id: string) => {
    if (pinnedNodeId !== id) {
      setHoveredNodeId(null);
    }
  };

  const handleTogglePin = (id: string) => {
    setPinnedNodeId((current) => (current === id ? null : id));
    setHoveredNodeId(id);
  };

  return (
    <div className={`twin3d-root ${className}`}>
      <div className="twin3d-grid" />
      <div className="twin3d-aura" />

      <div className="twin3d-stage">
        <Canvas
          camera={{ position: [0, 0.6, 4.2], fov: 32 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.45} />
          <pointLight position={[3, 3, 4]} intensity={1.4} color="#7dd3fc" />
          <pointLight position={[-3, 2, 3]} intensity={0.9} color="#4B9CD3" />
          <pointLight position={[0, -2, 3]} intensity={0.5} color="#bfe6ff" />
          <directionalLight
            position={[0, 4, 5]}
            intensity={0.4}
            color="#e6f4ff"
          />

          <Suspense fallback={null}>
            <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.35}>
              <group>
                <Humanoid />
                <ScanRing />
                {nodes.map((node) => (
                  <NodeMarker
                    key={node.id}
                    active={activeNodeId === node.id}
                    node={node}
                    onActivate={setHoveredNodeId}
                    onDeactivate={handleDeactivate}
                    onTogglePin={handleTogglePin}
                    pinned={pinnedNodeId === node.id}
                  />
                ))}
              </group>
            </Float>
            <FloorDisc />
          </Suspense>

          <OrbitControls
            autoRotate
            autoRotateSpeed={0.9}
            enablePan={false}
            enableZoom
            maxDistance={7}
            maxPolarAngle={Math.PI / 1.7}
            minDistance={3}
            minPolarAngle={Math.PI / 3.4}
            target={[0, 0.55, 0]}
          />
        </Canvas>
      </div>

      <div className="twin3d-hud twin3d-hud-tl">
        TWIN·v2.1 <span>/ live 3D</span>
      </div>
      <div className="twin3d-hud twin3d-hud-bl">{scanLabel}</div>
      <div className="twin3d-hud twin3d-hud-br">DRAG · ROTATE · ZOOM</div>
    </div>
  );
}

export default Twin3D;
