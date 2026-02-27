import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "../ThemeProvider";

export default function StarBackground() {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });
    const { theme } = useTheme();

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Scene set up
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 1;

        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Stars geometry setup (5,000 points arranged in a sphere)
        const starsCount = 5000;
        const positions = new Float32Array(starsCount * 3);
        const velocities = new Float32Array(starsCount * 3); // For mouse avoidance 
        const originalPositions = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount; i++) {
            const i3 = i * 3;
            // Radius and angles to plot stars spherically
            const r = 1.5 * Math.pow(Math.random(), 1 / 3);
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            positions[i3] = x;
            positions[i3 + 1] = y;
            positions[i3 + 2] = z;

            originalPositions[i3] = x;
            originalPositions[i3 + 1] = y;
            originalPositions[i3 + 2] = z;

            velocities[i3] = 0;
            velocities[i3 + 1] = 0;
            velocities[i3 + 2] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Material setup (Emerald for dark mode, Slate for light mode)
        const isDark = theme === "dark";
        const material = new THREE.PointsMaterial({
            color: isDark ? 0x10b981 : 0x94a3b8, // emerald-500 vs slate-400
            size: isDark ? 0.003 : 0.002,
            sizeAttenuation: true,
            transparent: true,
            opacity: isDark ? 0.6 : 0.25,
            depthWrite: false,
            blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending
        });

        const points = new THREE.Points(geometry, material);
        scene.add(points);

        // Raycaster for accurately finding stars near mouse in 3D space
        const raycaster = new THREE.Raycaster();
        // Give the raycaster a slightly thicker line to make "hovering" stars easier
        raycaster.params.Points.threshold = 0.1;

        const mouse = new THREE.Vector2();

        // Handle mouse movement for parallax and avoidance
        const onMouseMove = (event: MouseEvent) => {
            // Normalized Device Coordinates (-1 to +1) for raycaster
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // Smoothed parallax movement coordinates
            mouseRef.current = {
                x: (event.clientX / window.innerWidth - 0.5) * 2,
                y: (event.clientY / window.innerHeight - 0.5) * 2
            };
        };

        window.addEventListener('mousemove', onMouseMove);

        // Handle window resize dynamically
        const onResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', onResize);

        // Continuous Animation loop
        let animationFrameId: number;
        let time = 0;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            time += 0.005;

            // Continuous auto-rotation
            points.rotation.y = time * 0.8;
            points.rotation.x = Math.sin(time * 0.5) * 0.3;
            points.rotation.z = Math.cos(time * 0.3) * 0.1;

            // Subtle mouse parallax added on top of rotation
            points.rotation.x += mouseRef.current.y * 0.03;
            points.rotation.y += mouseRef.current.x * 0.03;

            // Update Raycaster
            raycaster.setFromCamera(mouse, camera);

            // Get points data
            const positionsAttribute = geometry.attributes.position;
            const posArray = positionsAttribute.array as Float32Array;

            // Check for intersections
            const intersects = raycaster.intersectObject(points, false);

            // Set of indices we've repelled this frame
            const repelledIndices = new Set<number>();

            if (intersects.length > 0) {
                const repelStrength = 0.05;

                for (let i = 0; i < intersects.length; i++) {
                    const intersect = intersects[i];
                    if (intersect.index !== undefined) {
                        const idx = intersect.index;
                        repelledIndices.add(idx);

                        const i3 = idx * 3;

                        // Push star away from intersection point (basically away from ray)
                        // The mouse ray indicates the direction from camera to cursor.
                        // We want stars to scatter away from the center of that beam.

                        // Convert mouse 2D into a 3D point slightly away from the camera to repel from
                        const repelPoint = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(camera);

                        const starPos = new THREE.Vector3(posArray[i3], posArray[i3 + 1], posArray[i3 + 2]);
                        // We need the star's world position because intersection occurs in world space
                        starPos.applyMatrix4(points.matrixWorld);

                        const dir = new THREE.Vector3().subVectors(starPos, repelPoint).normalize();

                        // Add velocity in the direction away from the mouse
                        velocities[i3] += dir.x * repelStrength;
                        velocities[i3 + 1] += dir.y * repelStrength;
                        velocities[i3 + 2] += dir.z * repelStrength;
                    }
                }
            }

            // Apply velocities and spring-back logic
            const springForce = 0.05; // How fast they return
            const friction = 0.85; // How quickly they slow down

            for (let i = 0; i < starsCount; i++) {
                const i3 = i * 3;

                // Apply velocity
                posArray[i3] += velocities[i3];
                posArray[i3 + 1] += velocities[i3 + 1];
                posArray[i3 + 2] += velocities[i3 + 2];

                // Apply friction
                velocities[i3] *= friction;
                velocities[i3 + 1] *= friction;
                velocities[i3 + 2] *= friction;

                // Apply spring-back to original position if not currently being repelled
                if (!repelledIndices.has(i)) {
                    const dx = originalPositions[i3] - posArray[i3];
                    const dy = originalPositions[i3 + 1] - posArray[i3 + 1];
                    const dz = originalPositions[i3 + 2] - posArray[i3 + 2];

                    velocities[i3] += dx * springForce;
                    velocities[i3 + 1] += dy * springForce;
                    velocities[i3 + 2] += dz * springForce;
                }
            }

            positionsAttribute.needsUpdate = true;

            renderer.render(scene, camera);
        };

        animate();

        // Cleanup on unmount
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            cancelAnimationFrame(animationFrameId);
            container.removeChild(renderer.domElement);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            // Z-[50] drops it over the UI, pointer-events-none lets clicks pass right through!
            className="fixed inset-0 z-[50] pointer-events-none overflow-hidden"
        >
        </div>
    );
}
