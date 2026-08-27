import { _decorator, CCFloat, Component } from 'cc';

const { ccclass, property } = _decorator;

/** Inspector-authored tuning for this playable and future collector reskins. */
@ccclass('CollectorLevelConfig')
export class CollectorLevelConfig extends Component {
  @property({ tooltip: 'Seconds available after the first player drag.' })
  public durationSeconds = 90;

  @property({ type: [CCFloat], tooltip: 'Required collected items per stage.' })
  public stageTargets = [150, 250, 300, 400];

  @property({ type: [CCFloat], tooltip: 'Hole scale at the end of every stage.' })
  public stageHoleScales = [1.5, 2.2, 2.8, 3.5];

  @property({ type: [CCFloat], tooltip: 'Camera zoom multiplier per stage.' })
  public stageCameraZooms = [1, 1.2, 1.45, 1.75];

  @property
  public baseHoleRadius = 1;

  @property
  public holeSmoothFactor = 0.3;

  @property
  public laneWidth = 12;

  @property({ type: [CCFloat] })
  public gatePositions = [20, 52, 92, 140];

  public validate(): void {
    const count = this.stageTargets.length;
    if (count === 0 || this.stageHoleScales.length !== count || this.stageCameraZooms.length !== count) {
      throw new Error('CollectorLevelConfig stage arrays must have the same non-zero length.');
    }
  }
}
