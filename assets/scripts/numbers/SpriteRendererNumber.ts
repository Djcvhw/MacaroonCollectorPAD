import { _decorator, CCInteger, Component, Layers, Material, Node, SpriteFrame, SpriteRenderer, tween, Vec2 } from 'cc';

const { ccclass, property } = _decorator;
const MAX_NUMBER_CHARACTERS = 5;

@ccclass('SpriteRendererNumber')
export class SpriteRendererNumber extends Component {
	@property(Material)
	private rendererMaterial: Material | null = null;

	@property(CCInteger)
	private defaultNumber = 220;

	@property
	private digitScale = 0.55;

	@property
	private digitWidth = 0.3;

	@property(SpriteFrame)
	private sign: SpriteFrame | null = null;

	@property(Vec2)
	private signOffset = new Vec2();

	@property
	private delimiterWidth = 5;

	@property(SpriteFrame)
	private delimiter: SpriteFrame | null = null;

	@property(Vec2)
	private delimiterOffset = new Vec2();

	@property([SpriteFrame])
	private digits: SpriteFrame[] = [];

	private _number = -1;
	private _targetNumber = -1;
	private _signRenderer: SpriteRenderer | null = null;
	private _delimiterRenderers: SpriteRenderer[] = [];
	private _digitRenderers: SpriteRenderer[] = [];

	public get targetNumber(): number {
		return this._targetNumber;
	}

	public set number(value: number) {
		const number = Math.floor(value);
		if (number === this._number) {
			return;
		}

		this._number = number;
		this._render();
	}

	public get number(): number {
		return this._number;
	}

	onLoad() {
		this._createSign();
		this._createDelimiters();
		this._createDigits();

		if (this._targetNumber < 0) {
			this.set(this.defaultNumber);
		} else {
			this._render();
		}
	}

	public set(value: number) {
		this.number = value;
		this._targetNumber = this._number;
	}

	public sub(amount: number, duration: number) {
		this._targetNumber -= amount;
		this._tweenToTarget(duration);
	}

	private _tweenToTarget(duration: number) {
		const fromNumber = this._number;
		const state = { value: 0 };

		tween(state)
			.to(duration, { value: 1 }, {
				onUpdate: () => {
					this.number = fromNumber + (this._targetNumber - fromNumber) * state.value;
				},
			})
			.start();
	}

	private _render() {
		const numberDigits = this._getDigits(this._number);

		this._digitRenderers.forEach((digit, index) => {
			const digitSprite = this.digits[numberDigits[index]];
			digit.node.active = Boolean(digitSprite);
			if (digitSprite) {
				digit.spriteFrame = digitSprite;
			}
		});

		if (this._signRenderer) {
			this._signRenderer.node.setPosition(-numberDigits.length * this.digitWidth - Math.floor((numberDigits.length - 1) / 3) * this.delimiterWidth + this.signOffset.x, this.signOffset.y, 0);
		}

		this._delimiterRenderers.forEach((delimiter, index) => {
			delimiter.node.active = index + 1 <= Math.floor((numberDigits.length - 1) / 3);
		});
	}

	private _getDigits(value: number): number[] {
		const digits: number[] = [];
		let number = Math.max(0, Math.floor(value));

		do {
			digits.push(number % 10);
			number = Math.floor(number / 10);
		} while (number > 0);

		return digits;
	}

	private _createSign() {
		if (!this.sign) {
			return;
		}

		const signNode = this._createCharacterNode();
		this._signRenderer = this._createRenderer(signNode);
		this._signRenderer.spriteFrame = this.sign;
	}

	private _createDelimiters() {
		if (!this.delimiter) {
			return;
		}

		const delimiterCount = Math.floor(MAX_NUMBER_CHARACTERS / 3);
		for (let i = 0; i < delimiterCount; i++) {
			const delimiterNode = this._createCharacterNode();
			delimiterNode.setPosition(-((i + 1) * 3 * this.digitWidth + this._delimiterRenderers.length * this.delimiterWidth - this.delimiterOffset.x), this.delimiterOffset.y, 0);

			const delimiterRenderer = this._createRenderer(delimiterNode);
			delimiterRenderer.spriteFrame = this.delimiter;
			this._delimiterRenderers.push(delimiterRenderer);
		}
	}

	private _createDigits() {
		for (let i = 0; i < MAX_NUMBER_CHARACTERS; i++) {
			const digitNode = this._createCharacterNode();
			digitNode.setPosition(-(i * this.digitWidth + Math.floor(i / 3) * this.delimiterWidth), 0, 0);
			digitNode.setScale(this.digitScale, this.digitScale, 1);

			const digitRenderer = this._createRenderer(digitNode);
			digitRenderer.spriteFrame = this.digits[0] || null;
			this._digitRenderers.push(digitRenderer);
		}
	}

	private _createCharacterNode(): Node {
		const node = new Node();
		node.layer = Layers.Enum.DEFAULT;
		this.node.addChild(node);
		return node;
	}

	private _createRenderer(node: Node): SpriteRenderer {
		const renderer = node.addComponent(SpriteRenderer);
		if (this.rendererMaterial) {
			renderer.setMaterialInstance(this.rendererMaterial, 0);
		}

		return renderer;
	}
}
