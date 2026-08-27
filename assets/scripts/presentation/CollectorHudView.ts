import { _decorator, Color, Component, Label, Node, tween, v3, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';
import { CollectibleItem } from '../gameplay/CollectibleItem';

const { ccclass, property } = _decorator;

@ccclass('CollectorHudView')
export class CollectorHudView extends Component {
  @property(Label) public timerLabel: Label | null = null;
  @property({ type: [Label] }) public targetLabels: Label[] = [];
  @property(Node) public endScreen: Node | null = null;
  @property public durationSeconds = 90;
  @property({ type: [Number] }) public stageTargets = [150, 250, 300, 400];
  private _remaining: number[] = [];
  private _completed: boolean[] = [];
  private _timerStarted = false;
  private _seconds = 0;
  private _normalTimerColor: Color | null = null;
  private _counterPanelScales = new Map<Node, Vec3>();

  public onLoad(): void {
    this._remaining = this.stageTargets.slice();
    this._completed = this.stageTargets.map(() => false);
    this._seconds = this.durationSeconds;
    this._normalTimerColor = this.timerLabel?.color.clone() ?? null;
    if (this.endScreen) this.endScreen.active = false;
    this.renderTimer();
    this.renderCounters();
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.DragStarted, this.startTimer, this);
    collectorEvents.on(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.DragStarted, this.startTimer, this);
    collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
  }

  public update(deltaTime: number): void {
    if (!this._timerStarted) return;
    this._seconds = Math.max(0, this._seconds - deltaTime);
    this.renderTimer();
    if (this._seconds > 0) return;
    this._timerStarted = false;
    gameEventTarget.emit(GameEvent.SET_INPUT_ENABLED, false);
    if (this.endScreen) this.endScreen.active = true;
  }

  private startTimer(): void { this._timerStarted = true; }

  private renderTimer(): void {
    const total = Math.ceil(this._seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    const secondsText = remainder < 10 ? `0${remainder}` : `${remainder}`;
    if (!this.timerLabel) return;
    this.timerLabel.string = `${minutes}:${secondsText}`;
    this.timerLabel.color = total <= 10
      ? new Color(230, 48, 48, 255)
      : (this._normalTimerColor ?? Color.WHITE);
  }

  private onPhysicalItemCollected(item: CollectibleItem): void {
    const stageIndex = item.stageIndex;
    if (stageIndex < 0 || stageIndex >= this._remaining.length || this._remaining[stageIndex] <= 0) return;
    this._remaining[stageIndex]--;
    this.renderCounters();
    if (this._remaining[stageIndex] === 0) {
      this._completed[stageIndex] = true;
      this.showStageComplete(stageIndex);
      collectorEvents.emit(CollectorEvent.StageCompleted, stageIndex);
    }
  }

  private renderCounters(): void {
    this._remaining.forEach((remaining, stageIndex) => {
    const label = this.targetLabels[stageIndex];
    if (label && !this._completed[stageIndex]) label.string = `${remaining}`;
    });
  }

  private showStageComplete(stageIndex: number): void {
    const label = this.targetLabels[stageIndex];
    if (!label) return;

    label.string = '✓';
    label.color = new Color(0, 255, 0, 255);

    // Each Label lives inside its own CounterPanel. Its parent is a stable
    // scene relation, so the animation needs no node-name lookup.
    const panel = label.node.parent;
    if (!panel) return;
    const baseScale = this._counterPanelScales.get(panel) ?? panel.scale.clone();
    this._counterPanelScales.set(panel, baseScale);
    tween(panel)
      .to(0.2, { scale: v3(baseScale.x * 1.2, baseScale.y * 1.2, baseScale.z) })
      .to(0.2, { scale: baseScale })
      .start();
  }
}
