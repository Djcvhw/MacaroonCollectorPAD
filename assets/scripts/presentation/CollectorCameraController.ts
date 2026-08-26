import { _decorator, Component, Node, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { HoleController } from '../gameplay/HoleController';
import { CollectorLevelConfig } from '../config/CollectorLevelConfig';
import { PlayableEvent, playableEvents } from '../platform/PlayableEvents';

const { ccclass, property } = _decorator;
const desiredPosition = new Vec3();
const desiredLookAt = new Vec3();

@ccclass('CollectorCameraController')
export class CollectorCameraController extends Component {
  @property(Node) public cameraNode: Node | null = null;
  @property(HoleController) public hole: HoleController | null = null;
  @property(CollectorLevelConfig) public config: CollectorLevelConfig | null = null;
  @property public followHeight = 12;
  @property public followBehind = -10;
  @property public lookAtHeight = 2;
  @property public smoothing = 0.035;

  private _zoom = 1;
  private _followGameplay = false;

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.DragStarted, this.onDragStarted, this);
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageComplete, this);
    playableEvents.on(PlayableEvent.CameraGet, this.onCameraGet, this);
    playableEvents.on(PlayableEvent.CameraUpdatePosition, this.onCameraUpdatePosition, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.DragStarted, this.onDragStarted, this);
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageComplete, this);
    playableEvents.off(PlayableEvent.CameraGet, this.onCameraGet, this);
    playableEvents.off(PlayableEvent.CameraUpdatePosition, this.onCameraUpdatePosition, this);
  }

  public update(): void {
    if (!this._followGameplay || !this.cameraNode || !this.hole) return;
    const position = this.hole.node.worldPosition;
    desiredPosition.set(position.x, position.y + this.followHeight * this._zoom, position.z + this.followBehind * this._zoom);
    desiredLookAt.set(position.x, this.lookAtHeight, position.z);
    Vec3.lerp(this.cameraNode.worldPosition, this.cameraNode.worldPosition, desiredPosition, this.smoothing);
    this.cameraNode.lookAt(desiredLookAt);
  }

  private onStageComplete(stageIndex: number): void {
    this._zoom = this.config?.stageCameraZooms[stageIndex] ?? this._zoom;
  }

  private onDragStarted(): void {
    this._followGameplay = true;
  }

  private onCameraGet(callback: (camera: Node | null) => void): void { callback?.(this.cameraNode); }
  private onCameraUpdatePosition(): void { this._followGameplay = true; }
}
