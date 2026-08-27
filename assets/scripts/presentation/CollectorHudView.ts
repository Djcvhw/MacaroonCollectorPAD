import { _decorator, CameraComponent, CCInteger, Color, Component, Graphics, Label, Node, Rect, screen, Size, Sprite, SpriteFrame, Texture2D, tween, UIOpacity, UITransform, v3, Vec3 } from 'cc';
import { CollectorEvent, collectorEvents } from '../core/CollectorEvents';
import { gameEventTarget } from '../plugins/GameEventTarget';
import { GameEvent } from '../enums/GameEvent';
import { CollectibleItem } from '../gameplay/CollectibleItem';

const { ccclass, property } = _decorator;

@ccclass('CollectorHudView')
export class CollectorHudView extends Component {
  @property(Label) public timerLabel: Label | null = null;
  @property({ type: [Label] }) public targetLabels: Label[] = [];
  @property(Node) public endScreen: Node | null = null;
  @property(Node) public endCardArt: Node | null = null;
  @property(UIOpacity) public endScreenOpacity: UIOpacity | null = null;
  @property(Node) public tutorialRoot: Node | null = null;
  @property(Node) public tutorialBackground: Node | null = null;
  @property(Node) public tutorialHand: Node | null = null;
  @property(UIOpacity) public tutorialOpacity: UIOpacity | null = null;
  @property(UITransform) public tutorialBackgroundTransform: UITransform | null = null;
  @property(UITransform) public tutorialHandTransform: UITransform | null = null;
  @property public tutorialHorizontalDistance = 160;
  @property public tutorialVerticalDistance = 40;
  @property public tutorialSpeed = 2.5;
  /** Start/centre of the gesture inside the background: 0..1 from left/bottom. */
  @property public tutorialStartXRatio = 0.5;
  @property public tutorialStartYRatio = 0.5;
  /** Normalized location of the red fingertip inside tutorial_hand.png. */
  @property public tutorialFingerAnchorX = 0.055;
  @property public tutorialFingerAnchorY = 0.94;
  @property(Node) public popupParent: Node | null = null;
  @property(Texture2D) public goalUnlockedTexture: Texture2D | null = null;
  @property(Texture2D) public sizeUpTexture: Texture2D | null = null;
  @property(Texture2D) public greatTexture: Texture2D | null = null;
  @property(Texture2D) public niceTexture: Texture2D | null = null;
  @property(Texture2D) public perfectTexture: Texture2D | null = null;
  @property(Texture2D) public redXTexture: Texture2D | null = null;
  @property({ type: [Texture2D] }) public confettiTextures: Texture2D[] = [];
  @property public titleLandscapeWidthRatio = 0.56;
  @property public titlePortraitWidthRatio = 0.86;
  @property public titleLandscapeYRatio = 0.21;
  @property public titlePortraitYRatio = 0.3;
  @property public titlePortraitScaleMultiplier = 2.3;
  @property public redXLandscapeWidthRatio = 0.12;
  @property public redXPortraitWidthRatio = 0.22;
  @property public redXLandscapeYRatio = 0;
  @property public redXPortraitYRatio = 0.04;
  @property public confettiPortraitScaleMultiplier = 2.5;
  @property({ type: CCInteger }) public confettiParticleCount = 42;
  @property({ type: CCInteger }) public sizeUpYellowParticleCount = 24;
  @property public durationSeconds = 90;
  @property({ type: [CCInteger] }) public stageTargets = [150, 250, 300, 400];
  private _remaining: number[] = [];
  private _completed: boolean[] = [];
  private _timerStarted = false;
  private _seconds = 0;
  private _normalTimerColor: Color | null = null;
  private _counterPanelScales = new Map<Node, Vec3>();
  private _popupNodes = new Map<string, Node>();
  private _popupShadows = new Map<string, Node>();
  private _comboCount = 0;
  private _lastCheerTime = -Infinity;
  private _tutorialConfigured = false;
  private _tutorialVisible = false;
  private _tutorialTime = 0;
  private _worldCamera: CameraComponent | null = null;
  private _lastFeedbackWorldPosition: Vec3 | null = null;

  public onLoad(): void {
    this._remaining = this.stageTargets.slice();
    this._completed = this.stageTargets.map(() => false);
    this._seconds = this.durationSeconds;
    if (!this.timerLabel) console.error('[CollectorHudView] Timer Label is not assigned in Inspector.');
    else this._normalTimerColor = this.timerLabel.color.clone();
    if (!this.endScreen) console.error('[CollectorHudView] End Screen is not assigned in Inspector.');
    else this.endScreen.active = false;
    if (!this.endScreenOpacity) console.error('[CollectorHudView] End Screen Opacity is not assigned in Inspector.');
    this._tutorialConfigured = this.validateTutorialConfiguration();
    if (this._tutorialConfigured) {
      this.tutorialOpacity!.opacity = 0;
      this._tutorialVisible = false;
      // The camera's IntroFinished event is the sole authority that reveals
      // the tutorial; it stays hidden during the fly-in.
      this.tutorialRoot.active = false;
    }
    this.renderTimer();
    this.renderCounters();
  }

  public onEnable(): void {
    collectorEvents.on(CollectorEvent.DragStarted, this.startTimer, this);
    collectorEvents.on(CollectorEvent.DragStarted, this.hideTutorial, this);
    collectorEvents.on(CollectorEvent.IntroFinished, this.showTutorial, this);
    collectorEvents.on(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
    collectorEvents.on(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.on(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    collectorEvents.on(CollectorEvent.GateBlocked, this.onGateBlocked, this);
    // Camera is obtained through the project's event contract, without a
    // scene-name lookup or a prefab reference to a scene node.
    this.scheduleOnce(this.requestWorldCamera, 0);
  }

  public onDisable(): void {
    collectorEvents.off(CollectorEvent.DragStarted, this.startTimer, this);
    collectorEvents.off(CollectorEvent.DragStarted, this.hideTutorial, this);
    collectorEvents.off(CollectorEvent.IntroFinished, this.showTutorial, this);
    collectorEvents.off(CollectorEvent.PhysicalItemCollected, this.onPhysicalItemCollected, this);
    collectorEvents.off(CollectorEvent.StageCompleted, this.onStageCompleted, this);
    collectorEvents.off(CollectorEvent.HoleSizedUp, this.onHoleSizedUp, this);
    collectorEvents.off(CollectorEvent.GateBlocked, this.onGateBlocked, this);
  }

  public update(deltaTime: number): void {
    this.updateTutorial(deltaTime);
    if (!this._timerStarted) return;
    this._seconds = Math.max(0, this._seconds - deltaTime);
    this.renderTimer();
    if (this._seconds > 0) return;
    this._timerStarted = false;
    gameEventTarget.emit(GameEvent.SET_INPUT_ENABLED, false);
    this.showEndScreen();
  }

  private startTimer(): void { this._timerStarted = true; }

  private showTutorial(): void {
    if (!this._tutorialConfigured || this._tutorialVisible) return;
    this.tutorialRoot!.active = true;
    this._tutorialVisible = true;
    this._tutorialTime = 0;
    this.positionTutorialHand();
    this.tutorialOpacity!.opacity = 0;
    tween(this.tutorialOpacity!).to(0.2, { opacity: 255 }).start();
  }

  private hideTutorial(): void {
    if (!this._tutorialConfigured || !this._tutorialVisible) return;
    this._tutorialVisible = false;
    tween(this.tutorialOpacity!).to(0.2, { opacity: 0 }).call(() => {
      this.tutorialRoot!.active = false;
    }).start();
  }

  private updateTutorial(deltaTime: number): void {
    if (!this._tutorialConfigured || !this._tutorialVisible) return;
    this._tutorialTime += deltaTime * this.tutorialSpeed;
    this.positionTutorialHand();
  }

  private positionTutorialHand(): void {
    if (!this._tutorialConfigured) return;
    const hand = this.tutorialHand!;
    const background = this.tutorialBackground!;
    const transform = this.tutorialHandTransform!;
    const backgroundTransform = this.tutorialBackgroundTransform!;

    // This Lissajous curve starts at the centre, enters the left/top loop,
    // crosses the centre, then completes the right loop.
    const backgroundScale = background.scale;
    const startX = background.position.x
      + (this.tutorialStartXRatio - backgroundTransform.anchorPoint.x)
      * backgroundTransform.contentSize.width * backgroundScale.x;
    const startY = background.position.y
      + (this.tutorialStartYRatio - backgroundTransform.anchorPoint.y)
      * backgroundTransform.contentSize.height * backgroundScale.y;
    const targetX = startX - Math.sin(this._tutorialTime) * this.tutorialHorizontalDistance * 0.5;
    const targetY = startY + Math.sin(this._tutorialTime * 2) * this.tutorialVerticalDistance * 0.5;
    const angleDegrees = Math.sin(this._tutorialTime * 0.5) * 5;
    const angleRadians = angleDegrees * Math.PI / 180;

    // Move the node so the fingertip—not the sprite's centre pivot—lands on
    // the requested point. Rotation is included in the compensation.
    const scale = hand.scale;
    const fingerX = (this.tutorialFingerAnchorX - transform.anchorPoint.x) * transform.contentSize.width * scale.x;
    const fingerY = (this.tutorialFingerAnchorY - transform.anchorPoint.y) * transform.contentSize.height * scale.y;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    const rotatedFingerX = fingerX * cos - fingerY * sin;
    const rotatedFingerY = fingerX * sin + fingerY * cos;

    hand.setPosition(
      targetX - rotatedFingerX,
      targetY - rotatedFingerY,
      hand.position.z,
    );
    hand.setRotationFromEuler(0, 0, angleDegrees);
  }

  private validateTutorialConfiguration(): boolean {
    const missing: string[] = [];
    if (!this.tutorialRoot) missing.push('Tutorial Root');
    if (!this.tutorialBackground) missing.push('Tutorial Background');
    if (!this.tutorialHand) missing.push('Tutorial Hand');
    if (!this.tutorialOpacity) missing.push('Tutorial Opacity');
    if (!this.tutorialBackgroundTransform) missing.push('Tutorial Background Transform');
    if (!this.tutorialHandTransform) missing.push('Tutorial Hand Transform');
    if (missing.length > 0) {
      console.error(`[CollectorHudView] Invalid Tutorial Inspector setup. Missing: ${missing.join(', ')}`);
      return false;
    }
    if (this.tutorialStartXRatio < 0 || this.tutorialStartXRatio > 1
      || this.tutorialStartYRatio < 0 || this.tutorialStartYRatio > 1) {
      console.error('[CollectorHudView] Tutorial start ratios must be between 0 and 1.');
      return false;
    }
    return true;
  }

  private renderTimer(): void {
    const total = Math.ceil(this._seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    const secondsText = remainder < 10 ? `0${remainder}` : `${remainder}`;
    if (!this.timerLabel || !this._normalTimerColor) return;
    this.timerLabel.string = `${minutes}:${secondsText}`;
    this.timerLabel.color = total <= 10
      ? new Color(230, 48, 48, 255)
      : this._normalTimerColor;
  }

  private onPhysicalItemCollected(item: CollectibleItem, holeWorldPosition?: Vec3): void {
    if (!holeWorldPosition) {
      console.error('[CollectorHudView] PhysicalItemCollected did not provide the hole world position.');
      return;
    }
    this._lastFeedbackWorldPosition = holeWorldPosition.clone();
    const stageIndex = item.stageIndex;
    if (stageIndex < 0 || stageIndex >= this._remaining.length || this._remaining[stageIndex] <= 0) return;
    this._remaining[stageIndex]--;
    this.registerCollectionForCheer();
    this.renderCounters();
    if (this._remaining[stageIndex] === 0) {
      this._completed[stageIndex] = true;
      this.showStageComplete(stageIndex);
      collectorEvents.emit(CollectorEvent.StageCompleted, stageIndex);
    }
  }

  private renderCounters(): void {
    this._remaining.forEach((remaining, stageIndex) => {
    const label = this.targetLabels[stageIndex];
    if (label && !this._completed[stageIndex]) label.string = `${remaining}`;
    });
  }

  private showStageComplete(stageIndex: number): void {
    const label = this.targetLabels[stageIndex];
    if (!label) return;

    label.string = '✓';
    label.color = new Color(0, 255, 0, 255);

    // Each Label lives inside its own CounterPanel. Its parent is a stable
    // scene relation, so the animation needs no node-name lookup.
    const panel = label.node.parent;
    if (!panel) return;
    let baseScale = this._counterPanelScales.get(panel);
    if (!baseScale) baseScale = panel.scale.clone();
    this._counterPanelScales.set(panel, baseScale);
    tween(panel)
      .to(0.2, { scale: v3(baseScale.x * 1.2, baseScale.y * 1.2, baseScale.z) })
      .to(0.2, { scale: baseScale })
      .start();
  }

  private onStageCompleted(): void { this.showTitle('goal'); }
  private onHoleSizedUp(_scale?: number, worldPosition?: Vec3): void {
    console.info(`[CollectorHudView] HoleSizedUp received; scale=${_scale ?? 'not provided'}`);
    if (worldPosition) this._lastFeedbackWorldPosition = worldPosition.clone();
    this.showTitle('size-up');
    this.spawnSizeUpParticles();
  }
  private onGateBlocked(): void { this.showRedX(); }

  private registerCollectionForCheer(): void {
    this._comboCount += 1;
    this.unschedule(this.clearCombo);
    this.scheduleOnce(this.clearCombo, 1);
    const now = performance.now();
    if (this._comboCount < 15 || now - this._lastCheerTime < 3000) return;
    this._lastCheerTime = now;
    this._comboCount = 0;
    const titles = ['great', 'nice', 'perfect'];
    this.showTitle(titles[Math.floor(Math.random() * titles.length)]);
  }

  private clearCombo = (): void => { this._comboCount = 0; };

  private showTitle(type: string): void {
    const node = this.getPopup(type);
    if (!node) return;
    const opacity = node.getComponent(UIOpacity)!;
    const base = node.getComponent(UITransform)!.contentSize;
    const layout = this.getPopupLayout(
      base.width,
      720,
      this.titleLandscapeWidthRatio,
      this.titlePortraitWidthRatio,
      this.titleLandscapeYRatio,
      this.titlePortraitYRatio,
      2,
    );
    if (!layout) return;
    const isPortrait = screen.windowSize.height > screen.windowSize.width;
    const visualScale = layout.scale * (isPortrait ? this.titlePortraitScaleMultiplier : 1);
    const shadow = this.getPopupShadow(type, node);
    this.spawnConfetti();
    node.active = true;
    node.setPosition(0, layout.y, 0);
    node.setScale(visualScale * 0.3, visualScale * 0.3, 1);
    opacity.opacity = 0;
    if (shadow) {
      const shadowOpacity = shadow.getComponent(UIOpacity)!;
      shadow.active = true;
      shadow.setPosition(0, layout.y, 0);
      shadow.setScale(visualScale * 0.45, visualScale * 0.45, 1);
      shadowOpacity.opacity = 0;
      tween(shadowOpacity).to(0.2, { opacity: 105 }).delay(type === 'goal' ? 1.0 : 0.8).to(0.25, { opacity: 0 }).call(() => shadow.active = false).start();
      tween(shadow).to(0.4, { scale: v3(visualScale * 1.35, visualScale * 1.35, 1) }, { easing: 'sineOut' })
        .delay(type === 'goal' ? 1.0 : 0.8)
        .to(0.25, { scale: v3(visualScale * 1.65, visualScale * 1.65, 1) })
        .start();
    }
    node.setSiblingIndex(this.popupParent!.children.length - 1);
    tween(opacity).to(0.2, { opacity: 255 }).delay(type === 'goal' ? 1.0 : 0.8).to(0.25, { opacity: 0 }).call(() => node.active = false).start();
    tween(node).to(0.4, { scale: v3(visualScale, visualScale, 1) }, { easing: 'elasticOut' })
      .delay(type === 'goal' ? 1.0 : 0.8)
      .to(0.25, { scale: v3(visualScale * 1.2, visualScale * 1.2, 1) })
      .start();
  }

  private showRedX(): void {
    const node = this.getPopup('red-x');
    if (!node) return;
    const opacity = node.getComponent(UIOpacity)!;
    const base = node.getComponent(UITransform)!.contentSize;
    const layout = this.getPopupLayout(
      base.width,
      150,
      this.redXLandscapeWidthRatio,
      this.redXPortraitWidthRatio,
      this.redXLandscapeYRatio,
      this.redXPortraitYRatio,
      1,
    );
    if (!layout) return;
    const visualScale = layout.scale;
    node.active = true;
    node.setPosition(0, layout.y, 0);
    node.setScale(visualScale * 0.3, visualScale * 0.3, 1);
    opacity.opacity = 255;
    tween(node).to(0.3, { scale: v3(visualScale, visualScale, 1) }, { easing: 'elasticOut' })
      .delay(0.1).to(0.2, { scale: v3(visualScale * 1.2, visualScale * 1.2, 1) }).start();
    tween(opacity).delay(0.4).to(0.2, { opacity: 0 }).call(() => node.active = false).start();
  }

  private getPopupLayout(
    sourceWidth: number,
    maximumWidth: number,
    landscapeWidthRatio: number,
    portraitWidthRatio: number,
    landscapeYRatio: number,
    portraitYRatio: number,
    maximumScale: number,
  ): { scale: number; y: number } | null {
    const canvasTransform = this.getComponent(UITransform);
    if (!canvasTransform) {
      console.error('[CollectorHudView] Cannot layout popup: UiCanvas has no UITransform.');
      return null;
    }
    if (sourceWidth <= 0) {
      console.error(`[CollectorHudView] Cannot layout popup: invalid source width ${sourceWidth}.`);
      return null;
    }
    const isPortrait = screen.windowSize.height > screen.windowSize.width;
    const canvasSize = canvasTransform.contentSize;
    const widthRatio = isPortrait ? portraitWidthRatio : landscapeWidthRatio;
    const yRatio = isPortrait ? portraitYRatio : landscapeYRatio;
    const targetWidth = Math.min(maximumWidth, canvasSize.width * widthRatio);
    return {
      scale: Math.min(maximumScale, targetWidth / sourceWidth),
      y: canvasSize.height * yRatio,
    };
  }

  private getPopup(type: string): Node | null {
    const existing = this._popupNodes.get(type);
    if (existing) return existing;
    const texture = this.getPopupTexture(type);
    if (!texture) {
      console.error(`[CollectorHudView] Popup texture is not assigned for type: ${type}`);
      return null;
    }
    if (!this.popupParent) {
      console.error('[CollectorHudView] Popup Parent is not assigned in Inspector.');
      return null;
    }
    const node = new Node(`Feedback_${type}`);
    node.parent = this.popupParent;
    // Runtime nodes do not inherit the UI layer automatically. Without this,
    // the UI camera culls an otherwise valid Sprite.
    node.layer = this.popupParent.layer;
    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = new Rect(0, 0, texture.width, texture.height);
    frame.originalSize = new Size(texture.width, texture.height);
    node.addComponent(Sprite).spriteFrame = frame;
    node.addComponent(UITransform).setContentSize(texture.width, texture.height);
    node.addComponent(UIOpacity).opacity = 0;
    node.active = false;
    node.setSiblingIndex(this.popupParent.children.length - 1);
    this._popupNodes.set(type, node);
    return node;
  }

  private requestWorldCamera = (): void => {
    gameEventTarget.emit(GameEvent.CAMERA_GET, (camera: CameraComponent) => {
      this._worldCamera = camera;
    });
  };

  private getFeedbackPosition(): Vec3 | null {
    if (!this._worldCamera) {
      console.error('[CollectorHudView] Cannot emit confetti: world camera was not received.');
      return null;
    }
    let currentHolePosition: Vec3 | null = null;
    collectorEvents.emit(CollectorEvent.HolePositionRequested, (position: Vec3) => {
      currentHolePosition = position.clone();
    });
    if (!currentHolePosition) {
      console.error('[CollectorHudView] Cannot emit confetti: current hole world position was not provided.');
      return null;
    }
    if (!this.popupParent) {
      console.error('[CollectorHudView] Cannot emit confetti: Popup Parent is not assigned in Inspector.');
      return null;
    }
    if (!this.popupParent.getComponent(UITransform)) {
      console.error('[CollectorHudView] Cannot emit confetti: Popup Parent has no UITransform.');
      return null;
    }
    // Cocos performs the framebuffer -> design-resolution conversion here,
    // including view scale and Canvas adaptation. Reimplementing these steps
    // through UiCamera.screenToWorld produced an offset outside the screen.
    return this._worldCamera.convertToUINode(currentHolePosition, this.popupParent, v3());
  }

  private spawnConfetti(): void {
    if (!this.popupParent) {
      console.error('[CollectorHudView] Cannot emit confetti: Popup Parent is not assigned in Inspector.');
      return;
    }
    if (this.confettiTextures.length === 0) {
      console.error('[CollectorHudView] Cannot emit confetti: Confetti Textures are not assigned in Inspector.');
      return;
    }
    const origin = this.getFeedbackPosition();
    if (!origin) return;
    const confettiScaleMultiplier = screen.windowSize.height > screen.windowSize.width
      ? this.confettiPortraitScaleMultiplier
      : 1;
    const particleCount = Math.max(1, this.confettiParticleCount);
    for (let index = 0; index < particleCount; index += 1) {
      const texture = this.confettiTextures[index % this.confettiTextures.length];
      if (!texture) {
        console.error(`[CollectorHudView] Confetti texture at index ${index % this.confettiTextures.length} is invalid.`);
        continue;
      }
      const piece = new Node();
      piece.parent = this.popupParent;
      piece.layer = this.popupParent.layer;
      piece.setPosition(origin);
      piece.setRotationFromEuler(0, 0, Math.random() * 360);
      const frame = new SpriteFrame();
      frame.texture = texture;
      frame.rect = new Rect(0, 0, texture.width, texture.height);
      frame.originalSize = new Size(texture.width, texture.height);
      piece.addComponent(Sprite).spriteFrame = frame;
      piece.addComponent(UITransform).setContentSize(texture.width, texture.height);
      const opacity = piece.addComponent(UIOpacity);
      opacity.opacity = 255;
      const scale = (0.65 + Math.random() * 0.45) * confettiScaleMultiplier;
      piece.setScale(scale, scale, 1);
      const angle = Math.random() * Math.PI * 2;
      const distance = (120 + Math.random() * 170) * confettiScaleMultiplier;
      const destination = v3(
        origin.x + Math.cos(angle) * distance,
        origin.y + Math.sin(angle) * distance + 75 * confettiScaleMultiplier,
        0,
      );
      piece.setSiblingIndex(this.popupParent.children.length - 1);
      tween(piece)
        .to(0.62 + Math.random() * 0.18, { position: destination, angle: piece.angle + 220 + Math.random() * 240 }, { easing: 'quadOut' })
        .call(() => piece.destroy())
        .start();
      tween(opacity).delay(0.35).to(0.32, { opacity: 0 }).start();
    }
  }

  private spawnSizeUpParticles(): void {
    if (!this.popupParent) {
      console.error('[CollectorHudView] Cannot emit size-up particles: Popup Parent is not assigned in Inspector.');
      return;
    }
    const origin = this.getFeedbackPosition();
    if (!origin) return;
    const portraitMultiplier = screen.windowSize.height > screen.windowSize.width
      ? this.confettiPortraitScaleMultiplier
      : 1;
    const count = Math.max(1, this.sizeUpYellowParticleCount);
    for (let index = 0; index < count; index += 1) {
      const particle = new Node();
      particle.parent = this.popupParent;
      particle.layer = this.popupParent.layer;
      particle.setPosition(origin);
      particle.setRotationFromEuler(0, 0, Math.random() * 360);
      const particleSize = 12 + Math.random() * 8;
      particle.addComponent(UITransform).setContentSize(particleSize, particleSize);
      const graphics = particle.addComponent(Graphics);
      graphics.fillColor = index % 2 === 0
        ? new Color(255, 238, 0, 255)
        : new Color(255, 190, 0, 255);
      graphics.circle(0, 0, particleSize * 0.5);
      graphics.fill();
      const opacity = particle.addComponent(UIOpacity);
      opacity.opacity = 255;

      const particleScale = (0.9 + Math.random() * 0.65) * portraitMultiplier;
      particle.setScale(particleScale, particleScale, 1);
      const angle = index / count * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const distance = (100 + Math.random() * 190) * portraitMultiplier;
      const destination = v3(
        origin.x + Math.cos(angle) * distance,
        origin.y + Math.sin(angle) * distance,
        0,
      );
      particle.setSiblingIndex(this.popupParent.children.length - 1);
      tween(particle)
        .to(0.48 + Math.random() * 0.22, {
          position: destination,
          angle: particle.angle + 300 + Math.random() * 300,
          scale: v3(particleScale * 0.35, particleScale * 0.35, 1),
        }, { easing: 'quadOut' })
        .call(() => particle.destroy())
        .start();
      tween(opacity).delay(0.2).to(0.35, { opacity: 0 }).start();
    }
  }

  private getPopupTexture(type: string): Texture2D | null {
    switch (type) {
      case 'goal': return this.goalUnlockedTexture;
      case 'size-up': return this.sizeUpTexture;
      case 'great': return this.greatTexture;
      case 'nice': return this.niceTexture;
      case 'perfect': return this.perfectTexture;
      case 'red-x': return this.redXTexture;
      default:
        console.error(`[CollectorHudView] Unknown popup type: ${type}`);
        return null;
    }
  }

  private getPopupShadow(type: string, source: Node): Node | null {
    const cached = this._popupShadows.get(type);
    if (cached) return cached;
    const sourceFrame = source.getComponent(Sprite)?.spriteFrame;
    if (!sourceFrame) {
      console.error(`[CollectorHudView] Popup ${type} has no SpriteFrame.`);
      return null;
    }
    if (!this.popupParent) {
      console.error('[CollectorHudView] Cannot create popup shadow: Popup Parent is not assigned.');
      return null;
    }

    const shadow = new Node(`FeedbackGlow_${type}`);
    shadow.parent = this.popupParent;
    shadow.layer = this.popupParent.layer;
    shadow.addComponent(UITransform).setContentSize(sourceFrame.rect.width, sourceFrame.rect.height);
    shadow.addComponent(UIOpacity).opacity = 0;
    for (const offset of [[0, 0], [-5, 0], [5, 0], [0, -5], [0, 5]]) {
      const copy = new Node();
      copy.parent = shadow;
      copy.layer = shadow.layer;
      copy.setPosition(offset[0], offset[1], 0);
      copy.addComponent(Sprite).spriteFrame = sourceFrame;
      copy.getComponent(Sprite)!.color = new Color(255, 255, 255, 42);
      copy.addComponent(UITransform).setContentSize(sourceFrame.rect.width, sourceFrame.rect.height);
    }
    shadow.active = false;
    this._popupShadows.set(type, shadow);
    return shadow;
  }

  private showEndScreen(): void {
    if (!this.endScreen || !this.endScreenOpacity || !this.endCardArt) {
      console.error('[CollectorHudView] Cannot show end screen: End Screen, End Screen Opacity, or End Card Art is not assigned.');
      return;
    }
    this.endScreen.active = true;
    this.endScreenOpacity.opacity = 0;
    tween(this.endScreenOpacity).to(0.3, { opacity: 255 }).start();
    const art = this.endCardArt;
    const base = art.scale.clone();
    art.setScale(0, 0, base.z);
    tween(art).delay(0.2).to(0.4, { scale: base }, { easing: 'backOut' }).start();
  }
}
