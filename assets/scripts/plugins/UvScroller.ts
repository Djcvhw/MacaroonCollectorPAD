import { _decorator, Component, error, Material, renderer, v4, Vec4 } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('UvScroller')
export class UvScroller extends Component {
	@property(Material)
	private material: Material | null = null;

	@property
	private zScrollSpeed = 0;

	@property
	private wScrollSpeed = 0;

	@property
	private isAutoStart = false;

	private _isOn = false;
	private _materialPass: renderer.Pass | null = null;
	private _tilingOffset: Vec4 = v4();
	private _tilingOffsetHandle = 0;
	private _isValid = false;

	onLoad() {
		this._isValid = this._validate();
		if (!this._isValid || !this.material) {
			return;
		}

		this._materialPass = this.material.passes[0];
		this._tilingOffsetHandle = this._materialPass.getHandle('tilingOffset');
		this._tilingOffset = this._materialPass.getUniform(this._tilingOffsetHandle, v4());
	}

	start() {
		if (this.isAutoStart) {
			this.toggle(true);
		}
	}

	update(deltaTime: number) {
		if (!this._isOn || !this._materialPass) {
			return;
		}

		this._tilingOffset.set(
			this._tilingOffset.x,
			this._tilingOffset.y,
			(this._tilingOffset.z + this.zScrollSpeed * deltaTime) % 1,
			(this._tilingOffset.w + this.wScrollSpeed * deltaTime) % 1
		);

		this._materialPass.setUniform(this._tilingOffsetHandle, this._tilingOffset);
	}

	public toggle(isOn?: boolean) {
		this._isOn = isOn === undefined ? !this._isOn : isOn;
	}

	private _validate(): boolean {
		if (!this.material) {
			error(`[UvScroller] Material is not assigned on ${this.node.name}.`);
			return false;
		}

		return true;
	}
}
