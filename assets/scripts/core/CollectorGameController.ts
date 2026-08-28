import { _decorator, Component, Node } from 'cc';
import { CollectorLevelConfig } from '../config/CollectorLevelConfig';
import { CollectorEvent, collectorEvents } from './CollectorEvents';
import { CollectorGameState } from './CollectorTypes';
import { HoleController } from '../gameplay/HoleController';
import { StageDirector } from '../gameplay/StageDirector';
import { PlayableEvent, playableEvents } from '../platform/PlayableEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectorGameController')
export class CollectorGameController extends Component {
  @property(CollectorLevelConfig) public config: CollectorLevelConfig | null = null;
  @property(HoleController) public hole: HoleController | null = null;
  @property(StageDirector) public stages: StageDirector | null = null;
  @property(Node) public tutorialRoot: Node | null = null;
  @property(Node) public resultRoot: Node | null = null;

  private _state = CollectorGameState.Loading;
  private _remainingSeconds = 0;

  public get state(): CollectorGameState { return this._state; }
  public get remainingSeconds(): number { return this._remainingSeconds; }

  public start(): void {
    if (!this.config || !this.hole || !this.stages) {
      throw new Error('CollectorGameController requires Config, Hole, and Stages Inspector references.');
    }
    this.stages.initialize(this.config, this.hole);
    this.config.validate(this.stages.stageCount);
    this.hole.setInputEnabled(true);
    this.hole.node.on(CollectorEvent.DragStarted, this.beginGame, this);
    collectorEvents.on(CollectorEvent.StageCompleted, this.tryFinishAfterStage, this);
    collectorEvents.on(CollectorEvent.GameFinished, this.showResult, this);
    this.reset();
  }

  public update(deltaTime: number): void {
    if (this._state !== CollectorGameState.Playing) return;
    this._remainingSeconds = Math.max(0, this._remainingSeconds - deltaTime);
    collectorEvents.emit(CollectorEvent.TimerChanged, this._remainingSeconds);
    if (this._remainingSeconds === 0) this.finish(false);
  }

  public reset(): void {
    if (!this.config || !this.stages || !this.hole) return;
    this._remainingSeconds = this.config.durationSeconds;
    this.stages.reset();
    this.hole.reset();
    this.tutorialRoot && (this.tutorialRoot.active = true);
    this.resultRoot && (this.resultRoot.active = false);
    this.setState(CollectorGameState.Tutorial);
    collectorEvents.emit(CollectorEvent.TimerChanged, this._remainingSeconds);
  }

  public finish(won: boolean): void {
    if (this._state === CollectorGameState.Won || this._state === CollectorGameState.Lost) return;
    this.setState(won ? CollectorGameState.Won : CollectorGameState.Lost);
    collectorEvents.emit(CollectorEvent.GameFinished, won);
    playableEvents.emit(PlayableEvent.GameEnded, won);
  }

  private beginGame(): void {
    if (this._state !== CollectorGameState.Tutorial) return;
    this.tutorialRoot && (this.tutorialRoot.active = false);
    this.setState(CollectorGameState.Playing);
    playableEvents.emit(PlayableEvent.GameStarted);
  }

  private showResult(): void {
    this.resultRoot && (this.resultRoot.active = true);
  }

  private tryFinishAfterStage(stageIndex: number): void {
    if (this.stages && stageIndex === this.stages.stageCount - 1) this.finish(true);
  }

  private setState(next: CollectorGameState): void {
    const previous = this._state;
    this._state = next;
    collectorEvents.emit(CollectorEvent.GameStateChanged, previous, next);
  }
}
