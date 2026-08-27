import { _decorator, Component, CylinderCollider, PhysicsMaterial, RigidBody, tween, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {
  @property public stageIndex = 0;
  /** Matches macaroon.glb: diameter is about 1.0 world unit. */
  @property public colliderRadius = 0.49;
  @property public colliderHeight = 0.67;
  @property public absorbDuration = 0.32;
  @property public absorbArcHeight = 0.7;
  @property public absorbSideOffset = 0.35;
  @property public absorbSpinDegrees = 260;
  private _collected = false;
  private _absorbing = false;
  private _collectionEnabled = true;
  private _body: RigidBody | null = null;
  private _pullForce = new Vec3();
  private _holeWorldPosition: Vec3 | null = null;

  public get isCollected(): boolean { return this._collected; }
  public onLoad(): void {
    this._body = this.getComponent(RigidBody) ?? this.addComponent(RigidBody);
    this._body.type = RigidBody.Type.DYNAMIC;
    this._body.mass = 0.08;
    this._body.allowSleep = true;
    this._body.useCCD = true;
    this._body.linearDamping = 0.1;
    this._body.angularDamping = 0.35;

    const collider = this.getComponent(CylinderCollider) ?? this.addComponent(CylinderCollider);
    collider.radius = this.colliderRadius;
    collider.height = this.colliderHeight;
    const material = new PhysicsMaterial();
    material.friction = 0.55;
    material.restitution = 0;
    collider.sharedMaterial = material;
  }

  /** Called only by the physical trigger at the bottom of the hole. */
  public collect(holeWorldPosition?: Vec3): void {
    if (this._collected || !this._collectionEnabled) return;
    this._collected = true;
    this.node.active = false;
    collectorEvents.emit(CollectorEvent.PhysicalItemCollected, this, holeWorldPosition ?? this._holeWorldPosition);
  }

  /** Compatibility with existing stage code; collection remains physical. */
  public beginAbsorb(target: Vec3, holeWorldPosition: Vec3): void {
    if (this._collected || this._absorbing || !this._collectionEnabled || !this._body) return;
    this._absorbing = true;
    this._holeWorldPosition = holeWorldPosition.clone();
    collectorEvents.emit(CollectorEvent.MacaroonFallStarted, this);
    this._body.type = RigidBody.Type.KINEMATIC;
    const start = this.node.worldPosition.clone();
    const control = Vec3.lerp(new Vec3(), start, target, 0.5);
    control.y += this.absorbArcHeight;
    const inward = Vec3.subtract(new Vec3(), target, start);
    inward.y = 0;
    if (inward.lengthSqr() > 0.0001) inward.normalize();
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    control.x += -inward.z * this.absorbSideOffset * sideSign;
    control.z += inward.x * this.absorbSideOffset * sideSign;
    const startEuler = this.node.eulerAngles.clone();
    const spinX = (0.65 + Math.random() * 0.7) * this.absorbSpinDegrees * sideSign;
    const spinZ = (0.65 + Math.random() * 0.7) * this.absorbSpinDegrees * -sideSign;
    const state = { value: 0 };
    tween(state).to(this.absorbDuration, { value: 1 }, {
      easing: 'quadIn',
      onUpdate: () => {
        const t = state.value;
        const oneMinusT = 1 - t;
        this.node.setWorldPosition(
          start.x * oneMinusT * oneMinusT + control.x * 2 * oneMinusT * t + target.x * t * t,
          start.y * oneMinusT * oneMinusT + control.y * 2 * oneMinusT * t + target.y * t * t,
          start.z * oneMinusT * oneMinusT + control.z * 2 * oneMinusT * t + target.z * t * t,
        );
        this.node.setRotationFromEuler(
          startEuler.x + spinX * t,
          startEuler.y + this.absorbSpinDegrees * 0.35 * t,
          startEuler.z + spinZ * t,
        );
      },
    }).call(() => this.collect()).start();
  }

  /** Physical acceleration used only while the rigid body is inside the hole volume. */
  public applyDownwardAcceleration(acceleration: number): void {
    if (this._collected || !this._body) return;
    this._body.wakeUp();
    this._pullForce.set(0, -this._body.mass * acceleration, 0);
    this._body.applyForce(this._pullForce);
  }

  public reset(): void {
    this._collected = false;
    this._absorbing = false;
    this._holeWorldPosition = null;
    this.node.active = true;
    if (this._body) this._body.type = RigidBody.Type.DYNAMIC;
    this._body?.wakeUp();
  }

  public setCollectionEnabled(enabled: boolean): void {
    this._collectionEnabled = enabled;
  }
}
