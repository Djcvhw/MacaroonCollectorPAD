import { _decorator, BoxCollider, Component, PhysicsMaterial, RigidBody, tween, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {
  private static _sharedPhysicsMaterial: PhysicsMaterial | null = null;
  @property public stageIndex = 0;
  /** One cheap primitive matching the rendered macaroon footprint. */
  @property(Vec3) public colliderSize = new Vec3(0.82, 0.55, 0.82);
  @property public absorbDuration = 0.32;
  @property({ tooltip: 'How far below the floor the visual falls before collection.' })
  public absorbDropDepth = 2.35;
  @property public absorbSideOffset = 0.12;
  @property public absorbSpinDegrees = 260;
  @property({ tooltip: 'Part of absorption spent moving inward before the downward fall.' })
  public entryPhase = 0.3;
  private _collected = false;
  private _absorbing = false;
  private _collectionEnabled = true;
  private _body: RigidBody | null = null;
  private _collider: BoxCollider | null = null;
  private _holeWorldPosition: Vec3 | null = null;
  private _physicsSimulationRequested = true;

  public get isCollected(): boolean { return this._collected; }
  public get isPhysicsSimulationActive(): boolean {
    return !!this._body?.enabled && !!this._collider?.enabled;
  }
  private ensurePhysics(): void {
    if (this._body && this._collider) return;
    this._body = this.getComponent(RigidBody) ?? this.addComponent(RigidBody);
    this._body.type = RigidBody.Type.DYNAMIC;
    this._body.mass = 0.08;
    this._body.allowSleep = true;
    // The macaroon is large relative to one physics step. Continuous collision
    // detection adds a large per-body cost here and is unnecessary once the
    // hole capture switches the body to the scripted kinematic arc.
    this._body.useCCD = false;
    this._body.sleepThreshold = 0.1;
    this._body.linearDamping = 0.12;
    this._body.angularDamping = 0.99;

    const collider = this.getComponent(BoxCollider) ?? this.addComponent(BoxCollider);
    this._collider = collider;
    collider.size = this.colliderSize;
    if (!CollectibleItem._sharedPhysicsMaterial) {
      CollectibleItem._sharedPhysicsMaterial = new PhysicsMaterial();
      CollectibleItem._sharedPhysicsMaterial.friction = 0.35;
      CollectibleItem._sharedPhysicsMaterial.restitution = 0;
    }
    collider.sharedMaterial = CollectibleItem._sharedPhysicsMaterial;
  }

  /** Called only by the physical trigger at the bottom of the hole. */
  public collect(holeWorldPosition?: Vec3): void {
    if (this._collected || !this._collectionEnabled) return;
    this._collected = true;
    this.node.active = false;
    collectorEvents.emit(CollectorEvent.PhysicalItemCollected, this, holeWorldPosition ?? this._holeWorldPosition);
  }

  /**
   * Removes the item from physics and follows the moving hole with the same
   * controlled inward/downward animation used by the reference playable.
   */
  public beginAbsorb(): void {
    if (this._collected || this._absorbing || !this._collectionEnabled) return;
    this._absorbing = true;
    if (!this.requestHolePosition()) {
      this._absorbing = false;
      console.error('[CollectibleItem] Cannot start absorption: no Hole position provider is registered.');
      return;
    }
    collectorEvents.emit(CollectorEvent.MacaroonFallStarted, this);
    const initialVelocity = new Vec3();
    const initialAngularVelocity = new Vec3();
    this._body?.getLinearVelocity(initialVelocity);
    this._body?.getAngularVelocity(initialAngularVelocity);
    this.disablePhysics();
    const start = this.node.worldPosition.clone();
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    const startEuler = this.node.eulerAngles.clone();
    const radiansToDegrees = 180 / Math.PI;
    const spinX = initialAngularVelocity.x * radiansToDegrees * this.absorbDuration + this.absorbSpinDegrees * 0.24 * sideSign;
    const spinY = initialAngularVelocity.y * radiansToDegrees * this.absorbDuration + this.absorbSpinDegrees * 0.12;
    const spinZ = initialAngularVelocity.z * radiansToDegrees * this.absorbDuration - this.absorbSpinDegrees * 0.24 * sideSign;
    const state = { value: 0 };
    tween(state).to(this.absorbDuration, { value: 1 }, {
      easing: 'quadIn',
      onUpdate: () => {
        if (!this.requestHolePosition() || !this._holeWorldPosition) return;
        const t = state.value;
        const currentTarget = this._holeWorldPosition;
        const entryPhase = Math.max(0.05, Math.min(0.6, this.entryPhase));
        const entryRaw = Math.max(0, Math.min(1, t / entryPhase));
        const entryT = entryRaw * entryRaw * (3 - 2 * entryRaw);
        const fallRaw = Math.max(0, Math.min(1, (t - entryPhase) / Math.max(0.01, 1 - entryPhase)));
        const fallT = fallRaw * fallRaw;
        const verticalVelocityInfluence = this.absorbDuration * fallRaw * (1 - fallRaw) * 0.12;
        const inward = Vec3.subtract(new Vec3(), currentTarget, start);
        inward.y = 0;
        if (inward.lengthSqr() > 0.0001) inward.normalize();
        const sideCurve = Math.sin(Math.PI * fallRaw) * this.absorbSideOffset * sideSign;
        const targetY = currentTarget.y - this.absorbDropDepth;
        this.node.setWorldPosition(
          start.x + (currentTarget.x - start.x) * entryT - inward.z * sideCurve,
          start.y + (targetY - start.y) * fallT + initialVelocity.y * verticalVelocityInfluence,
          start.z + (currentTarget.z - start.z) * entryT + inward.x * sideCurve,
        );
        this.node.setRotationFromEuler(
          startEuler.x + spinX * fallRaw,
          startEuler.y + spinY * fallRaw,
          startEuler.z + spinZ * fallRaw,
        );
      },
    }).call(() => this.collect(this._holeWorldPosition ?? undefined)).start();
  }

  public reset(): void {
    this._collected = false;
    this._absorbing = false;
    this._holeWorldPosition = null;
    this.node.active = true;
    this.applyPhysicsState(this._physicsSimulationRequested);
  }

  public setCollectionEnabled(enabled: boolean): void {
    this._collectionEnabled = enabled;
  }

  /**
   * Keeps rendering independent from physics. Far and inactive macaroons are
   * data-like visual instances: their bodies and shapes leave the physics world.
   */
  public setPhysicsSimulationActive(active: boolean): boolean {
    if (this._physicsSimulationRequested === active) return false;
    this._physicsSimulationRequested = active;
    if (this._collected || this._absorbing) return false;
    this.applyPhysicsState(active);
    return true;
  }

  private applyPhysicsState(active: boolean): void {
    if (active) {
      this.ensurePhysics();
      if (!this._body || !this._collider) return;
      this._body.enabled = true;
      this._collider.enabled = true;
      this._body.type = RigidBody.Type.DYNAMIC;
      this._body.wakeUp();
    } else {
      this.disablePhysics();
    }
  }

  private disablePhysics(): void {
    if (this._collider) this._collider.enabled = false;
    if (this._body) this._body.enabled = false;
  }

  private requestHolePosition(): boolean {
    let received = false;
    collectorEvents.emit(CollectorEvent.HolePositionRequested, (position: Vec3) => {
      if (!this._holeWorldPosition) this._holeWorldPosition = new Vec3();
      this._holeWorldPosition.set(position);
      received = true;
    });
    return received;
  }

}
