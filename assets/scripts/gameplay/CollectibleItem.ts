import { _decorator, Component, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {
  @property public stageIndex = 0;
  @property public absorbDuration = 0.25;
  private _collected = false;
  private _absorbTime = 0;
  private _target: Vec3 | null = null;
  private _start = new Vec3();

  public get isCollected(): boolean { return this._collected; }
  public beginAbsorb(target: Readonly<Vec3>): void {
    if (this._collected) return;
    this._collected = true;
    this._absorbTime = 0;
    this._start.set(this.node.worldPosition);
    this._target = new Vec3(target);
  }

  public reset(): void {
    this._collected = false;
    this._absorbTime = 0;
    this._target = null;
    this.node.active = true;
    this.node.setScale(1, 1, 1);
  }

  public update(deltaTime: number): void {
    if (!this._target) return;
    this._absorbTime += deltaTime;
    const progress = Math.min(this._absorbTime / this.absorbDuration, 1);
    Vec3.lerp(this.node.worldPosition, this._start, this._target, progress);
    const scale = 1 - progress;
    this.node.setScale(scale, scale, scale);
    if (progress >= 1) this.node.active = false;
  }
}
