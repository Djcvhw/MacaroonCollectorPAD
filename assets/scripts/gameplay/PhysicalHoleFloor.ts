import { _decorator, BoxCollider, Component, CylinderCollider, ITriggerEvent, MeshCollider, Node, PhysicsMaterial, RigidBody, Vec3, utils } from 'cc';
import { CollectibleItem } from './CollectibleItem';

const { ccclass, property } = _decorator;

/**
 * A single kinematic annular mesh is the actual physical floor.
 * Its inner opening moves with Hole, so physics determines the tip-over point.
 */
@ccclass('PhysicalHoleFloor')
export class PhysicalHoleFloor extends Component {
  @property public holeRadius = 1;
  @property public floorRadius = 512;
  @property public segments = 64;
  /** Hole is authored at Y=-1.4 while the visible floor surface is Y=0. */
  @property public surfaceLocalY = 1.4;
  @property public bottomDepth = 2.7;
  @property public bottomRadiusFactor = 1.2;
  @property public funnelAcceleration = 210;
  private _floorCollider: MeshCollider | null = null;
  private _bottomNode: Node | null = null;
  private _bottomCollider: CylinderCollider | null = null;
  private _captureCollider: CylinderCollider | null = null;
  private _initialHoleRadius = 0;
  private _lastHolePosition = new Vec3(Number.NaN, Number.NaN, Number.NaN);

  public onLoad(): void {
	this._initialHoleRadius = this.holeRadius;
    // This node must remain static. Only its mesh hole is rebuilt as Hole moves;
    // parenting it to Hole makes a kinematic floor drag every resting macaroon.
    const floorNode = new Node('PhysicalFloorWithHole');
    floorNode.parent = this.node.parent;
    floorNode.setPosition(0, this.node.position.y + this.surfaceLocalY, 0);
    const body = floorNode.addComponent(RigidBody);
    body.type = RigidBody.Type.STATIC;

    this._floorCollider = floorNode.addComponent(MeshCollider);
    const floorMaterial = new PhysicsMaterial();
    floorMaterial.friction = 0.55;
    floorMaterial.restitution = 0;
    this._floorCollider.sharedMaterial = floorMaterial;
    this.rebuildFloorMesh();

    // Physical safety net: a body that escapes below the floor cannot make a goal unwinnable.
    const recoveryNode = new Node('UnderfloorMacaroonCatcher');
    recoveryNode.parent = floorNode;
    recoveryNode.setPosition(0, -this.bottomDepth - 1, 0);
    const recovery = recoveryNode.addComponent(BoxCollider);
    recovery.isTrigger = true;
    recovery.size = new Vec3(this.floorRadius * 2, 1, this.floorRadius * 2);
    recovery.on('onTriggerEnter', this.onBottomTrigger, this);

    const bottomNode = new Node('HoleBottomTrigger');
    bottomNode.parent = this.node;
    bottomNode.setPosition(0, this.surfaceLocalY - this.bottomDepth, 0);
    const bottom = bottomNode.addComponent(CylinderCollider);
	this._bottomNode = bottomNode;
	this._bottomCollider = bottom;
    bottom.isTrigger = true;
    bottom.radius = this.holeRadius * this.bottomRadiusFactor;
    bottom.height = 0.15;
    bottom.on('onTriggerEnter', this.onBottomTrigger, this);

    // A volume, not a teleport: bodies inside it receive extra downward force.
    // It makes the fall decisive and prevents a body from bouncing out over the rim.
    const funnelVolume = new Node('HoleFunnelForceVolume');
    funnelVolume.parent = this.node;
    funnelVolume.setPosition(0, this.surfaceLocalY - this.bottomDepth * 0.5 + 0.12, 0);
    const funnel = funnelVolume.addComponent(CylinderCollider);
	this._captureCollider = funnel;
    funnel.isTrigger = true;
    funnel.radius = this.holeRadius * 0.98;
    funnel.height = this.bottomDepth + 0.24;
    funnel.on('onTriggerEnter', this.onCaptureTriggerEnter, this);
  }

  public lateUpdate(): void {
    const position = this.node.position;
    if (position.x === this._lastHolePosition.x && position.z === this._lastHolePosition.z) return;
    this.rebuildFloorMesh();
  }

  private onBottomTrigger(event: ITriggerEvent): void {
    event.otherCollider.node.getComponent(CollectibleItem)?.collect();
  }

  private onFunnelTriggerStay(event: ITriggerEvent): void {
    event.otherCollider.node.getComponent(CollectibleItem)?.applyDownwardAcceleration(this.funnelAcceleration);
  }

  private onCaptureTriggerEnter(event: ITriggerEvent): void {
    if (this._bottomNode) event.otherCollider.node.getComponent(CollectibleItem)?.beginAbsorb(this._bottomNode.worldPosition);
  }

  public setHoleScale(scale: number): void {
    this.holeRadius = this._initialHoleRadius * scale;
    if (this._bottomCollider) this._bottomCollider.radius = this.holeRadius * this.bottomRadiusFactor;
    if (this._captureCollider) this._captureCollider.radius = this.holeRadius * 0.98;
    this.rebuildFloorMesh();
  }

  private rebuildFloorMesh(): void {
    this._lastHolePosition.set(this.node.position.x, this.node.position.y, this.node.position.z);
    if (this._floorCollider) this._floorCollider.mesh = utils.createMesh(this.createAnnulus());
  }

  private createAnnulus(): { positions: number[]; indices: number[] } {
    const positions: number[] = [];
    const indices: number[] = [];
    const count = Math.max(24, Math.floor(this.segments));
    for (let index = 0; index <= count; index++) {
      const angle = index / count * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Inner vertices are in the static floor's coordinate system.
      positions.push(this.node.position.x + cos * this.holeRadius, 0, this.node.position.z + sin * this.holeRadius);
      positions.push(cos * this.floorRadius, 0, sin * this.floorRadius);
    }
    for (let index = 0; index < count; index++) {
      const innerA = index * 2;
      const outerA = innerA + 1;
      const innerB = innerA + 2;
      const outerB = innerA + 3;
      indices.push(innerA, outerB, outerA, innerA, innerB, outerB);
    }
    return { positions, indices };
  }
}
