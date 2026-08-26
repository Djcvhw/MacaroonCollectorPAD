import { _decorator, Camera, Component, EventTouch, geometry, input, Input, math, Node, Vec2, Vec3 } from 'cc';
import { CollectorLevelConfig } from '../config/CollectorLevelConfig';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;
const screenPoint = new Vec2();
const ray = new geometry.Ray();
const targetWorld = new Vec3();

@ccclass('HoleController')
export class HoleController extends Component {
  @property(Camera) public gameplayCamera: Camera | null = null;
  @property(Node) public visualRoot: Node | null = null;
  @property(CollectorLevelConfig) public config: CollectorLevelConfig | null = null;

  private _inputEnabled = false;
  private _directInputEnabled = true;
  private _dragging = false;
  private _target = new Vec3();
  private _scale = 1;

  public get collectionRadius(): number {
    return (this.config?.baseHoleRadius ?? 1) * this._scale;
  }

  public onEnable(): void {
    this.subscribeDirectInput(true);
  }

  public onDisable(): void {
    this.subscribeDirectInput(false);
  }

  public setDirectInputEnabled(enabled: boolean): void {
    if (this._directInputEnabled === enabled) return;
    this._directInputEnabled = enabled;
    if (!enabled) this.endPointer();
    if (this.enabledInHierarchy) this.subscribeDirectInput(enabled);
  }

  public beginPointer(x: number, y: number): void {
    if (!this._inputEnabled || !this.projectTouch(x, y)) return;
    this._dragging = true;
    this.node.emit(CollectorEvent.DragStarted);
    collectorEvents.emit(CollectorEvent.DragStarted);
  }

  public movePointer(x: number, y: number): void {
    if (this._dragging) this.projectTouch(x, y);
  }

  public endPointer(): void {
    if (!this._dragging) return;
    this._dragging = false;
    collectorEvents.emit(CollectorEvent.DragEnded);
  }

  private subscribeDirectInput(isOn: boolean): void {
    if (!this._directInputEnabled) return;
    const func = isOn ? 'on' : 'off';
    input[func](Input.EventType.TOUCH_START, this.onTouchStart, this);
    input[func](Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input[func](Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input[func](Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  public update(deltaTime: number): void {
    if (this._dragging) {
      const factor = Math.min((this.config?.holeSmoothFactor ?? 0.3) * (deltaTime / 0.016), 0.5);
      this.node.worldPosition = Vec3.lerp(this.node.worldPosition, this.node.worldPosition, this._target, factor);
    }
  }

  public setInputEnabled(enabled: boolean): void { this._inputEnabled = enabled; }

  public reset(): void {
    this._dragging = false;
    this._scale = 1;
    this.visualRoot?.setScale(1, 1, 1);
  }

  public setScale(nextScale: number): void {
    this._scale = nextScale;
    this.visualRoot?.setScale(nextScale, 1, nextScale);
    collectorEvents.emit(CollectorEvent.HoleSizedUp, nextScale);
  }


  private onTouchStart(event: EventTouch): void {
    this.beginPointer(event.getLocationX(), event.getLocationY());
  }

  private onTouchMove(event: EventTouch): void {
    this.movePointer(event.getLocationX(), event.getLocationY());
  }

  private onTouchEnd(): void {
    this.endPointer();
  }

  private projectTouch(x: number, y: number): boolean {
    if (!this.gameplayCamera) return false;
    screenPoint.set(x, y);
    this.gameplayCamera.screenPointToRay(screenPoint.x, screenPoint.y, ray);
    if (Math.abs(ray.d.y) < 0.0001) return false;
    const distance = -ray.o.y / ray.d.y;
    if (distance < 0) return false;
    Vec3.scaleAndAdd(targetWorld, ray.o, ray.d, distance);
    const halfLane = (this.config?.laneWidth ?? 12) / 2 - this.collectionRadius;
    targetWorld.x = math.clamp(targetWorld.x, -halfLane, halfLane);
    targetWorld.z = math.clamp(targetWorld.z, 0, 140);
    this._target.set(targetWorld);
    return true;
  }

}
