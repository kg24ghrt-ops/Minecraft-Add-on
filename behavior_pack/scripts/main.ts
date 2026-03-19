import { world, system } from "@minecraft/server";

// Configuration
const PROJECTILE_ID = "custom:bullet";
const PISTOL_ID = "custom:pistol";
const BULLET_SPEED = 4.0; // Fast projectile speed
const DAMAGE_AMOUNT = 6;  // 3 hearts of damage

world.beforeEvents.itemUse.subscribe((event) => {
    const { itemStack, source: player } = event;

    // Check if the item used is our custom pistol
    if (itemStack.typeId === PISTOL_ID) {
        
        // Use system.run to execute commands/spawning outside the 'before' event read-only state
        system.run(() => {
            const headLocation = player.getHeadLocation();
            const viewDirection = player.getViewDirection();

            // Spawn the bullet slightly in front of the player's face
            const spawnLoc = {
                x: headLocation.x + viewDirection.x * 1.5,
                y: headLocation.y + viewDirection.y * 1.5,
                z: headLocation.z + viewDirection.z * 1.5
            };

            const bullet = player.dimension.spawnEntity(PROJECTILE_ID, spawnLoc);
            
            // Set the velocity based on player's look direction
            bullet.applyImpulse({
                x: viewDirection.x * BULLET_SPEED,
                y: viewDirection.y * BULLET_SPEED,
                z: viewDirection.z * BULLET_SPEED
            });

            // Play a sound effect
            player.dimension.runCommand(`playsound random.explode @a ${spawnLoc.x} ${spawnLoc.y} ${spawnLoc.z} 0.5 2.0`);
        });
    }
});

// Simple Hit Detection
// Note: For high-speed bullets, a raycast-based hit detection is usually better,
// but for a standard script setup, we listen for entity hits.
world.afterEvents.entityHitEntity.subscribe((event) => {
    const { projectile, hitEntity } = event;

    // If our custom bullet hits something
    if (projectile?.typeId === PROJECTILE_ID) {
        hitEntity.applyDamage(DAMAGE_AMOUNT, {
            cause: "projectile",
            damagingEntity: projectile
        });
    }
});
