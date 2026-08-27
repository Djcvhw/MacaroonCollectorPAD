import { _decorator, Component, director, instantiate, macro, Prefab, Vec3 } from 'cc';
import { CollectibleItem } from './CollectibleItem';
import { Borders } from '../plugins/Borders';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

/** A deterministic random source: the same seed always gives the same pile. */
class SeededRandom {
  public constructor(private _state: number) {}
  public next(): number {
    this._state = (this._state * 1664525 + 1013904223) >>> 0;
    return this._state / 0x100000000;
  }
  public range(min: number, max: number): number { return min + (max - min) * this.next(); }
}

type LayerPoint = { x: number; z: number };
const spawnWorldPosition = new Vec3();
const holeWorldPosition = new Vec3();

/** Squared closest distance between the origin and a moving relative position. */
function movingPairDistanceSquared(
  previousItem: Readonly<Vec3>,
  currentItem: Readonly<Vec3>,
  previousHole: Readonly<Vec3>,
  currentHole: Readonly<Vec3>,
): number {
  const startX = previousItem.x - previousHole.x;
  const startZ = previousItem.z - previousHole.z;
  const deltaX = (currentItem.x - currentHole.x) - startX;
  const deltaZ = (currentItem.z - currentHole.z) - startZ;
  const lengthSq = deltaX * deltaX + deltaZ * deltaZ;
  const t = lengthSq > 0.000001
    ? Math.max(0, Math.min(1, -(startX * deltaX + startZ * deltaZ) / lengthSq))
    : 0;
  const closestX = startX + deltaX * t;
  const closestZ = startZ + deltaZ * t;
  return closestX * closestX + closestZ * closestZ;
}

/**
 * Produces the full visible macaroon pile on a stage root at load.
 * Items are randomly scattered on the floor rather than arranged in rows.
 */
@ccclass('SectionMacaroonSpawner')
export class SectionMacaroonSpawner extends Component {
  @property(Prefab)
  public macaroonPrefab: Prefab | null = null;

  @property public itemCount = 1;
  @property public stageIndex = 0;
  @property public seed = 1;
  @property public minX = 0;
  @property public maxX = 10;
  @property public minZ = -5;
  @property public maxZ = 5;
  @property({ tooltip: 'Linear size of the random pile relative to the section area.' })
  public pileSpread = 1;
  @property({ tooltip: 'Places the pile against the next gate/end boundary at max X.' })
  public anchorPileToMaxX = false;
  @property({ tooltip: 'Clearance between the closest macaroon centre and the gate/end boundary.' })
  public gateClearance = 0.8;

  @property public itemSpacing = 1.05;
  @property public baseY = 0.42;
  @property public scaleJitter = 0.12;
  @property public generateOnLoad = true;
  @property({ tooltip: 'Dynamic physics is restored when Hole is this close in XZ.' })
  public physicsActivationRadius = 5;
  @property({ tooltip: 'Sleeping bodies outside this radius become kinematic. Must exceed Physics Activation Radius.' })
  public physicsDeactivationRadius = 6;
  @property({ tooltip: 'Seconds between checks that enable nearby colliders and disable far settled colliders.' })
  public physicsDistanceCheckInterval = 1 / 30;
  @property({ tooltip: 'Lets every pile settle naturally before distance-based kinematic mode starts.' })
  public initialPhysicsSettleDelay = 2;
  @property({ tooltip: 'Entering this radius commits the macaroon to the hole. Growth events scale it.' })
  public captureRadius = 1.05;
  private _generated = false;
  private _borders: Borders | null = null;
  private _items: CollectibleItem[] = [];
  private _isStageActive = false;
  private _reportedMissingHolePosition = false;
  private _holeScale = 1;
  private _previousHoleWorldPosition = new Vec3();
  private _hasPreviousHolePosition = false;
  private _previousItemWorldPositions: Vec3[] = [];
  public onLoad(): void {
    this._borders = director.getScene()?.getComponentInChildren(Borders) ?? null;
    if (this.generateOnLoad) this.generate();
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.on(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    this._isStageActive = this.stageIndex === 0;
    this.updatePhysicsSimulation();
    this.schedule(this.updatePhysicsSimulation, Math.max(1 / 60, this.physicsDistanceCheckInterval), macro.REPEAT_FOREVER);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.off(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    this.unschedule(this.updatePhysicsSimulation);
  }

  public generate(): void {
    if (this._generated || !this.macaroonPrefab || this.itemCount <= 0) return;
    this._generated = true;
    const random = new SeededRandom(this.seed >>> 0);
    const placed: LayerPoint[] = [];
    for (let index = 0; index < this.itemCount; index++) {
      const point = this.findLayerPoint(random, placed);
      placed.push(point);

      const item = instantiate(this.macaroonPrefab);
      item.parent = this.node;
      item.setPosition(point.x, this.baseY, point.z);
      item.setRotationFromEuler(random.range(-7, 7), random.range(0, 360), random.range(-7, 7));
      const scale = 1 + random.range(-this.scaleJitter, this.scaleJitter);
      item.setScale(scale, scale, scale);
		const collectible = item.getComponent(CollectibleItem) ?? item.addComponent(CollectibleItem);
		collectible.stageIndex = this.stageIndex;
		// All piles settle immediately; gates only control whether they can be collected.
      collectible.setCollectionEnabled(this.stageIndex === 0);
      collectible.setPhysicsSimulationActive(false);
      this._items.push(collectible);
      this._previousItemWorldPositions.push(item.worldPosition.clone());
    }
  }

  private onStageCompleted(completedStageIndex: number): void {
    if (completedStageIndex + 1 !== this.stageIndex) return;
    this._isStageActive = true;
    this._items.forEach((item) => item.setCollectionEnabled(true));
    this.updatePhysicsSimulation();
  }

  private onHoleSizedUp(scale: number): void {
    this._holeScale = scale;
  }

  private updatePhysicsSimulation = (): void => {
    let receivedPosition = false;
    collectorEvents.emit(CollectorEvent.HolePositionRequested, (position: Vec3) => {
      holeWorldPosition.set(position);
      receivedPosition = true;
    });
    if (!receivedPosition) {
      if (!this._reportedMissingHolePosition) {
        this._reportedMissingHolePosition = true;
        console.error('[SectionMacaroonSpawner] Cannot update physics simulation: no Hole position provider is registered.');
      }
      return;
    }

    const activationRadiusSq = this.physicsActivationRadius * this.physicsActivationRadius;
    const deactivationRadius = Math.max(this.physicsActivationRadius, this.physicsDeactivationRadius);
    const deactivationRadiusSq = deactivationRadius * deactivationRadius;
    if (!this._hasPreviousHolePosition) {
      this._previousHoleWorldPosition.set(holeWorldPosition);
      this._hasPreviousHolePosition = true;
    }
    const captureRadius = this.captureRadius * this._holeScale;
    const captureRadiusSq = captureRadius * captureRadius;
    this._items.forEach((collectible, index) => {
      if (collectible.isCollected) return;
      collectible.node.getWorldPosition(spawnWorldPosition);
      const previousItemPosition = this._previousItemWorldPositions[index];
      const dx = spawnWorldPosition.x - holeWorldPosition.x;
      const dz = spawnWorldPosition.z - holeWorldPosition.z;
      const distanceSq = dx * dx + dz * dz;
      const sweptDistanceSq = previousItemPosition
        ? movingPairDistanceSquared(previousItemPosition, spawnWorldPosition, this._previousHoleWorldPosition, holeWorldPosition)
        : distanceSq;
      if (this._isStageActive && Math.min(distanceSq, sweptDistanceSq) <= captureRadiusSq) {
        collectible.beginAbsorb();
        previousItemPosition?.set(spawnWorldPosition);
        return;
      }
      if (this._isStageActive && distanceSq <= activationRadiusSq) {
        collectible.setPhysicsSimulationActive(true);
      } else if (!this._isStageActive || distanceSq >= deactivationRadiusSq) {
        collectible.setPhysicsSimulationActive(false);
      }
      previousItemPosition?.set(spawnWorldPosition);
    });
    this._previousHoleWorldPosition.set(holeWorldPosition);
  };

  private findLayerPoint(random: SeededRandom, used: LayerPoint[]): LayerPoint {
	const spread = Math.min(1, Math.max(0.05, this.pileSpread));
	const rightEdge = Math.max(this.minX, this.maxX - this.gateClearance);
	const leftEdge = this.anchorPileToMaxX
		? Math.max(this.minX, rightEdge - (this.maxX - this.minX) * spread)
		: (this.minX + this.maxX) * 0.5 - (this.maxX - this.minX) * spread * 0.5;
	const maxSpawnX = this.anchorPileToMaxX
		? rightEdge
		: (this.minX + this.maxX) * 0.5 + (this.maxX - this.minX) * spread * 0.5;
	const centerX = (leftEdge + maxSpawnX) * 0.5;
	const centerZ = (this.minZ + this.maxZ) * 0.5;
	const halfWidth = (maxSpawnX - leftEdge) * 0.5;
	const halfDepth = (this.maxZ - this.minZ) * spread * 0.5;
    const minDistanceSq = this.itemSpacing * this.itemSpacing;
    let fallback: LayerPoint | null = null;
    const clearance = 0.56;

	for (let attempt = 0; attempt < 192; attempt++) {
		const candidate = { x: random.range(centerX - halfWidth, centerX + halfWidth), z: random.range(centerZ - halfDepth, centerZ + halfDepth) };
		if (!this.isValidSpawnPoint(candidate, clearance)) continue;
		fallback = candidate;
      if (used.every((other) => {
        const dx = candidate.x - other.x;
        const dz = candidate.z - other.z;
        return dx * dx + dz * dz >= minDistanceSq;
      })) return candidate;
    }
	if (fallback) return fallback;
	return { x: centerX, z: centerZ };
  }

	private isValidSpawnPoint(point: LayerPoint, clearance: number): boolean {
		if (!this._borders) return true;
		this.node.getWorldPosition(spawnWorldPosition);
		spawnWorldPosition.x += point.x;
		spawnWorldPosition.z += point.z;
		return this._borders.containsPlayablePosition(spawnWorldPosition, clearance);
	}

}
