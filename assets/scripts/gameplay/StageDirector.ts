import { _decorator, Component, Node } from 'cc';
import { CollectorLevelConfig } from '../config/CollectorLevelConfig';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { HoleController } from './HoleController';
import { CollectibleItem } from './CollectibleItem';
import { GateController } from './GateController';

const { ccclass, property } = _decorator;

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
    collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
    this._config = config;
    this._hole = hole;
    this._items = this.stageRoots.map((root, index) => {
      const items = root.getComponentsInChildren(CollectibleItem);
      items.forEach((item) => item.stageIndex = index);
      return items;
    });
    collectorEvents.on(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
    this.updateCollectionEligibility();
  }

  public reset(): void {
    this._stageIndex = 0;
    this._collected = 0;
    // All sections stay visible from the first frame. Collection is still
    // restricted to _stageIndex in update(), so a closed gate determines access.
    this.stageRoots.forEach((root) => root.active = true);
    this._items.forEach((items) => items.forEach((item) => item.reset()));
    this.gates.forEach((gate) => gate.reset());
    this.updateCollectionEligibility();
  }

  public onDestroy(): void {
    collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
  }

  private onPhysicalItemCollected(item: CollectibleItem): void {
    if (!this._config || item.stageIndex !== this._stageIndex) return;
    this._collected++;
    collectorEvents.emit(CollectorEvent.ItemCollected, this._stageIndex, this._collected, this._config.stageTargets[this._stageIndex]);
    if (this._collected >= this._config.stageTargets[this._stageIndex]) this.completeStage();
  }

  private completeStage(): void {
    if (!this._config || !this._hole) return;
    const completed = this._stageIndex;
    collectorEvents.emit(CollectorEvent.StageCompleted, completed);
    this._hole.setScale(this._config.stageHoleScales[completed]);
    this.gates[completed]?.open();
    this._stageIndex++;
    this._collected = 0;
    this.updateCollectionEligibility();
    if (this._stageIndex >= this._config.stageTargets.length) return;
  }

  private updateCollectionEligibility(): void {
    this._items.forEach((items, index) => items.forEach((item) => item.setCollectionEnabled(index === this._stageIndex)));
  }
}
