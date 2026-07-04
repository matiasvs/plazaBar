import * as THREE from 'three';

export class PlayerController {
    constructor(camera, scene, playerMesh, domElement, colliders = []) {
        this.camera = camera;
        this.scene = scene;
        this.player = playerMesh;
        this.domElement = domElement;
        this.colliders = colliders;

        this.speed = 5.0;
        this.runSpeed = 10.0;
        this.lookSpeed = 0.002;
        this.playerHeight = 1.8;

        this.raycaster = new THREE.Raycaster();
        this.downVector = new THREE.Vector3(0, -1, 0);
        this.verticalVelocity = 0;
        this.gravity = 30.0;
        this.jumpForce = 12.0;
        this.isGrounded = false;
        this.isLocked = false;
        this.pitch = 0;
        this.move = { forward: false, backward: false, left: false, right: false, running: false, jump: false };
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        this.domElement.addEventListener('click', () => {
            if (!this.isLocked) {
                try {
                    this.domElement.requestPointerLock?.();
                } catch (err) {
                    // ignore
                }
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.domElement;
        });

        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.move.forward = true; break;
            case 'ArrowLeft':
            case 'KeyA': this.move.left = true; break;
            case 'ArrowDown':
            case 'KeyS': this.move.backward = true; break;
            case 'ArrowRight':
            case 'KeyD': this.move.right = true; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.move.running = true; break;
            case 'Space': this.move.jump = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': this.move.forward = false; break;
            case 'ArrowLeft':
            case 'KeyA': this.move.left = false; break;
            case 'ArrowDown':
            case 'KeyS': this.move.backward = false; break;
            case 'ArrowRight':
            case 'KeyD': this.move.right = false; break;
            case 'ShiftLeft':
            case 'ShiftRight': this.move.running = false; break;
            case 'Space': this.move.jump = false; break;
        }
    }

    onMouseMove(event) {
        if (!this.isLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        this.player.rotation.y -= movementX * this.lookSpeed;
        this.pitch -= movementY * this.lookSpeed;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
    }

    update(delta) {
        const dt = Math.min(delta, 0.05);

        this.direction.z = Number(this.move.forward) - Number(this.move.backward);
        this.direction.x = Number(this.move.left) - Number(this.move.right);
        this.direction.normalize();

        const speed = this.move.running ? this.runSpeed : this.speed;
        const actualSpeed = speed * dt;

        if (this.isLocked) {
            if (this.direction.z !== 0) this.player.translateZ(-this.direction.z * actualSpeed);
            if (this.direction.x !== 0) this.player.translateX(-this.direction.x * actualSpeed);
        }

        if (this.move.jump && this.isGrounded) {
            this.verticalVelocity = this.jumpForce;
            this.isGrounded = false;
        }

        if (!this.isGrounded) {
            this.verticalVelocity -= this.gravity * dt;
            if (this.verticalVelocity < -50) this.verticalVelocity = -50;
        } else {
            this.verticalVelocity = -0.1;
        }

        this.player.position.y += this.verticalVelocity * dt;

        const rayHeight = 3.0;
        const rayOrigin = this.player.position.clone();
        rayOrigin.y += rayHeight;
        this.raycaster.set(rayOrigin, this.downVector);

        const intersects = this.raycaster.intersectObjects(this.colliders, true);
        if (intersects.length > 0) {
            const groundY = intersects[0].point.y + 0.05;
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

        if (this.player.position.y < -100) {
            console.warn('¡Rescate activado! Cayendo al vacío.');
            this.player.position.set(0, 20, 0);
            this.verticalVelocity = 0;
            this.isGrounded = false;
        }

        const camPos = this.player.position.clone();
        camPos.y += this.playerHeight;
        this.camera.position.copy(camPos);
        this.camera.quaternion.copy(this.player.quaternion);
        this.camera.rotateX(this.pitch);
    }
}
