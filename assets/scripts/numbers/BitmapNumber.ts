import { _decorator, Component, Node, SpriteComponent, SpriteFrame, Vec2, tween, Layers, Enum, CCInteger, Color } from 'cc';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from "../enums/GameEvent"

const { ccclass, property } = _decorator;

const MaxNumberCharacters = 5;

Enum(GameEvent);

// region classes-helpers
// endregion

@ccclass('BitmapNumber')
export class BitmapNumber extends Component {
	// region editors' fields and properties
	@property({ type: GameEvent })
	eventAdd: GameEvent = GameEvent.NONE;

	@property({ type: GameEvent })
	eventSub: GameEvent = GameEvent.NONE;

	@property({ type: GameEvent })
	eventGet: GameEvent = GameEvent.NONE;

	@property(CCInteger)
	defaultNumber: number = 220;

	@property
	digitWidth: number = 128;

	@property(Color)
	numberColor: Color = new Color(255, 255, 255, 255);

	@property(SpriteFrame)
	signSpriteFrame: SpriteFrame = null;

	@property(Vec2)
	signOffset: Vec2 = new Vec2();

	@property
	delimiterWidth: number = 5;

	@property(SpriteFrame)
	delimiterSpriteFrame: SpriteFrame = null;

	@property(Vec2)
	delimiterOffset: Vec2 = new Vec2();

	@property(SpriteFrame)
	digitsSpriteFrames: SpriteFrame[] = [];
	// endregion

	// region public fields and properties
	set number(newNumber: number) {
		if (Math.floor(newNumber) == this._number) {
			return;
		}

		this._number = newNumber;
		this.set();
	}
	get number(): number {
		return this._number;
	}
	// endregion

	// region private fields and properties
	_number: number = -1;
	_targetNumber: number = -1;
	_signCharacter: SpriteComponent = null;
	_delimiterCharacters: SpriteComponent[] = [];
	_characters: SpriteComponent[] = [];
	// endregion

	// region life-cycle callbacks
	start() {
		if (this.signSpriteFrame) {
			const charNode = new Node();
			charNode.layer = Layers.Enum.UI_2D;
			this._signCharacter = charNode.addComponent(SpriteComponent);
			this._signCharacter.spriteFrame = this.signSpriteFrame;
			this._signCharacter.color = this.numberColor;
			this.node.addChild(charNode);
		}

		if (this.delimiterSpriteFrame) {
			const delimitersNumber = Math.floor(MaxNumberCharacters / 3);
			for (let i = 0; i < delimitersNumber; ++i) {
				const charNode = new Node();
				charNode.layer = Layers.Enum.UI_2D;
				charNode.setPosition(-((i + 1) * 3 * this.digitWidth + this._delimiterCharacters.length * this.delimiterWidth - this.delimiterOffset.x), this.delimiterOffset.y, 0);
				const delimiterCharacter = charNode.addComponent(SpriteComponent);
				delimiterCharacter.spriteFrame = this.delimiterSpriteFrame;
				delimiterCharacter.color = this.numberColor;
				this._delimiterCharacters.push(delimiterCharacter);
				this.node.addChild(charNode);
			}
		}

		while (this._characters.length < MaxNumberCharacters) {
			const charNode = new Node();
			charNode.layer = Layers.Enum.UI_2D;
			charNode.setPosition(-(this._characters.length * this.digitWidth + Math.floor(this._characters.length / 3) * this.delimiterWidth), 0, 0);
			const characterSprite = charNode.addComponent(SpriteComponent);
			characterSprite.color = this.numberColor;
			this._characters.push(characterSprite);
			this.node.addChild(charNode);
		}

		this.number = this.defaultNumber;
		this._targetNumber = this._number;
		this._syncFromGetter();
	}

	onEnable() {
		this._subscribeEvents(true);
	}

	onDisable() {
		this._subscribeEvents(false);
	}
	// endregion

	// region public methods
	set() {
		let tempNumber = this._number;
		let numberDigits = [];

		while (tempNumber / 10 > 0) {
			numberDigits.push(Math.floor(tempNumber % 10));
			tempNumber = Math.floor(tempNumber / 10);
		}

		if (numberDigits.length <= 0) {
			numberDigits.push(0);
		}

		this._characters.forEach((character, index) => {
			character.spriteFrame = numberDigits[index] !== null ? this.digitsSpriteFrames[numberDigits[index]] : null;
		})

		if (this._signCharacter) {
			this._signCharacter.node.setPosition(-numberDigits.length * this.digitWidth - Math.floor((numberDigits.length - 1) / 3) * this.delimiterWidth + this.signOffset.x, this.signOffset.y, 0);
		}

		this._delimiterCharacters.forEach((character, index) => {
			character.node.active = false;
			if (index + 1 <= Math.floor((numberDigits.length - 1) / 3)) {
				character.node.active = true;
			}
		})

		//центруем
		const activeMeshRenderers = this._characters.filter(char => char.spriteFrame);
		const totalWidth = activeMeshRenderers.length * this.digitWidth;
		activeMeshRenderers.reverse().forEach((char, index) => {
			// Добавляем digitWidth / 2 для правильного центрирования, так как символы центрированы относительно своих узлов
			char.node.setPosition(-totalWidth / 2 + this.digitWidth / 2 + index * this.digitWidth, char.node.position.y, char.node.position.z);
		});

	}

	preAdd(addAmount: number, changeTime: number) {
		this.add(addAmount, changeTime);
	}

	add(addAmount: number, changeTime: number) {
		this._targetNumber += addAmount;
		const fromNumber = this._number;

		const t = { value: 0 };
		tween(t)
			.to(changeTime, { value: 1 }, {
				onUpdate: () => {
					this.number = fromNumber + (this._targetNumber - fromNumber) * t.value;
				}
			})
			.call(() => this.postAdd(addAmount))
			.start();
	}

	postAdd(addAmount) { }

	preSub(subAmount: number, changeTime: number) {
		this.sub(subAmount, changeTime);
	}

	sub(subAmount: number, changeTime: number) {
		this._targetNumber -= subAmount;
		const fromNumber = this._number;

		const t = { value: 0 };
		tween(t)
			.to(changeTime, { value: 1 }, {
				onUpdate: () => {
					this.number = fromNumber + (this._targetNumber - fromNumber) * t.value;
				}
			})
			.call(() => this.postSub(subAmount))
			.start();
	}

	postSub(subAmount) { }
	// endregion

	// region private methods
	_subscribeEvents(isOn) {
		const func = isOn ? 'on' : 'off';

		gameEventTarget[func](this.eventAdd, this.onEventAdd, this);
		gameEventTarget[func](this.eventSub, this.onEventSub, this);
		gameEventTarget[func](this.eventGet, this.onEventGet, this);
	}

	private _syncFromGetter() {
		if (this.eventGet === GameEvent.NONE) {
			return;
		}

		gameEventTarget.emit(this.eventGet, (value: number) => {
			this.number = value;
			this._targetNumber = this._number;
		});
	}
	// endregion

	// region event handlers
	onEventAdd(addAmount = 1, changeTime = 0.3) {
		this.preAdd(addAmount, changeTime);
	}

	onEventSub(subAmount = 1, changeTime = 0.3) {
		this.preSub(subAmount, changeTime);
	}

	onEventGet(callback) {
		callback(this._targetNumber);
	}
	// endregion
}
