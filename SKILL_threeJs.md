# Skill: Three.js - PisoBase para Caminar con Colisiones

## Descripción General

Esta skill documenta cómo implementar un sistema de caminar en primera persona con colisiones de terreno usando Three.js WebGPU. El componente clave es el **pisoBase** (modelo invisible que proporciona superficie de colisión para que el jugador pueda caminar).

## Concepto de PisoBase

El `pisoBase` es un modelo 3D (FBX o GLB) que funciona como:
- **Superficie de colisión invisible**: El jugador puede caminar sobre él pero no se ve
- **Base para raycasting**: Proporciona geometría para detectar la altura del terreno
- **Soporte de física**: Permite gravedad, saltos y movimiento fluido

## Implementación

### 1. Cargar el PisoBase

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Array para objetos colisionables
const colliders = [];

// Cargar pisoBase (modelo invisible)
const loader = new GLTFLoader();
try {
    const pisoBaseGltf = await loader.loadAsync('models/pisoBase.glb');
    const modelPiso = pisoBaseGltf.scene;
    
    // Configurar como invisible
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
            child.material.opacity = 0;           // Totalmente transparente
            child.material.colorWrite = false;    // No escribe color al buffer
            child.material.depthWrite = false;   // No escribe profundidad
        }
    });
    
    scene.add(modelPiso);
    colliders.push(modelPiso);  // Añadir al array de colisionables
    console.log("PisoBase cargado.");
} catch (err) {
    console.error("Error cargando pisoBase:", err);
}
```

**Parámetros clave para invisibilidad:**
- `opacity = 0`: Hace el material completamente transparente
- `colorWrite = false`: Evita que el material escriba color al framebuffer
- `depthWrite = false`: Evita que el material afecte el buffer de profundidad

### 2. Sistema de Colisiones del Jugador

El controlador del jugador usa raycasting para detectar el suelo:

```javascript
export class PlayerController {
    constructor(camera, scene, playerMesh, domElement, colliders = []) {
        this.camera = camera;
        this.scene = scene;
        this.player = playerMesh;
        this.domElement = domElement;
        this.colliders = colliders;  // Array de objetos colisionables (incluyendo pisoBase)
        
        // Configuración de física
        this.raycaster = new THREE.Raycaster();
        this.downVector = new THREE.Vector3(0, -1, 0);
        this.verticalVelocity = 0;
        this.gravity = 30.0;
        this.jumpForce = 12.0;
        this.isGrounded = false;
    }
    
    update(delta) {
        const dt = Math.min(delta, 0.05);
        
        // Aplicar gravedad
        if (!this.isGrounded) {
            this.verticalVelocity -= this.gravity * dt;
            if (this.verticalVelocity < -50) this.verticalVelocity = -50; // Velocidad terminal
        } else {
            this.verticalVelocity = -0.1; // Pegamento al suelo
        }
        
        this.player.position.y += this.verticalVelocity * dt;
        
        // Raycasting hacia abajo para detectar suelo
        const rayHeight = 3.0;
        const rayOrigin = this.player.position.clone();
        rayOrigin.y += rayHeight;
        this.raycaster.set(rayOrigin, this.downVector);
        
        const intersects = this.raycaster.intersectObjects(this.colliders, true);
        if (intersects.length > 0) {
            const groundY = intersects[0].point.y + 0.05; // Offset pequeño
            
            // Colisión detectada
            if (this.player.position.y <= groundY + 0.2) {
                this.player.position.y = groundY;
                this.verticalVelocity = 0;
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }
        } else {
            this.isGrounded = false;
        }
        
        // Rescate de emergencia si cae al vacío
        if (this.player.position.y < -100) {
            console.warn("¡Rescate activado! Cayendo al vacío.");
            this.player.position.set(0, 20, 0);
            this.verticalVelocity = 0;
            this.isGrounded = false;
        }
    }
}
```

### 3. Inicialización del Controlador

```javascript
// Crear anchor del jugador
const playerAnchor = new THREE.Group();
playerAnchor.name = "PlayerAnchor";
playerAnchor.position.set(0, 5, 0); // Posición inicial
scene.add(playerAnchor);

// Inicializar controlador con el array de colisionables
const player = new PlayerController(camera, scene, playerAnchor, renderer.domElement, colliders);
```

## Ventajas del Sistema PisoBase

1. **Separación de visualización y física**: El piso visual puede ser diferente al físico
2. **Optimización**: Un solo modelo invisible puede servir de base para múltiples pisos visuales
3. **Flexibilidad**: Puedes tener terrenos complejos sin afectar el rendimiento
4. **Simplicidad**: Raycasting es más eficiente que física compleja para caminar

## Consideraciones

- El modelo `pisoBase` debe tener geometría suficiente para cubrir toda el área de juego
- El raycast se origina desde arriba del jugador (rayHeight) para detectar el suelo
- El offset de 0.05 evita que el jugador se "hunda" en el suelo
- El sistema de rescate evita que el jugador caiga infinitamente

## Archivos del Sistema

- `src/player.js`: Controlador del jugador con raycasting
- `src/main.js`: Carga del pisoBase e inicialización
- `models/pisoBase.fbx` o `models/pisoBase.glb`: Modelo invisible de colisión

## Controles del Jugador

- **WASD / Flechas**: Movimiento
- **R**: Correr
- **Espacio**: Saltar
- **Click**: Activar pointer lock (capturar mouse)
- **Mouse**: Mirar alrededor

## Dependencias

```json
{
  "dependencies": {
    "three": "^0.185.0",
    "gsap": "^3.14.2",
    "stats.js": "^0.17.0"
  }
}
```

## Notas de Implementación

- El sistema usa Three.js WebGPU para renderizado moderno
- El raycasting se realiza en cada frame para detectar cambios de altura
- La gravedad se aplica solo cuando el jugador no está en el suelo
- El sistema es compatible con múltiples pisosBase (escaleras, rampas, etc.)

---

## Despliegue en GitHub Pages

### Cómo funciona el pipeline completo

El proyecto usa **Vite** como bundler + **GitHub Actions** para CI/CD automático. Cada `push` a `main` dispara un workflow que:
1. Hace checkout del código
2. Instala dependencias con Node 24
3. Ejecuta `npm run build` → genera la carpeta `dist/`
4. Sube `dist/` como artefacto de Pages
5. GitHub publica el artefacto en `https://<usuario>.github.io/<repo>/`

---

### 1. Configuración de Vite (`vite.config.js`)

La clave es el campo `base`. GitHub Pages sirve el sitio bajo una sub-ruta del tipo `/<nombre-del-repo>/`, por lo que Vite tiene que saber eso al generar los bundles:

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/museum/',           // ← CRÍTICO: debe coincidir con el nombre del repositorio
    optimizeDeps: {
        esbuildOptions: { target: 'esnext' }   // Necesario para Three.js WebGPU (ESNext syntax)
    },
    build: {
        outDir: 'dist',         // Carpeta de salida que sube el workflow
        target: 'esnext'        // Three.js WebGPU requiere esnext
    },
});
```

> **⚠️ Si el `base` no coincide con el nombre del repo**, todos los assets (JS, CSS, modelos) devolverán 404 en producción, aunque localmente funcione bien.

**Regla:** `base: '/<nombre-exacto-del-repo>/'`  
Ejemplo: repo llamado `museum` → `base: '/museum/'`

---

### 2. Workflow de GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
name: Deploy static content to Pages

on:
  push:
    branches: ["main"]        # Se dispara en cada push a main
  workflow_dispatch:          # Permite dispararlo manualmente desde la UI de GitHub

permissions:
  contents: read              # Leer el código del repo
  pages: write                # Escribir en GitHub Pages
  id-token: write             # Necesario para autenticación OIDC con Pages

concurrency:
  group: "pages"
  cancel-in-progress: false   # No cancela deploys en curso (evita deploys parciales)

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}   # URL final mostrada en el resumen del workflow
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5                     # Descarga el código

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 24                            # Node 24 (evita warnings de deprecación)

      - name: Install dependencies
        run: npm install                              # Instala three, vite, gsap, etc.

      - name: Build
        run: npm run build                            # Ejecuta: vite build → genera dist/

      - name: Setup Pages
        uses: actions/configure-pages@v5             # Configura el entorno de Pages en el runner

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'                             # Sube SOLO la carpeta dist/

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4                # Publica el artefacto
```

**Ubicación del archivo:** `.github/workflows/deploy.yml` (en la raíz del repo, dentro de la carpeta oculta `.github`).

---

### 3. Configuración del Repositorio en GitHub (UI)

Estos pasos se hacen una sola vez en la interfaz web de GitHub:

#### Paso 1 — Habilitar GitHub Pages

1. Ir a tu repositorio en `github.com`
2. Clic en **Settings** (pestaña superior)
3. En el menú lateral izquierdo → **Pages**
4. En **"Build and deployment"** → **Source** → seleccionar **"GitHub Actions"**

> Esto le dice a GitHub que NO intente publicar el branch directamente, sino que espere el artefacto que sube el workflow.

```
Settings → Pages → Source → GitHub Actions
```

#### Paso 2 — Verificar permisos del workflow

1. En **Settings** → **Actions** → **General**
2. Bajar hasta **"Workflow permissions"**
3. Seleccionar **"Read and write permissions"**
4. Guardar

#### Paso 3 — Verificar el Environment (primer deploy)

Después del primer deploy exitoso:
1. Ir a **Settings** → **Environments**
2. Verificar que existe el environment `github-pages`
3. Si hay reglas de protección que bloquean el deploy, eliminarlas o agregar la rama `main` como rama permitida

---

### 4. Estructura de archivos para que funcione

```
my-project/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← Workflow de CI/CD
├── src/
│   ├── main.js                 ← Entry point (importa three/webgpu)
│   ├── style.css
│   ├── player.js
│   ├── scene.js
│   └── interaction.js
├── public/
│   └── models/                 ← Modelos GLB/FBX (se copian tal cual a dist/)
│       ├── pisoBase.glb
│       └── hall14.glb
├── index.html                  ← Entry HTML (apunta a /src/main.js)
├── vite.config.js              ← ¡base OBLIGATORIO!
├── package.json
└── .gitignore
```

> **⚠️ La carpeta `public/`** es especial en Vite: todo lo que esté ahí se copia directamente a `dist/` sin transformaciones. Los modelos 3D, texturas e imágenes van aquí para que Vite no intente procesarlos.

---

### 5. Cómo afecta el `.gitignore`

El `.gitignore` actual excluye:
- `node_modules/` ✅ Correcto — el workflow los reinstala
- `dist/` ✅ Correcto — el workflow los genera al buildear
- `*.md` ⚠️ Esto excluye archivos Markdown del commit — no afecta el deploy pero significa que `SKILL_threeJs.md` **no se sube al repo remoto** por defecto

---

### 6. Crear un proyecto nuevo desde cero con este stack

Pasos para arrancar un proyecto Three.js + Vite + GitHub Pages **de cero**:

```bash
# 1. Crear repo en GitHub (desde la web) con el nombre elegido, p.ej: "mi-mundo-3d"

# 2. Clonar localmente
git clone https://github.com/<usuario>/mi-mundo-3d.git
cd mi-mundo-3d

# 3. Inicializar Vite con vanilla JS
npm create vite@latest . -- --template vanilla

# 4. Instalar Three.js y dependencias
npm install three gsap stats.js lil-gui

# 5. Ajustar vite.config.js
# base: '/mi-mundo-3d/'   ← nombre exacto del repo

# 6. Crear .github/workflows/deploy.yml
# (copiar el workflow de esta skill)

# 7. Primer commit y push
git add .
git commit -m "feat: initial three.js webgpu setup"
git push origin main

# 8. Configurar GitHub Pages en Settings → Pages → Source: GitHub Actions

# 9. Esperar que termine el workflow (~2-3 min)
# URL disponible en: https://<usuario>.github.io/mi-mundo-3d/
```

---

### 7. Checklist de verificación antes del primer deploy

- [ ] `vite.config.js` tiene `base: '/<nombre-repo>/'` con barras en ambos lados
- [ ] `vite.config.js` tiene `target: 'esnext'` (requerido por Three.js WebGPU)
- [ ] `.github/workflows/deploy.yml` existe y está commiteado
- [ ] Los modelos están en `public/models/` (no en `src/`)
- [ ] En GitHub → Settings → Pages → Source: **GitHub Actions**
- [ ] En GitHub → Settings → Actions → General → **Read and write permissions**
- [ ] El branch de deploy es `main` (o actualizar el `branches:` en el workflow)
- [ ] Las rutas a modelos en el código NO llevan `/public/` — solo `'models/pisoBase.glb'`

---

### 8. URL final y estructura de rutas

```
Repositorio: github.com/usuario/museum
URL Pages:   https://usuario.github.io/museum/

# Así accede Vite a los assets en producción:
https://usuario.github.io/museum/assets/main-abc123.js   ← JS buildeado
https://usuario.github.io/museum/models/pisoBase.glb     ← Modelo (desde public/)
```

En el código, los modelos se referencian **sin** el prefijo `base`:
```javascript
// ✅ Correcto — Vite agrega /museum/ automáticamente
loader.loadAsync('models/pisoBase.glb')

// ❌ Incorrecto
loader.loadAsync('/museum/models/pisoBase.glb')
```

---

---

## 🤖 Bootstrap para Agente AI

> **Esta sección está escrita como instrucciones directas para un agente AI.**
> Si eres un AI leyendo este skill para arrancar un proyecto nuevo, sigue estos pasos en orden.
> No asumas nada — pregunta primero, luego ejecuta.

---

### PASO 0 — Preguntas obligatorias antes de empezar

Antes de crear cualquier archivo, el agente **debe preguntar**:

1. **¿Cuál es el nombre exacto del repositorio de GitHub?**
   - Este nombre se usará como `base` en Vite. Ej: `mi-mundo-3d`
2. **¿En qué directorio local quieres crear el proyecto?**
   - Ej: `/home/usuario/projects/mi-mundo-3d`
3. **¿Ya existe el repo en GitHub o hay que crearlo?**
   - Si ya existe: clonar primero, luego inicializar dentro
   - Si no existe: inicializar local y el usuario lo crea en GitHub después
4. **¿Tenés modelos GLB/FBX para agregar ahora o se agregan después?**
   - Si tiene: copiarlos a `public/models/`
   - Si no: la carpeta queda vacía, el código los carga con try/catch

---

### PASO 1 — Crear la estructura de carpetas

```bash
# Reemplazar <PROJECT_DIR> con la ruta que indicó el usuario
mkdir -p <PROJECT_DIR>/.github/workflows
mkdir -p <PROJECT_DIR>/src
mkdir -p <PROJECT_DIR>/public/models

cd <PROJECT_DIR>
```

Estructura final esperada:
```
<PROJECT_DIR>/
├── .github/workflows/
├── src/
├── public/models/
└── (archivos en raíz)
```

---

### PASO 2 — Inicializar npm y instalar dependencias

```bash
# Inicializar package.json
npm init -y

# Instalar devDependencies
npm install -D vite

# Instalar dependencias de producción
npm install three gsap stats.js lil-gui
```

---

### PASO 3 — Crear `package.json` definitivo

Reemplazar el `package.json` generado por este (ajustar `"name"` al nombre del proyecto):

```json
{
  "name": "<REPO_NAME>",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^7.2.4"
  },
  "dependencies": {
    "gsap": "^3.14.2",
    "lil-gui": "^0.21.0",
    "stats.js": "^0.17.0",
    "three": "^0.185.0"
  }
}
```

---

### PASO 4 — Crear `vite.config.js`

⚠️ **`<REPO_NAME>` debe ser exactamente el nombre del repositorio de GitHub.**

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/<REPO_NAME>/',
    optimizeDeps: {
        esbuildOptions: { target: 'esnext' }
    },
    build: {
        outDir: 'dist',
        target: 'esnext'
    },
});
```

---

### PASO 5 — Crear `index.html`

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><REPO_NAME></title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

---

### PASO 6 — Crear `src/style.css`

```css
/* src/style.css */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    overflow: hidden;
    background: #000;
}

canvas {
    display: block;
    width: 100vw;
    height: 100vh;
}
```

---

### PASO 7 — Crear `src/main.js` (esqueleto funcional)

Este archivo es el punto de entrada. Contiene el loop mínimo funcional con WebGPU:

```javascript
// src/main.js
import './style.css';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PlayerController } from './player.js';
import Stats from 'stats.js';

(async () => {
    // ── Stats FPS ───────────────────────────────────────────────
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.right = '0px';
    stats.dom.style.left = 'auto';
    document.body.appendChild(stats.dom);

    // ── Renderer (WebGPU) ────────────────────────────────────────
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

    // ── Escena y Cámara ──────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    camera.position.set(0, 2, 5);

    // ── Luz básica ───────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // ── Loader + Colisionables ───────────────────────────────────
    const loader = new GLTFLoader();
    const colliders = [];

    // Cargar pisoBase (modelo invisible de colisión)
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

    // ── Jugador ──────────────────────────────────────────────────
    const playerAnchor = new THREE.Group();
    playerAnchor.name = 'PlayerAnchor';
    playerAnchor.position.set(0, 5, 0);
    scene.add(playerAnchor);

    const player = new PlayerController(camera, scene, playerAnchor, renderer.domElement, colliders);

    // ── Resize ───────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ── Loop ─────────────────────────────────────────────────────
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
```

---

### PASO 8 — Crear `src/player.js`

Copiar el `PlayerController` completo documentado en la sección **"Sistema de Colisiones del Jugador"** de este skill.

---

### PASO 9 — Crear `.github/workflows/deploy.yml`

```yaml
name: Deploy static content to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

### PASO 10 — Crear `.gitignore`

```gitignore
node_modules
dist
dist-ssr
*.local
.DS_Store
*.log
```

---

### PASO 11 — Verificación local antes del primer commit

```bash
# Instalar si no se hizo antes
npm install

# Correr dev server
npm run dev
# → Debe abrir sin errores en http://localhost:5173/

# Verificar build
npm run build
# → Debe generar carpeta dist/ sin errores
# → Si falla aquí, NO hacer commit — el workflow de GitHub también fallará
```

---

### PASO 12 — Primer commit y push

```bash
git init                          # Solo si el repo no fue clonado
git add .
git commit -m "feat: bootstrap three.js webgpu project"
git branch -M main
git remote add origin https://github.com/<USUARIO>/<REPO_NAME>.git
git push -u origin main
```

---

### PASO 13 — Activar GitHub Pages (el agente debe recordarle al usuario)

El agente debe avisar al usuario:

> **Acción manual requerida en GitHub.com:**
> 1. Ir a `github.com/<usuario>/<repo>` → **Settings** → **Pages**
> 2. En **Source** seleccionar → **GitHub Actions**
> 3. Guardar
> 4. El primer workflow se dispara automáticamente con el push
> 5. En ~2-3 minutos la app estará en: `https://<usuario>.github.io/<REPO_NAME>/`

---

### ✅ Checklist de verificación final (el agente debe confirmar cada punto)

```
ARCHIVOS CREADOS:
[ ] index.html
[ ] vite.config.js  → base: '/<REPO_NAME>/' con barras
[ ] package.json    → type: "module", scripts: dev/build/preview
[ ] src/main.js     → importa three/webgpu, tiene await renderer.init()
[ ] src/style.css   → overflow: hidden en body
[ ] src/player.js   → clase PlayerController con raycasting
[ ] .github/workflows/deploy.yml
[ ] .gitignore      → node_modules y dist excluidos

CONFIGURACIÓN:
[ ] vite.config.js: target: 'esnext' en optimizeDeps y build
[ ] vite.config.js: base coincide EXACTAMENTE con el nombre del repo en GitHub
[ ] package.json: "type": "module"
[ ] player.js: exporta `export class PlayerController`

BUILD LOCAL:
[ ] npm run dev → corre sin errores
[ ] npm run build → genera dist/ sin errores

GITHUB:
[ ] Código pusheado a branch main
[ ] Settings → Pages → Source: GitHub Actions (activado por el usuario)
```

---

### Variables de plantilla (reemplazar en todos los archivos)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `<REPO_NAME>` | Nombre exacto del repo en GitHub | `mi-mundo-3d` |
| `<PROJECT_DIR>` | Ruta local del proyecto | `/home/usuario/projects/mi-mundo-3d` |
| `<USUARIO>` | Username de GitHub | `blend3d` |
