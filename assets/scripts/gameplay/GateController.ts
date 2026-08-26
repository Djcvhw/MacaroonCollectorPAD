import { _decorator, Component, Node, Quat, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('GateController')
export class GateController extends Component {
  @property(Node) public leftDoor: Node | null = null;
  @property(Node) public rightDoor: Node | null = null;
  @property public openDuration = 0.5;

  private _opening = false;
  private _time = 0;
  private _leftStart = new Quat();
  private _rightStart = new Quat();

  public onLoad(): void {
    this.leftDoor?.getRotation(this._leftStart);
    this.rightDoor?.getRotation(this._rightStart);
  }

  public open(): void {
    if (this._opening) return;
    this._opening = true;
    this._time = 0;
    collectorEvents.emit(CollectorEvent.GateOpened, this.node.name);
  }

  public reset(): void {
    this._opening = false;
    this._time = 0;
    this.leftDoor?.setRotation(this._leftStart);
    this.rightDoor?.setRotation(this._rightStart);
    this.node.active = true;
  }

  public update(deltaTime: number): void {
    if (!this._opening) return;
    this._time = Math.min(this._time + deltaTime, this.openDuration);
    const t = this._time / this.openDuration;
    const eased = 1 - Math.pow(1 - t, 3);
    const angle = -Math.PI * 0.5 * eased;
    this.leftDoor?.setRotationFromEuler(0, angle * 180 / Math.PI, 0);
    this.rightDoor?.setRotationFromEuler(0, angle * 180 / Math.PI, 0);
    if (t >= 1) this._opening = false;
  }
}
