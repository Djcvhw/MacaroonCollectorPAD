import { _decorator, AudioClip, AudioSource, Component } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectorAudioController')
export class CollectorAudioController extends Component {
  @property(AudioSource) public source: AudioSource | null = null;
  @property(AudioClip) public collectClip: AudioClip | null = null;
  @property(AudioClip) public sizeUpClip: AudioClip | null = null;
  @property(AudioClip) public gateClip: AudioClip | null = null;

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.ItemCollected, this.playCollect, this);
    collectorEvents.on(CollectorEvent.HoleSizedUp, this.playSizeUp, this);
    collectorEvents.on(CollectorEvent.GateOpened, this.playGate, this);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.ItemCollected, this.playCollect, this);
    collectorEvents.off(CollectorEvent.HoleSizedUp, this.playSizeUp, this);
    collectorEvents.off(CollectorEvent.GateOpened, this.playGate, this);
  }

  private playCollect(): void { this.source?.playOneShot(this.collectClip); }
  private playSizeUp(): void { this.source?.playOneShot(this.sizeUpClip); }
  private playGate(): void { this.source?.playOneShot(this.gateClip); }
}
