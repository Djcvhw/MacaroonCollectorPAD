import { _decorator, Component, director, instantiate, Prefab, Vec3 } from 'cc';
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

/**
 * Produces the full visible macaroon pile on a stage root at load.
 * Items are randomly scattered per layer rather than arranged in rows.
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

  @property({ tooltip: 'Caps the apparent density of one layer so larger piles form visible layers.' })
  public itemsPerLayer = 75;
  @property public itemSpacing = 1.05;
  @property public layerHeight = 0.65;
  @property public baseY = 0.42;
  @property public positionJitterY = 0.08;
  @property public scaleJitter = 0.12;
  @property public generateOnLoad = true;
  private _generated = false;
  private _borders: Borders | null = null;
  public onLoad(): void {
    this._borders = director.getScene()?.getComponentInChildren(Borders) ?? null;
    if (this.generateOnLoad) this.generate();
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageCompleted, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
  }

  public generate(): void {
    if (this._generated || !this.macaroonPrefab || this.itemCount <= 0) return;
    this._generated = true;
    const random = new SeededRandom(this.seed >>> 0);
    const usedPerLayer: LayerPoint[][] = [];
    const pointsPerLayer = Math.max(1, Math.floor(this.itemsPerLayer));
    for (let index = 0; index < this.itemCount; index++) {
      const layer = Math.floor(index / pointsPerLayer);
      const used = usedPerLayer[layer] ?? (usedPerLayer[layer] = []);
      const point = this.findLayerPoint(random, used);
      used.push(point);

      const item = instantiate(this.macaroonPrefab);
      item.parent = this.node;
      item.setPosition(point.x, this.baseY + layer * this.layerHeight + random.range(-this.positionJitterY, this.positionJitterY), point.z);
      item.setRotationFromEuler(random.range(-7, 7), random.range(0, 360), random.range(-7, 7));
      const scale = 1 + random.range(-this.scaleJitter, this.scaleJitter);
      item.setScale(scale, scale, scale);
		const collectible = item.getComponent(CollectibleItem) ?? item.addComponent(CollectibleItem);
		collectible.stageIndex = this.stageIndex;
		// All piles settle immediately; gates only control whether they can be collected.
      collectible.setCollectionEnabled(this.stageIndex === 0);
    }
  }

  private onStageCompleted(completedStageIndex: number): void {
    if (completedStageIndex + 1 !== this.stageIndex) return;
    this.node.children.forEach((itemNode) => {
      itemNode.getComponent(CollectibleItem)?.setCollectionEnabled(true);
    });
  }

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

	for (let attempt = 0; attempt < 96; attempt++) {
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
