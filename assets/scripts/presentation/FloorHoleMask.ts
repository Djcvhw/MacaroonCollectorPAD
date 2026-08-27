import { _decorator, Component, Material, MeshRenderer, Node, Vec4 } from 'cc';
import { PhysicalHoleFloor } from '../gameplay/PhysicalHoleFloor';

const { ccclass, property } = _decorator;
const holeCenterRadius = new Vec4();

/**
 * Cuts a circular opening from every floor tile in world space.
 * Attach once to the common Floor root; it owns no gameplay position.
 */
@ccclass('FloorHoleMask')
export class FloorHoleMask extends Component {
  @property(Node)
  public hole: Node | null = null;

  @property(Material)
  public floorMaskMaterial: Material | null = null;

  @property
  public holeRadius = 1.15;

  @property
  public edgePadding = 0.02;

  private _instances: Material[] = [];
  private _physicalHole: PhysicalHoleFloor | null = null;
  private _initialPhysicalRadius = 1;

  public start(): void {
    if (!this.hole || !this.floorMaskMaterial) return;

    this._physicalHole = this.hole.getComponent(PhysicalHoleFloor);
    this._initialPhysicalRadius = this._physicalHole?.holeRadius ?? 1;

    this.node.getComponentsInChildren(MeshRenderer).forEach((renderer) => {
      // In Creator 3.8.4 MaterialInstance is internal. The renderer is the
      // supported factory for an independent instance per floor renderer.
      renderer.setSharedMaterial(this.floorMaskMaterial!, 0);
      const instance = renderer.getMaterialInstance(0);
      if (instance) this._instances.push(instance);
    });
  }

  public lateUpdate(): void {
    if (!this.hole || this._instances.length === 0) return;
    const position = this.hole.worldPosition;
    // Hole itself stays at scale 1 so movement and collision bounds do not
    // inherit presentation scale. The mask must therefore follow the same
    // physical radius that rebuilds the floor cut-out.
    const growthScale = this._physicalHole
      ? this._physicalHole.holeRadius / this._initialPhysicalRadius
      : this.hole.worldScale.x;
    holeCenterRadius.set(position.x, position.y, position.z, this.holeRadius * growthScale + this.edgePadding);
    this._instances.forEach((instance) => instance.setProperty('holeCenterRadius', holeCenterRadius));
  }
}
