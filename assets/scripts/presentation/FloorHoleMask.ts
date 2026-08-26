import { _decorator, Component, Material, MeshRenderer, Node, Vec4 } from 'cc';

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

  public start(): void {
    if (!this.hole || !this.floorMaskMaterial) return;

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
    holeCenterRadius.set(position.x, position.y, position.z, this.holeRadius + this.edgePadding);
    this._instances.forEach((instance) => instance.setProperty('holeCenterRadius', holeCenterRadius));
  }
}
