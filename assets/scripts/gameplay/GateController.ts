import { _decorator, Component, Node, tween, v2, Vec2, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { Borders } from '../plugins/Borders';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';

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
  private _lastBlockedTime = -Infinity;

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
    gameEventTarget.on(GameEvent.CORRECT_VELOCITY, this.onCorrectVelocity, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    gameEventTarget.off(GameEvent.CORRECT_VELOCITY, this.onCorrectVelocity, this);
  }

  private onStageCompleted(stageIndex: number): void {
    if (stageIndex === this.stageIndex) this.open();
  }

  private onCorrectVelocity(position: Vec3, radius: number, velocity: Vec3): void {
    if (this._opened || !this.borderPoints || this.borderPoints.children.length < 2) return;
    const start = this.borderPoints.children[0].worldPosition;
    const end = this.borderPoints.children[1].worldPosition;
    const current = v2(position.x, position.z);
    const next = v2(position.x + velocity.x, position.z + velocity.z);
    const distanceBefore = this.distanceToSegment(current, v2(start.x, start.z), v2(end.x, end.z));
    const distanceAfter = this.distanceToSegment(next, v2(start.x, start.z), v2(end.x, end.z));
    // Borders stop the centre just outside `radius`, so accept a tiny margin
    // and report the attempted approach rather than waiting for penetration.
    if (distanceAfter > radius + 0.12 || distanceAfter >= distanceBefore) return;

    const now = performance.now();
    if (now - this._lastBlockedTime < 500) return;
    this._lastBlockedTime = now;
    collectorEvents.emit(CollectorEvent.GateBlocked, this.stageIndex);
  }

  private distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
    const delta = Vec2.subtract(v2(), end, start);
    const lengthSquared = delta.lengthSqr();
    if (lengthSquared <= 0.000001) return Vec2.distance(point, start);
    const progress = Math.max(0, Math.min(1, Vec2.dot(Vec2.subtract(v2(), point, start), delta) / lengthSquared));
    return Vec2.distance(point, Vec2.add(v2(), start, Vec2.multiplyScalar(v2(), delta, progress)));
  }

  public open(): void {
    if (this._opened) return;
    this._opened = true;
    this.borderPoints && (this.borderPoints.active = false);
    this.borders?.recalculateBorders();
    collectorEvents.emit(CollectorEvent.GateOpened, this.stageIndex);
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
