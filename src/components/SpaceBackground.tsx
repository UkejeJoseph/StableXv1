import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function StarField({ count = 3000 }) {
    const ref = useRef<THREE.Points>(null);

    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
        }
        return pos;
    }, [count]);

    useFrame((_, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta * 0.02;
            ref.current.rotation.y += delta * 0.03;
        }
    });

    return (
        <>
            <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#ffffff"
                    size={0.04}
                    sizeAttenuation
                    depthWrite={false}
                    opacity={0.9}
                />
            </Points>
            {/* Secondary teal-colored star layer for depth */}
            <Points positions={positions} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#4FD1C5"
                    size={0.025}
                    sizeAttenuation
                    depthWrite={false}
                    opacity={0.5}
                />
            </Points>
        </>
    );
}

function FloatingOrbs() {
    const orbRef1 = useRef<THREE.Mesh>(null);
    const orbRef2 = useRef<THREE.Mesh>(null);
    const orbRef3 = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (orbRef1.current) {
            orbRef1.current.position.x = Math.sin(t * 0.3) * 3;
            orbRef1.current.position.y = Math.cos(t * 0.2) * 2;
        }
        if (orbRef2.current) {
            orbRef2.current.position.x = Math.cos(t * 0.4) * -2.5;
            orbRef2.current.position.y = Math.sin(t * 0.3) * 1.5;
        }
        if (orbRef3.current) {
            orbRef3.current.position.x = Math.sin(t * 0.2) * 2;
            orbRef3.current.position.y = Math.cos(t * 0.5) * -2;
        }
    });

    return (
        <>
            <mesh ref={orbRef1} position={[2, 1, -3]}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial color="#14B8A6" emissive="#14B8A6" emissiveIntensity={0.5} transparent opacity={0.3} />
            </mesh>
            <mesh ref={orbRef2} position={[-2, -1, -4]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <meshStandardMaterial color="#2B6CB0" emissive="#2B6CB0" emissiveIntensity={0.4} transparent opacity={0.25} />
            </mesh>
            <mesh ref={orbRef3} position={[0, 2, -5]}>
                <sphereGeometry args={[0.4, 16, 16]} />
                <meshStandardMaterial color="#4FD1C5" emissive="#4FD1C5" emissiveIntensity={0.3} transparent opacity={0.2} />
            </mesh>
        </>
    );
}

interface SpaceBackgroundProps {
    intensity?: 'full' | 'subtle';
}

export function SpaceBackground({ intensity = 'full' }: SpaceBackgroundProps) {
    const starCount = intensity === 'full' ? 3000 : 1000;

    return (
        <div className="fixed inset-0 -z-10" style={{ background: 'transparent' }}>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 60 }}
                style={{ background: 'transparent' }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.1} />
                <StarField count={starCount} />
                {intensity === 'full' && <FloatingOrbs />}
            </Canvas>
        </div>
    );
}
