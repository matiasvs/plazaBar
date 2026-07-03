import './style.css';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerController } from './player.js';
import Stats from 'stats.js';

(async () => {
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.right = '0px';
    stats.dom.style.left = 'auto';
    document.body.appendChild(stats.dom);

    const renderer = new THREE.WebGPURenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });
    await renderer.init();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 5);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const loader = new GLTFLoader();
    const colliders = [];

    try {
        const pisoBaseGltf = await loader.loadAsync('models/pisoBase.glb');
        const modelPiso = pisoBaseGltf.scene;
        modelPiso.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = 0;
                child.material.colorWrite = false;
                child.material.depthWrite = false;
                child.material.side = THREE.DoubleSide;
            }
        });
        scene.add(modelPiso);
        colliders.push(modelPiso);
        console.log('✅ pisoBase cargado');
    } catch (err) {
        console.warn('⚠️ pisoBase no encontrado — el jugador no tendrá suelo:', err.message);
    }

    const playerAnchor = new THREE.Group();
    playerAnchor.name = 'PlayerAnchor';
    playerAnchor.position.set(0, 5, 0);
    scene.add(playerAnchor);

    const player = new PlayerController(camera, scene, playerAnchor, renderer.domElement, colliders);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const clock = new THREE.Clock();
    function animate() {
        const delta = clock.getDelta();
        player.update(delta);
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
})();
