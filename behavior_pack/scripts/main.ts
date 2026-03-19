import { 
    world, 
    system, 
    EntityDamageCause, 
    Player, 
    ItemStack, 
    Vector3, 
    Dimension, 
    Entity, 
    EntityRaycastOptions, 
    BlockRaycastOptions,
    ItemUseBeforeEvent,
    PlayerLeaveAfterEvent,
    EntityHitEntityAfterEvent,
    EntityRaycastHit
} from "@minecraft/server";

/**
 * CONFIGURATION Constants with explicit typing
 */
const PISTOL_ID: string = "custom:pistol";
const BULLET_ENTITY: string = "custom:bullet";
const DAMAGE_AMOUNT: number = 6; 
const MAX_RANGE: number = 60;
const COOLDOWN_TICKS: number = 4;

/**
 * Map to track player cooldowns. 
 * Key: Player ID (string), Value: Last fired tick (number)
 */
const playerCooldowns: Map<string, number> = new Map();

/**
 * Logic for handling the item use (firing the pistol)
 */
world.beforeEvents.itemUse.subscribe((event: ItemUseBeforeEvent): void => {
    const itemStack: ItemStack | undefined = event.itemStack;
    const player: Player = event.source;

    // 1. Validation Guard
    if (!itemStack || itemStack.typeId !== PISTOL_ID) return;

    // 2. Cooldown Validation using system ticks
    const currentTick: number = system.currentTick;
    const lastFiredTick: number = playerCooldowns.get(player.id) ?? 0;

    if (currentTick - lastFiredTick < COOLDOWN_TICKS) {
        return;
    }

    // Update cooldown record
    playerCooldowns.set(player.id, currentTick);

    // 3. Deferred Execution to exit Read-Only state
    system.run((): void => {
        if (!player.isValid()) return;

        const dimension: Dimension = player.dimension;
        const headLoc: Vector3 = player.getHeadLocation();
        const viewVec: Vector3 = player.getViewDirection();

        // Calculate a safe spawn position slightly ahead of the player
        const spawnPos: Vector3 = {
            x: headLoc.x + viewVec.x * 1.2,
            y: headLoc.y + viewVec.y * 1.2 - 0.1,
            z: headLoc.z + viewVec.z * 1.2
        };

        /**
         * RAYCAST: HIT DETECTION (INSTANT HIT)
         */
        const rayOptions: EntityRaycastOptions = {
            maxDistance: MAX_RANGE,
            includePassableBlocks: false,
            includeLiquidBlocks: false
        };

        const blockOptions: BlockRaycastOptions = {
            maxDistance: MAX_RANGE,
            includePassableBlocks: false,
            includeLiquidBlocks: false
        };

        // Get hits and filter out the shooter to prevent self-hitting
        const entityHits: EntityRaycastHit[] = player.getEntitiesFromViewDirection(rayOptions);
        const validHit: EntityRaycastHit | undefined = entityHits.find(hit => hit.entity.id !== player.id);

        // Check for block collision
        const blockHit = player.getBlockFromViewDirection(blockOptions);

        // Determine if we hit an entity before a block
        if (validHit && (!blockHit || validHit.distance < blockHit.distance)) {
            const target: Entity = validHit.entity;
            if (target.isValid()) {
                target.applyDamage(DAMAGE_AMOUNT, {
                    cause: EntityDamageCause.projectile,
                    damagingEntity: player
                });
                dimension.spawnParticle("minecraft:crit_particle", target.getHeadLocation());
            }
        } 
        else if (blockHit) {
            const hitLocation: Vector3 = blockHit.faceLocation;
            dimension.spawnParticle("minecraft:large_exploding_particle", hitLocation);
        }

        /**
         * VISUALS: TRACER SPAWNING
         */
        try {
            const tracer: Entity = dimension.spawnEntity(BULLET_ENTITY, spawnPos);
            
            tracer.applyImpulse({
                x: viewVec.x * 4,
                y: viewVec.y * 4,
                z: viewVec.z * 4
            });

            // Cleanup tracer after 10 ticks to prevent entity lag
            system.runTimeout((): void => {
                if (tracer.isValid()) {
                    tracer.remove();
                }
            }, 10);

        } catch (error) {
            console.warn(`[Pistol Error] Failed to spawn tracer: ${error}`);
        }

        // Play localized sound effect
        const soundCmd: string = `playsound random.explode @a[p="${player.name}",c=1,r=16] ${spawnPos.x} ${spawnPos.y} ${spawnPos.z} 0.4 3.5`;
        dimension.runCommand(soundCmd);
    });
});

/**
 * Entity Hit Logic (Optional: for physics-based projectiles)
 */
world.afterEvents.entityHitEntity.subscribe((event: EntityHitEntityAfterEvent): void => {
    const projectile: Entity | undefined = event.damagingEntity;
    const hitEntity: Entity = event.hitEntity;

    if (projectile?.typeId === BULLET_ENTITY && hitEntity.isValid()) {
        hitEntity.applyDamage(DAMAGE_AMOUNT, {
            cause: EntityDamageCause.projectile
        });
    }
});

/**
 * MEMORY CLEANUP: Remove player from Map when they leave
 */
world.afterEvents.playerLeave.subscribe((event: PlayerLeaveAfterEvent): void => {
    playerCooldowns.delete(event.playerId);
});
