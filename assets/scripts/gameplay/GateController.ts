import { _decorator, Component, Node, tween, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { Borders } from '../plugins/Borders';

const { ccclass, property } = _decorator;

@ccclass('GateController')
export class GateController extends Component {
  /** The matching Borders/Gates/Gate* node with its two collision points. */
  @property(Node) public borderPoints: Node | null = null;
  @property(Borders) public borders: Borders | null = null;
  @property public openDuration = 0.38;
  @property public openAngle = 82;
  @property public doorHingeOffset = 2.35;
  @property public stageIndex = 0;

  private _opened = false;
  private _closedDoorEuler: Vec3[] = [];
	private _doorPivots: Node[] = [];

  public onLoad(): void {
    const doors = this.node.children.slice(0, 2);
    doors.forEach((door, index) => {
      const pivot = new Node(`GateHinge_${index}`);
      pivot.parent = this.node;
      const hingeOffset = index === 0 ? -this.doorHingeOffset : this.doorHingeOffset;
      pivot.setPosition(door.position.x, door.position.y, door.position.z + hingeOffset);
      door.parent = pivot;
      door.setPosition(0, 0, -hingeOffset);
      this._doorPivots.push(pivot);
    });
    this._closedDoorEuler = this._doorPivots.map(pivot => pivot.eulerAngles.clone());
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageCompleted, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
  }

  private onStageCompleted(stageIndex: number): void {
    if (stageIndex === this.stageIndex) this.open();
  }

  public open(): void {
    if (this._opened) return;
    this._opened = true;
    this.borderPoints && (this.borderPoints.active = false);
    this.borders?.recalculateBorders();
    collectorEvents.emit(CollectorEvent.GateOpened, this.node.name);
    this.animateOpen();
  }

  public reset(): void {
    this._opened = false;
    this.node.active = true;
    if (this.borderPoints) this.borderPoints.active = true;
    this._doorPivots.forEach((door, index) => {
      const closed = this._closedDoorEuler[index];
      if (closed) door.setRotationFromEuler(closed);
    });
    this.borders?.recalculateBorders();
  }

  private animateOpen(): void {
    const doors = this._doorPivots;
    if (doors.length !== 2 || this._closedDoorEuler.length !== 2) {
      this.node.active = false;
      return;
    }
    let finished = 0;
    doors.forEach((door, index) => {
      const closed = this._closedDoorEuler[index];
      const state = { angle: 0 };
      tween(state)
        .to(this.openDuration, { angle: index === 0 ? this.openAngle : -this.openAngle }, {
          onUpdate: () => door.setRotationFromEuler(closed.x, closed.y + state.angle, closed.z),
        })
        .call(() => {
          finished++;
          if (finished === doors.length) this.node.active = false;
        })
        .start();
    });
  }
}
