import { _decorator, BoxCollider, Component, Node, PhysicsMaterial, PhysicsSystem, RigidBody, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Reference-style physical floor: one static primitive remains intact.
 * The visible opening is shader-driven and collection is distance-driven, so
 * no moving MeshCollider has to be cooked while the player drags the hole.
 */
@ccclass('PhysicalHoleFloor')
export class PhysicalHoleFloor extends Component {
  @property public holeRadius = 1;
  @property public floorRadius = 512;
  @property public segments = 64;
  /** Hole is authored at Y=-1.4 while the visible floor surface is Y=0.2. */
  @property public surfaceLocalY = 1.6;
  @property public bottomDepth = 2.7;
  @property public bottomRadiusFactor = 1.2;
  /** Insets the capture trigger so contact starts when the macaroon centre crosses the rim. */
  @property public captureRadiusInset = 0.49;
  @property public funnelAcceleration = 210;
  @property({ tooltip: 'Global 3D physics step. 1/30 halves the normal 60 Hz simulation cost.' })
  public physicsFixedTimeStep = 1 / 30;
  @property({ tooltip: 'Maximum physics catch-up steps per rendered frame.' })
  public physicsMaxSubSteps = 1;
  @property({ tooltip: 'Higher values let slow bodies enter sleep sooner.' })
  public physicsSleepThreshold = 0.25;
  /** Physics collider refresh rate; the visual floor mask still updates every frame. */
  @property public meshRebuildInterval = 1 / 30;
  private _initialHoleRadius = 0;

  public onLoad(): void {
	PhysicsSystem.instance.fixedTimeStep = this.physicsFixedTimeStep;
	PhysicsSystem.instance.maxSubSteps = Math.max(1, Math.floor(this.physicsMaxSubSteps));
	PhysicsSystem.instance.sleepThreshold = this.physicsSleepThreshold;
	this._initialHoleRadius = this.holeRadius;
    const floorNode = new Node('PhysicalFloorWithHole');
    floorNode.parent = this.node.parent;
    const thickness = 0.1;
    floorNode.setPosition(0, this.node.position.y + this.surfaceLocalY - thickness * 0.5, 0);
    const body = floorNode.addComponent(RigidBody);
    body.type = RigidBody.Type.STATIC;

    const floorCollider = floorNode.addComponent(BoxCollider);
    floorCollider.size = new Vec3(this.floorRadius * 2, thickness, this.floorRadius * 2);
    const floorMaterial = new PhysicsMaterial();
    floorMaterial.friction = 0.55;
    floorMaterial.restitution = 0;
    floorCollider.sharedMaterial = floorMaterial;
  }

  public setHoleScale(scale: number): void {
    this.holeRadius = this._initialHoleRadius * scale;
  }

}
