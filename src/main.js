import './style.css';
import * as THREE from 'three/webgpu';
import { pass, output, normalView, mrt, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { PlayerController } from './player.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import { setupEnvironment, setupSun, setupFog } from './scene.js';
import { setupInteraction } from './interaction.js';

const basePath = import.meta.env.BASE_URL;

// Inicialización Principal
(async () => {
    // Setup Stats
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = 'auto'; // Reset left default
    stats.dom.style.right = '0px'; // Set right
    document.body.appendChild(stats.dom);

    // 2. Setup Básico (WebGPURenderer)
    const renderer = new THREE.WebGPURenderer({
        antialias: true,
        powerPreference: "high-performance"
    });
    await renderer.init();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.0; // Valor estándar para AgX

    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // 3. Iluminación y Ambiente
    await setupEnvironment(renderer, scene);
    const { light: sunLight, hemiLight, lightHelper } = setupSun(scene);
    const fog = setupFog(scene);

    // Loader
    const loader = new GLTFLoader();

    // Array para objetos colisionables (PisoBase)
    const colliders = [];

    // Cargar PisoBase (modelo invisible para colisiones)
    try {
        const pisoBaseGltf = await loader.loadAsync(`${basePath}models/pisoBase.glb`);
        const modelPiso = pisoBaseGltf.scene;

        modelPiso.traverse((child) => {
            if (child.isLight) {
                child.visible = false;
                child.intensity = 0;
            }
            if (child.isMesh) {
                child.material.color.set(0xCBC3E3);
                child.material.side = THREE.DoubleSide;
                child.receiveShadow = true;
                child.material.transparent = true;
                child.material.opacity = 0;
                child.material.colorWrite = false;
                child.material.depthWrite = false;
            }
        });

        scene.add(modelPiso);
        colliders.push(modelPiso);
        console.log("PisoBase cargado correctamente.");
    } catch (err) {
        console.error("Error cargando pisoBase:", err);
        console.warn("El jugador no tendrá superficie para caminar sin pisoBase.");
    }

    // Cargar hall12.glb (modelo principal del hall)
    try {
        const hall12Gltf = await loader.loadAsync(`${basePath}models/hall14.glb`);
        const modelHall = hall12Gltf.scene;

        modelHall.traverse((child) => {
            if (child.isLight) {
                child.visible = false;
                child.intensity = 0;
            }
            if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
            }
        });

        scene.add(modelHall);
        colliders.push(modelHall);
        console.log("hall14.glb cargado correctamente.");
    } catch (err) {
        console.error("Error cargando hall14.glb:", err);
    }

    // Controles de Jugador
    const playerAnchor = new THREE.Group();
    playerAnchor.name = "PlayerAnchor";
    playerAnchor.position.set(0, 5, 0);
    scene.add(playerAnchor);

    const player = new PlayerController(camera, scene, playerAnchor, renderer.domElement, colliders);
    console.log("Controlador de jugador inicializado.");

    // Configuración WebGPU
    const webgpuSettings = {
        enabled: false,
        bloomThreshold: 1.005,
        bloomStrength: 0.4,
        bloomRadius: 0.85,
        aoRadius: 0.5,
        aoScale: 1.0,
        aoThickness: 1.0,
        smaaEnabled: true
    };

    // Configuración del Sol/Luz
    const sunSettings = {
        elevation: 11.44,
        azimuth: 10.44,
        intensity: 0.33,
        temperature: 1111 // Temperatura en Kelvin (6500 = luz blanca estándar)
    };

    // Niebla desactivada
    scene.fog = null;

    // Función para convertir temperatura Kelvin a color RGB
    function kelvinToRGB(kelvin) {
        let temp = kelvin / 100;
        let r, g, b;

        if (temp <= 66) {
            r = 255;
            g = temp;
            g = 99.4708025861 * Math.log(g) - 161.1195681661;
            if (temp <= 19) {
                b = 0;
            } else {
                b = temp - 10;
                b = 138.5177312231 * Math.log(b) - 305.0447927307;
            }
        } else {
            r = temp - 60;
            r = 329.698727446 * Math.pow(r, -0.1332047592);
            g = temp - 60;
            g = 288.1221695283 * Math.pow(g, -0.0755148492);
            b = 255;
        }

        return {
            r: Math.max(0, Math.min(255, r)) / 255,
            g: Math.max(0, Math.min(255, g)) / 255,
            b: Math.max(0, Math.min(255, b)) / 255
        };
    }

    // Función para actualizar posición del sol
    function updateSunPosition() {
        const clampedElevation = Math.max(0, sunSettings.elevation);
        const phi = THREE.MathUtils.degToRad(90 - clampedElevation);
        const theta = THREE.MathUtils.degToRad(sunSettings.azimuth);
        const sunPos = new THREE.Vector3().setFromSphericalCoords(100, phi, theta);

        if (sunPos.y < 0) {
            sunPos.y = Math.abs(sunPos.y);
            sunPos.x = -sunPos.x;
            sunPos.z = -sunPos.z;
        }

        sunLight.position.copy(sunPos);
        sunLight.intensity = sunSettings.intensity;

        // Actualizar color según temperatura
        const color = kelvinToRGB(sunSettings.temperature);
        sunLight.color.setRGB(color.r, color.g, color.b);

        if (lightHelper) lightHelper.update();
    }

    // Panel de Control WebGPU
    const gui = new GUI({ title: 'WebGPU Features' });
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '0px';
    gui.domElement.style.right = '0px';

    const webgpuFolder = gui.addFolder('WebGPU Settings');
    webgpuFolder.add(webgpuSettings, 'enabled').name('Enable WebGPU').onChange((value) => {
        updateRenderPipeline();
    });

    // Sliders para propiedades (inicialmente deshabilitados)
    const bloomFolder = gui.addFolder('Bloom');
    const bloomThreshold = bloomFolder.add(webgpuSettings, 'bloomThreshold', 0, 3).name('Threshold').onChange(updateRenderPipeline).disable();
    const bloomStrength = bloomFolder.add(webgpuSettings, 'bloomStrength', 0, 2).name('Strength').onChange(updateRenderPipeline).disable();
    const bloomRadius = bloomFolder.add(webgpuSettings, 'bloomRadius', 0, 2).name('Radius').onChange(updateRenderPipeline).disable();

    const aoFolder = gui.addFolder('Ambient Occlusion');
    const aoRadius = aoFolder.add(webgpuSettings, 'aoRadius', 0, 2).name('Radius').onChange(updateRenderPipeline).disable();
    const aoScale = aoFolder.add(webgpuSettings, 'aoScale', 0, 3).name('Scale').onChange(updateRenderPipeline).disable();
    const aoThickness = aoFolder.add(webgpuSettings, 'aoThickness', 0, 3).name('Thickness').onChange(updateRenderPipeline).disable();

    const smaaFolder = gui.addFolder('Anti-Aliasing');
    const smaaEnabled = smaaFolder.add(webgpuSettings, 'smaaEnabled').name('SMAA').onChange(updateRenderPipeline).disable();

    // Controles del Sol/Luz (siempre habilitados)
    const sunFolder = gui.addFolder('Sun/Light');
    sunFolder.add(sunSettings, 'elevation', 0, 90).name('Elevation').onChange(updateSunPosition);
    sunFolder.add(sunSettings, 'azimuth', 0, 360).name('Azimuth').onChange(updateSunPosition);
    sunFolder.add(sunSettings, 'intensity', 0, 5).name('Intensity').onChange(updateSunPosition);
    sunFolder.add(sunSettings, 'temperature', 1000, 40000).name('Temperature (K)').onChange(updateSunPosition);



    // Variables para la pipeline
    let renderPipeline = null;
    let scenePass, aoPass, bloomPass, finalPass;
    let scenePassColor, scenePassNormal, scenePassDepth, aoPassOutput, colorWithAO, combinedColor;

    function updateRenderPipeline() {
        // Habilitar/deshabilitar sliders según el estado de WebGPU
        if (webgpuSettings.enabled) {
            bloomThreshold.enable();
            bloomStrength.enable();
            bloomRadius.enable();
            aoRadius.enable();
            aoScale.enable();
            aoThickness.enable();
            smaaEnabled.enable();
        } else {
            bloomThreshold.disable();
            bloomStrength.disable();
            bloomRadius.disable();
            aoRadius.disable();
            aoScale.disable();
            aoThickness.disable();
            smaaEnabled.disable();
        }

        // Recrear pipeline si está habilitado
        if (webgpuSettings.enabled) {
            if (renderPipeline) {
                renderPipeline.dispose();
            }

            renderPipeline = new THREE.RenderPipeline(renderer);

            scenePass = pass(scene, camera);
            scenePass.setMRT(mrt({
                output: output,
                normal: normalView
            }));

            scenePassColor = scenePass.getTextureNode('output');
            scenePassNormal = scenePass.getTextureNode('normal');
            scenePassDepth = scenePass.getTextureNode('depth');

            // GTAO
            aoPass = ao(scenePassDepth, scenePassNormal, camera);
            aoPass.radius.value = webgpuSettings.aoRadius;
            aoPass.scale.value = webgpuSettings.aoScale;
            aoPass.thickness.value = webgpuSettings.aoThickness;
            aoPassOutput = aoPass.getTextureNode();

            // Color con AO
            colorWithAO = scenePassColor.mul(vec4(vec3(aoPassOutput.r), 1.0));

            // Bloom
            bloomPass = bloom(colorWithAO, webgpuSettings.bloomThreshold, webgpuSettings.bloomStrength, webgpuSettings.bloomRadius);

            // Color final
            combinedColor = colorWithAO.add(bloomPass);

            // SMAA
            if (webgpuSettings.smaaEnabled) {
                finalPass = smaa(combinedColor);
            } else {
                finalPass = combinedColor;
            }

            renderPipeline.outputNode = finalPass;
        } else {
            if (renderPipeline) {
                renderPipeline.dispose();
                renderPipeline = null;
            }
        }
    }

    // Inicializar pipeline deshabilitada
    updateRenderPipeline();

    // Inicializar posición del sol
    updateSunPosition();


    // Loop de Animación
    const clock = new THREE.Clock();

    function animate() {
        const delta = clock.getDelta();


        // Actualizar matrices de la escena
        scene.updateMatrixWorld();

        // Actualizar jugador
        if (player) player.update(delta);

        stats.update();

        // Render según estado de WebGPU
        if (webgpuSettings.enabled && renderPipeline) {
            renderPipeline.render();
        } else {
            renderer.render(scene, camera);
        }

        requestAnimationFrame(animate);
    }

    // Interaction Callbacks
    setupInteraction(camera, scene, {
        onClick: (obj) => {
            console.log("Interactuado con:", obj.name || "Sin nombre");
        }
    });

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
})();
