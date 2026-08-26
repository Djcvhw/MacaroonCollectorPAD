import { _decorator, Component, Node, Vec3 } from 'cc';
import { CollectorLevelConfig } from '../config/CollectorLevelConfig';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { HoleController } from './HoleController';
import { CollectibleItem } from './CollectibleItem';
import { GateController } from './GateController';

const { ccclass, property } = _decorator;
const holePosition = new Vec3();

@ccclass('StageDirector')
export class StageDirector extends Component {
  @property({ type: [Node], tooltip: 'Roots which contain CollectibleItem components per stage.' })
  public stageRoots: Node[] = [];
  @property({ type: [GateController] }) public gates: GateController[] = [];

  private _config: CollectorLevelConfig | null = null;
  private _hole: HoleController | null = null;
  private _stageIndex = 0;
  private _collected = 0;
  private _items: CollectibleItem[][] = [];

  public initialize(config: CollectorLevelConfig, hole: HoleController): void {
    this._config = config;
    this._hole = hole;
    this._items = this.stageRoots.map((root, index) => {
      const items = root.getComponentsInChildren(CollectibleItem);
      items.forEach((item) => item.stageIndex = index);
      return items;
    });
  }

  public update(): void {
    if (!this._config || !this._hole) return;
    const items = this._items[this._stageIndex] ?? [];
    holePosition.set(this._hole.node.worldPosition);
    const radiusSq = this._hole.collectionRadius * this._hole.collectionRadius;
    for (const item of items) {
      if (item.isCollected || !item.node.activeInHierarchy) continue;
      const deltaX = item.node.worldPosition.x - holePosition.x;
      const deltaZ = item.node.worldPosition.z - holePosition.z;
      if (deltaX * deltaX + deltaZ * deltaZ > radiusSq) continue;
      item.beginAbsorb(holePosition);
      this._collected++;
      collectorEvents.emit(CollectorEvent.ItemCollected, this._stageIndex, this._collected, this._config.stageTargets[this._stageIndex]);
      if (this._collected >= this._config.stageTargets[this._stageIndex]) {
        this.completeStage();
        return;
      }
    }
  }

  public reset(): void {
    this._stageIndex = 0;
    this._collected = 0;
    this.stageRoots.forEach((root, index) => root.active = index === 0);
    this._items.forEach((items) => items.forEach((item) => item.reset()));
    this.gates.forEach((gate) => gate.reset());
  }

  private completeStage(): void {
    if (!this._config || !this._hole) return;
    const completed = this._stageIndex;
    collectorEvents.emit(CollectorEvent.StageCompleted, completed);
    this._hole.setScale(this._config.stageHoleScales[completed]);
    this.gates[completed]?.open();
    this._stageIndex++;
    this._collected = 0;
    if (this._stageIndex >= this._config.stageTargets.length) return;
    this.stageRoots[this._stageIndex].active = true;
  }
}
