import { _decorator, Component, CylinderCollider, PhysicsMaterial, RigidBody, tween, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';

const { ccclass, property } = _decorator;

@ccclass('CollectibleItem')
export class CollectibleItem extends Component {
  @property public stageIndex = 0;
  /** Matches macaroon.glb: diameter is about 1.0 world unit. */
  @property public colliderRadius = 0.49;
  @property public colliderHeight = 0.67;
  private _collected = false;
  private _absorbing = false;
  private _collectionEnabled = true;
  private _body: RigidBody | null = null;
  private _pullForce = new Vec3();

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
  public collect(): void {
    if (this._collected || !this._collectionEnabled) return;
    this._collected = true;
    this.node.active = false;
    collectorEvents.emit(CollectorEvent.PhysicalItemCollected, this);
  }

  /** Compatibility with existing stage code; collection remains physical. */
  public beginAbsorb(target: Vec3): void {
    if (this._collected || this._absorbing || !this._collectionEnabled || !this._body) return;
    this._absorbing = true;
    this._body.type = RigidBody.Type.KINEMATIC;
    const start = this.node.worldPosition.clone();
    const state = { value: 0 };
    tween(state).to(0.22, { value: 1 }, {
      onUpdate: () => this.node.setWorldPosition(Vec3.lerp(new Vec3(), start, target, state.value)),
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
    this.node.active = true;
    if (this._body) this._body.type = RigidBody.Type.DYNAMIC;
    this._body?.wakeUp();
  }

  public setCollectionEnabled(enabled: boolean): void {
    this._collectionEnabled = enabled;
  }
}
