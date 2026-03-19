/// <reference types="bc-minecraft-bedrock-types" />
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
 * CONFIGURATION
 */
const PISTOL_ID: string = "custom:pistol";
const BULLET_ENTITY: string = "custom:bullet";
const DAMAGE_AMOUNT: number = 6; 
const MAX_RANGE: number = 60;
const COOLDOWN_TICKS: number = 4;

/**
 * Map to track player cooldowns. 
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

    // 2. Cooldown Validation
    const currentTick: number = system.currentTick;
    const lastFiredTick: number = playerCooldowns.get(player.id) ?? 0;

    if (currentTick - lastFiredTick < COOLDOWN_TICKS) {
        return;
    }

    playerCooldowns.set(player.id, currentTick);

    // 3. Execution (Moves out of Read-Only state)
    system.run((): void => {
        if (!player.isValid()) return;

        const dimension: Dimension = player.dimension;
        const headLoc: Vector3 = player.getHeadLocation();
        const viewVec: Vector3 = player.getViewDirection();

        // Calculate spawn position (slightly in front of player)
        const spawnPos: Vector3 = {
            x: headLoc.x + viewVec.x * 1.2,
            y: headLoc.y + viewVec.y * 1.2 - 0.1,
            z: headLoc.z + viewVec.z * 1.2
        };

        /**
         * RAYCAST: HIT DETECTION
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

        const entityHits: EntityRaycastHit[] = player.getEntitiesFromViewDirection(rayOptions);
        const validHit: EntityRaycastHit | undefined = entityHits.find(hit => hit.entity.id !== player.id);
        const blockHit = player.getBlockFromViewDirection(blockOptions);

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
         * VISUALS: TRACER
         */
        try {
            const tracer: Entity = dimension.spawnEntity(BULLET_ENTITY, spawnPos);
            
            tracer.applyImpulse({
                x: viewVec.x * 4,
                y: viewVec.y * 4,
                z: viewVec.z * 4
            });

            system.runTimeout((): void => {
                if (tracer.isValid()) {
                    tracer.remove();
                }
            }, 10);

        } catch (error) {
            // console.warn will now be recognized due to lib: ["ES2020"] in tsconfig
            console.warn(`[Pistol Error] Tracer failed: ${error}`);
        }

        // Play localized sound
        const soundCmd: string = `playsound random.explode @a[p="${player.name}",c=1,r=16] ${spawnPos.x} ${spawnPos.y} ${spawnPos.z} 0.4 3.5`;
        dimension.runCommand(soundCmd);
    });
});

/**
 * Cleanup: Remove player from Map when they leave
 */
world.afterEvents.playerLeave.subscribe((event: PlayerLeaveAfterEvent): void => {
    playerCooldowns.delete(event.playerId);
});
