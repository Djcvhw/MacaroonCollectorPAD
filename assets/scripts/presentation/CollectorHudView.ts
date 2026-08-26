import { _decorator, Component, Label, Node } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectorHudView')
export class CollectorHudView extends Component {
  @property(Label) public timerLabel: Label | null = null;
  @property({ type: [Label] }) public targetLabels: Label[] = [];
  @property({ type: [Node] }) public completedMarkers: Node[] = [];

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.TimerChanged, this.renderTimer, this);
    collectorEvents.on(CollectorEvent.ItemCollected, this.renderProgress, this);
    collectorEvents.on(CollectorEvent.StageCompleted, this.renderStageComplete, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.TimerChanged, this.renderTimer, this);
    collectorEvents.off(CollectorEvent.ItemCollected, this.renderProgress, this);
    collectorEvents.off(CollectorEvent.StageCompleted, this.renderStageComplete, this);
  }

  private renderTimer(seconds: number): void {
    const total = Math.ceil(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    const secondsText = remainder < 10 ? `0${remainder}` : `${remainder}`;
    if (this.timerLabel) this.timerLabel.string = `${minutes}:${secondsText}`;
  }

  private renderProgress(stageIndex: number, collected: number, target: number): void {
    const label = this.targetLabels[stageIndex];
    if (label) label.string = `${collected}/${target}`;
  }

  private renderStageComplete(stageIndex: number): void {
    const marker = this.completedMarkers[stageIndex];
    if (marker) marker.active = true;
  }
}
