import { _decorator, CCInteger, Component, director, instantiate, macro, Node, Prefab, Vec3, Vec4 } from 'cc';
import { CollectibleItem } from './CollectibleItem';
import { Borders } from '../plugins/Borders';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

class SeededRandom {
  public constructor(private _state: number) {}
  public next(): number { this._state = (this._state * 1664525 + 1013904223) >>> 0; return this._state / 0x100000000; }
  public range(min: number, max: number): number { return min + (max - min) * this.next(); }
}

type LayerPoint = { x: number; z: number };
const itemWorldPosition = new Vec3();
const holeWorldPosition = new Vec3();

function movingPairDistanceSquared(previousItem: Readonly<Vec3>, currentItem: Readonly<Vec3>, previousHole: Readonly<Vec3>, currentHole: Readonly<Vec3>): number {
  const startX = previousItem.x - previousHole.x;
  const startZ = previousItem.z - previousHole.z;
  const deltaX = (currentItem.x - currentHole.x) - startX;
  const deltaZ = (currentItem.z - currentHole.z) - startZ;
  const lengthSq = deltaX * deltaX + deltaZ * deltaZ;
  const t = lengthSq > 0.000001 ? Math.max(0, Math.min(1, -(startX * deltaX + startZ * deltaZ) / lengthSq)) : 0;
  const closestX = startX + deltaX * t;
  const closestZ = startZ + deltaZ * t;
  return closestX * closestX + closestZ * closestZ;
}

/** One Inspector-authoritative source for all sections. Bounds are (minX, maxX, minZ, maxZ). */
@ccclass('MacaroonSpawner')
export class MacaroonSpawner extends Component {
  @property({ type: [Node], tooltip: 'Parent node for spawned items in each section.' }) public sectionRoots: Node[] = [];
  @property({ type: [Prefab], tooltip: 'Macaroon prefab for each section.' }) public macaroonPrefabs: Prefab[] = [];
  @property({ type: [CCInteger], tooltip: 'Exact macaroon count for each section.' }) public itemCounts: number[] = [];
  @property({ type: [CCInteger], tooltip: 'Deterministic layout seed for each section.' }) public seeds: number[] = [];
  @property({ type: [Vec4], tooltip: 'Bounds: x=minX, y=maxX, z=minZ, w=maxZ.' }) public sectionBounds: Vec4[] = [];
  @property public itemSpacing = 0.82;
  @property({ tooltip: 'Macaroon centre height: physical floor top plus macaroon half-height and 0.1 clearance.' }) public baseY = 0.64;
  @property public scaleJitter = 0.12;
  @property public generateOnLoad = true;
  @property public physicsActivationRadius = 5;
  @property public physicsDeactivationRadius = 6;
  @property public physicsDistanceCheckInterval = 1 / 30;
  @property public captureRadius = 1.05;

  private _borders: Borders | null = null;
  private _items: CollectibleItem[][] = [];
  private _stageActive: boolean[] = [];
  private _reportedMissingHolePosition = false;
  private _holeScale = 1;
  private _previousHoleWorldPosition = new Vec3();
  private _hasPreviousHolePosition = false;
  private _previousItemWorldPositions: Vec3[][] = [];

  public onLoad(): void {
    this.validateConfiguration();
    this._borders = director.getScene()?.getComponentInChildren(Borders) ?? null;
    if (!this._borders) throw new Error('[MacaroonSpawner] Borders component is required in the active scene.');
    this._stageActive = this.itemCounts.map((_value, index) => index === 0);
    this._items = this.itemCounts.map(() => []);
    this._previousItemWorldPositions = this.itemCounts.map(() => []);
    if (this.generateOnLoad) this.generateAll();
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.on(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    collectorEvents.on(CollectorEvent.StageTargetsRequested, this.provideStageTargets, this);
    this.schedule(this.updatePhysicsSimulation, Math.max(1 / 60, this.physicsDistanceCheckInterval), macro.REPEAT_FOREVER);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.off(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    collectorEvents.off(CollectorEvent.StageTargetsRequested, this.provideStageTargets, this);
    this.unschedule(this.updatePhysicsSimulation);
  }

  private provideStageTargets(callback: (targets: number[]) => void): void { callback(this.itemCounts.slice()); }
  public generateAll(): void { this.itemCounts.forEach((_count, stageIndex) => this.generateStage(stageIndex)); }

  private generateStage(stageIndex: number): void {
    if (this._items[stageIndex].length > 0) return;
    const prefab = this.macaroonPrefabs[stageIndex];
    const root = this.sectionRoots[stageIndex];
    const random = new SeededRandom(this.seeds[stageIndex] >>> 0);
    const placed: LayerPoint[] = [];
    for (let index = 0; index < this.itemCounts[stageIndex]; index += 1) {
      const point = this.findLayerPoint(random, placed, root, this.sectionBounds[stageIndex]);
      placed.push(point);
      const item = instantiate(prefab);
      item.parent = root;
      item.setPosition(point.x, this.baseY, point.z);
      item.setRotationFromEuler(random.range(-7, 7), random.range(0, 360), random.range(-7, 7));
      const scale = 1 + random.range(-this.scaleJitter, this.scaleJitter);
      item.setScale(scale, scale, scale);
      const collectible = item.getComponent(CollectibleItem);
      if (!collectible) throw new Error(`[MacaroonSpawner] Prefab in section ${stageIndex} has no CollectibleItem component. Attach it to the prefab root in Inspector.`);
      collectible.stageIndex = stageIndex;
      collectible.setCollectionEnabled(stageIndex === 0);
      collectible.setPhysicsSimulationActive(false);
      this._items[stageIndex].push(collectible);
      this._previousItemWorldPositions[stageIndex].push(item.worldPosition.clone());
    }
  }

  private onStageCompleted(completedStageIndex: number): void {
    const nextStageIndex = completedStageIndex + 1;
    if (nextStageIndex >= this._stageActive.length) return;
    this._stageActive[nextStageIndex] = true;
    this._items[nextStageIndex].forEach((item) => item.setCollectionEnabled(true));
    this.updatePhysicsSimulation();
  }

  private onHoleSizedUp(scale: number): void { this._holeScale = scale; }

  private updatePhysicsSimulation = (): void => {
    let receivedPosition = false;
    collectorEvents.emit(CollectorEvent.HolePositionRequested, (position: Vec3) => { holeWorldPosition.set(position); receivedPosition = true; });
    if (!receivedPosition) {
      if (!this._reportedMissingHolePosition) { this._reportedMissingHolePosition = true; console.error('[MacaroonSpawner] Cannot update physics: no Hole position provider is registered.'); }
      return;
    }
    const activationRadiusSq = this.physicsActivationRadius ** 2;
    const deactivationRadiusSq = Math.max(this.physicsActivationRadius, this.physicsDeactivationRadius) ** 2;
    if (!this._hasPreviousHolePosition) { this._previousHoleWorldPosition.set(holeWorldPosition); this._hasPreviousHolePosition = true; }
    const captureRadiusSq = (this.captureRadius * this._holeScale) ** 2;
    this._items.forEach((items, stageIndex) => items.forEach((collectible, itemIndex) => {
      if (collectible.isCollected) return;
      collectible.node.getWorldPosition(itemWorldPosition);
      const previousPosition = this._previousItemWorldPositions[stageIndex][itemIndex];
      const dx = itemWorldPosition.x - holeWorldPosition.x;
      const dz = itemWorldPosition.z - holeWorldPosition.z;
      const distanceSq = dx * dx + dz * dz;
      const sweptDistanceSq = previousPosition ? movingPairDistanceSquared(previousPosition, itemWorldPosition, this._previousHoleWorldPosition, holeWorldPosition) : distanceSq;
      if (this._stageActive[stageIndex] && Math.min(distanceSq, sweptDistanceSq) <= captureRadiusSq) collectible.beginAbsorb();
      else if (this._stageActive[stageIndex] && distanceSq <= activationRadiusSq) collectible.setPhysicsSimulationActive(true);
      else if (!this._stageActive[stageIndex] || distanceSq >= deactivationRadiusSq) collectible.setPhysicsSimulationActive(false);
      previousPosition?.set(itemWorldPosition);
    }));
    this._previousHoleWorldPosition.set(holeWorldPosition);
  };

  private findLayerPoint(random: SeededRandom, used: LayerPoint[], root: Node, bounds: Vec4): LayerPoint {
    const minDistanceSq = this.itemSpacing ** 2;
    let fallback: LayerPoint | null = null;
    for (let attempt = 0; attempt < 192; attempt += 1) {
      const candidate = { x: random.range(bounds.x, bounds.y), z: random.range(bounds.z, bounds.w) };
      if (!this.isValidSpawnPoint(candidate, root)) continue;
      fallback = candidate;
      if (used.every((other) => (candidate.x - other.x) ** 2 + (candidate.z - other.z) ** 2 >= minDistanceSq)) return candidate;
    }
    if (fallback) return fallback;
    throw new Error('[MacaroonSpawner] No valid macaroon spawn point is inside the configured section bounds.');
  }

  private isValidSpawnPoint(point: LayerPoint, root: Node): boolean {
    root.getWorldPosition(itemWorldPosition);
    itemWorldPosition.x += point.x;
    itemWorldPosition.z += point.z;
    return this._borders!.containsPlayablePosition(itemWorldPosition, 0.56);
  }

  private validateConfiguration(): void {
    const count = this.itemCounts.length;
    if (count === 0) throw new Error('[MacaroonSpawner] At least one section must be configured.');
    if ([this.sectionRoots.length, this.macaroonPrefabs.length, this.seeds.length, this.sectionBounds.length].some((length) => length !== count)) {
      throw new Error('[MacaroonSpawner] Section Roots, Macaroon Prefabs, Item Counts, Seeds and Section Bounds must have equal lengths.');
    }
    this.itemCounts.forEach((itemCount, index) => {
      const bounds = this.sectionBounds[index];
      if (!this.sectionRoots[index] || !this.macaroonPrefabs[index] || itemCount <= 0 || bounds.x >= bounds.y || bounds.z >= bounds.w) throw new Error(`[MacaroonSpawner] Invalid Inspector configuration for section ${index}.`);
    });
  }
}
