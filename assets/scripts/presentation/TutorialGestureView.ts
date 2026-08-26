import { _decorator, Component, Node, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('TutorialGestureView')
export class TutorialGestureView extends Component {
  @property(Node) public hand: Node | null = null;
  @property public horizontalDistance = 160;
  @property public verticalDistance = 40;
  @property public speed = 2.5;
  private _time = 0;

  public onEnable(): void { collectorEvents.on(CollectorEvent.DragStarted, this.hide, this); }
  public onDisable(): void { collectorEvents.off(CollectorEvent.DragStarted, this.hide, this); }

  public update(deltaTime: number): void {
    if (!this.hand) return;
    this._time += deltaTime * this.speed;
    const x = Math.sin(this._time) * this.horizontalDistance * 0.5;
    const y = Math.sin(this._time * 2) * this.verticalDistance * 0.5 + 25;
    this.hand.setPosition(x, y, 0);
    this.hand.setRotationFromEuler(0, 0, Math.sin(this._time * 0.5) * 5);
  }

  private hide(): void { this.node.active = false; }
}
