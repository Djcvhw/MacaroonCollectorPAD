import { _decorator, Component, Label, Node } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('ResultView')
export class ResultView extends Component {
  @property(Label) public title: Label | null = null;
  @property(Node) public winContent: Node | null = null;
  @property(Node) public loseContent: Node | null = null;

  public onEnable(): void { collectorEvents.on(CollectorEvent.GameFinished, this.show, this); }
  public onDisable(): void { collectorEvents.off(CollectorEvent.GameFinished, this.show, this); }

  private show(won: boolean): void {
    this.node.active = true;
    this.winContent && (this.winContent.active = won);
    this.loseContent && (this.loseContent.active = !won);
    if (this.title) this.title.string = won ? 'GREAT!' : 'TRY AGAIN';
  }
}
