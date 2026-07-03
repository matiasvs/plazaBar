import * as THREE from 'three';

export class PlayerController {
    constructor(camera, scene, playerMesh, domElement, colliders = []) {
        this.camera = camera;
        this.scene = scene;
        this.player = playerMesh;
        this.domElement = domElement;
        this.colliders = colliders;

        this.raycaster = new THREE.Raycaster();
        this.downVector = new THREE.Vector3(0, -1, 0);
        this.verticalVelocity = 0;
        this.gravity = 30.0;
        this.jumpForce = 12.0;
        this.isGrounded = false;
    }

    update(delta) {
        const dt = Math.min(delta, 0.05);

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
    }
}
