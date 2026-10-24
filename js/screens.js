// screens.js — 界面管理。main 只认 ScreenManager，不感知具体界面。
// Screen 统一接口：{ enter(params), exit(), update(dt, events), render(ctx) }
// 界面：MainMenu / Playing / Shop（商店）/ Backpack（背包）。
// 商店与背包复用同一套"物品格子"UI：SHOP_UI 布局参数 + render.drawItemGrid 绘制。
import { CANVAS, THEME } from './config.js';
import { MINER, STATES } from './config_gameplay.js';
import { DIFFICULTIES } from './config_level.js';
import { SHOP_UI, SHOP_ITEMS } from './config_shop.js';
import { Level } from './level.js';
import { spawnLevel } from './entities.js';
import { useItem } from './items.js';
import {
  drawBackground, drawTitle, drawButtons, drawDifficultyRecords,
  drawItemGrid, drawToast, drawEmptyHint, drawHint,
  drawScene, drawHud, drawPopups, drawResult, drawLoading,
  preloadAssets, assetsReady,
} from './render.js';

// ———— 按钮：界面层共用的最小结构 + 命中检测 ————
function makeButton(x, y, w, h, label, tag) {
  return { x, y, w, h, label, tag };
}

function hitTest(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/** 难度按钮下方的一行战绩文字 */
function recordText(rec) {
  if (!rec) return '暂无记录';
  const result = rec.result === 'clear' ? '胜' : '负';
  return `${result} · 用时 ${rec.timeUsed.toFixed(1)}s · ${rec.score} 分`;
}

/** 主菜单快捷键说明：由 SHOP_ITEMS 的 key 字段生成（加商品自动更新） */
function hotkeyHint() {
  const rows = Object.values(SHOP_ITEMS).filter((d) => d.key);
  return `游戏内快捷键：${rows.map((d) => `${d.key} ${d.label}`).join(' · ')}`;
}

// ———— 商店/背包共用的物品格子数据（同一套 SHOP_UI + drawItemGrid） ————

/** 第 i 个格子的中心坐标（按 SHOP_UI 布局：先列后行） */
function cellCenter(i) {
  const col = i % SHOP_UI.cols;
  const row = Math.floor(i / SHOP_UI.cols);
  return {
    x: SHOP_UI.gridX + col * SHOP_UI.colGap,
    y: SHOP_UI.gridY + row * SHOP_UI.rowGap,
  };
}

/** 商店卡片：图标 + 名字 + 价格 + 购买按钮（卡片顺序与商品列表一致） */
function shopCards(items) {
  return items.map((item, i) => {
    const { x, y } = cellCenter(i);
    const b = SHOP_UI.btn; // 共用按钮参数（商店=购买 / 背包=使用）
    return {
      x, y,
      color: item.color, sprite: item.sprite, label: item.label,
      price: item.price,
      buy: { x: x - b.w / 2, y: y + b.dy, w: b.w, h: b.h, label: '购买' },
    };
  });
}

/** 背包卡片：图标 + 名字 + 右下角数量角标；游戏内打开时多一个「使用」按钮（usable） */
function bagCards(list, usable) {
  return list.map((it, i) => {
    const { x, y } = cellCenter(i);
    const b = SHOP_UI.btn;
    const card = {
      x, y,
      id: it.id,
      color: it.def.color, sprite: it.def.sprite,
      label: it.def.label, badge: it.count,
    };
    if (usable) card.use = { x: x - b.w / 2, y: y + b.dy, w: b.w, h: b.h, label: '使用' };
    return card;
  });
}

/** 商店/背包的公共返回逻辑：从哪来回哪去（回游戏带 resume，不重置本局） */
function backTo(screens, from) {
  if (from === 'playing') screens.switchTo('playing', { resume: true });
  else screens.switchTo('menu');
}

export class ScreenManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.screens = {};
    this.current = null;
  }

  register(name, screen) {
    this.screens[name] = screen;
    return this;
  }

  /** 切换界面；params 传给新界面的 enter（如 { resume: true } = 从商店/背包返回接着玩） */
  switchTo(name, params) {
    if (this.current) this.current.exit();
    this.current = this.screens[name];
    this.current.enter(params);
  }

  update(dt, events) {
    this.current?.update(dt, events);
  }

  render() {
    this.current?.render(this.ctx);
  }
}

/**
 * 主菜单：标题页（开始游戏/商店/背包）→ 难度选择页。
 * 难度按钮直接由 DIFFICULTIES 表生成：表里加一行难度，菜单自动多一个按钮。
 * 金币与背包内容按需求不在标题页直接展示，点「商店/背包」进对应界面查看。
 */
export class MainMenuScreen {
  constructor(game, screens) {
    this.game = game;
    this.screens = screens;
    this.mode = 'title'; // 'title' = 标题页 | 'difficulty' = 难度选择页
    this.toast = { text: '', t: 0 }; // 提示（清档结果等）
    this.btnStart = makeButton(300, 300, 200, 56, '开始游戏');
    this.btnShop = makeButton(300, 368, 200, 56, '商店');
    this.btnBag = makeButton(300, 436, 200, 56, '背包');
    this.btnClear = makeButton(300, 504, 200, 56, '清档'); // 两段式确认，见 update
    this.clearArmed = false;
    this.clearTimer = 0;
    this.btnBack = makeButton(300, 484, 200, 56, '返回');
    this.diffButtons = DIFFICULTIES.map((d, i) =>
      makeButton(300, 228 + i * 76, 200, 56, d.label, d.tag)
    );
  }

  get buttons() {
    return this.mode === 'title'
      ? [this.btnStart, this.btnShop, this.btnBag, this.btnClear]
      : [...this.diffButtons, this.btnBack];
  }

  enter() {
    this.mode = 'title'; // 每次回到主菜单都从标题页开始
    this.toast = { text: '', t: 0 };
    this._disarmClear();
  }

  /** 清档确认还原：按钮文字复位、超时计时清零 */
  _disarmClear() {
    this.clearArmed = false;
    this.clearTimer = 0;
    this.btnClear.label = '清档';
  }

  exit() {}

  update(dt, events) {
    // 提示条 / 清档确认倒计时
    if (this.toast.t > 0) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast.text = '';
    }
    if (this.clearTimer > 0) {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this._disarmClear();
    }
    for (const ev of events) {
      if (ev.x === undefined) continue; // 键盘事件不参与按钮点击
      const b = this.buttons.find((btn) => hitTest(btn, ev.x, ev.y));
      if (!b) continue;
      if (b === this.btnStart) {
        this.mode = 'difficulty';
      } else if (b === this.btnBack) {
        this.mode = 'title';
      } else if (b === this.btnShop) {
        this.screens.switchTo('shop', 'menu');
      } else if (b === this.btnBag) {
        this.screens.switchTo('backpack', 'menu');
      } else if (b === this.btnClear) {
        // 两段式确认：点一次进入确认态（2 秒超时还原），再点一次才真正清档
        if (!this.clearArmed) {
          this.clearArmed = true;
          this.clearTimer = 2;
          this.btnClear.label = '再点一次确认';
        } else {
          this._disarmClear();
          this.game.save.clear();
          this.toast = { text: '存档已清空', t: 1.2 };
        }
      } else {
        // 难度按钮：记录所选 tag，Playing.enter() 按它重建游戏状态
        this.game.difficulty = b.tag;
        this.screens.switchTo('playing'); // 不带 resume → enter 里重建整局
      }
      return; // 一次点击只生效一个按钮
    }
  }

  render(ctx) {
    drawBackground(ctx);
    if (this.mode === 'title') {
      drawTitle(ctx, '黄金矿工', `获胜 ${this.game.save.totalWins} 次 — 点击「开始游戏」进入矿场`);
      drawHint(ctx, hotkeyHint(), 268); // 快捷键说明（由 SHOP_ITEMS.key 生成）
    } else {
      drawTitle(ctx, '黄金矿工', '选择难度开始游戏');
      // 每个难度按钮下方显示该难度的最近战绩（来自存档）
      drawDifficultyRecords(
        ctx,
        this.diffButtons.map((b) => ({
          x: b.x + b.w / 2,
          y: b.y + b.h + 18,
          text: recordText(this.game.save.getRecord(b.tag)),
        }))
      );
    }
    drawButtons(ctx, this.buttons);
    drawToast(ctx, this.toast);
  }
}

/**
 * 游戏进行界面。持有 game（共享状态：矿工/实体/关卡）。
 * 界面与游戏状态分离：切回主菜单再开局时，enter() 按所选难度重建状态；
 * 从商店/背包返回时带 { resume: true }，不重置接着玩。
 */
export class PlayingScreen {
  constructor(game, screens) {
    this.game = game;
    this.screens = screens;
    this.popups = []; // 飘字效果
    this.toast = { text: '', t: 0 }; // 快捷键使用结果提示
    this.menuBtn = makeButton(CANVAS.width - 150, 44, 134, 36, '返回主菜单');
    this.shopBtn = makeButton(CANVAS.width - 220, 44, 60, 36, '商店');
    this.bagBtn = makeButton(CANVAS.width - 292, 44, 60, 36, '背包');
    this.btnRestart = makeButton(300, 372, 200, 56, '再来一局'); // 仅结束画面显示
    this._saved = false; // 本局结果是否已写入存档
    this._loading = null; // 资源加载占位阶段（非阻塞）：非空时只画 Loading
    this._loadTime = 0; // Loading 动画计时
    this._wireMiner();
  }

  // 把"结算入账 + 继续判定"注入矿工状态机（矿工不依赖关卡逻辑）。
  // 回调里读 this.game.level 而不是捕获变量：enter() 每次换新 Level 后自动指向新关卡。
  _wireMiner() {
    const { miner } = this.game;
    miner.onCollect = (e) => {
      e.dead = true;
      const gain = Math.round(e.value * this.game.buffs.getMul('score')); // 生财药水
      this.game.level.addScore(gain);
      this.popups.push({ text: `+${gain}`, x: miner.x, y: miner.y - 30, t: 0 });
    };
    miner.checkContinue = () => this.game.level.checkContinue();
    miner.onCycleDone = () => this.game.buffs.cycleDone(); // 每次完整抓钩循环：buff 次数 -1
    miner.getRetractMul = () => this.game.buffs.getMul('retract'); // 收回时读力量药水倍率
  }

  /** 开局/重开：按 game.difficulty（主菜单所选 tag）重建一整套游戏状态 */
  enter(params = {}) {
    if (params.resume) return; // 从商店/背包返回：不重置，接着玩
    this._loading = null;
    // 资源未就绪 → 先进 loading 阶段（非阻塞：rAF 照跑，只画 Loading 动画），
    // 就绪当帧 _begin() 重建本局，首帧即贴图版，避免矢量占位闪烁。
    if (!assetsReady()) {
      this._loading = preloadAssets();
      this._loadTime = 0;
      return;
    }
    this._begin();
  }

  /** 实际开局：重建 miner/实体/关卡/飘字（资源就绪后才调用） */
  _begin() {
    this.game.buffs.clear(); // 新开一局：buff 不带到下一局（运行时态，不存档）
    this.game.miner.reset();
    this.game.entities = spawnLevel(this.game.difficulty);
    this.game.level = new Level({ tag: this.game.difficulty });
    this.popups = [];
    this.toast = { text: '', t: 0 };
    this._saved = false;
  }

  exit() {}

  update(dt, events) {
    // 资源加载占位阶段：等就绪，其余逻辑全停（倒计时从 _begin 起算，不会偷扣）
    if (this._loading) {
      this._loadTime += dt;
      if (assetsReady()) {
        this._loading = null;
        this._begin();
      }
      return;
    }
    const { miner, level } = this.game;

    // 按钮优先于玩法输入：点到按钮不算发射（游戏内打开商店/背包会暂停本界面更新）
    for (const ev of events) {
      if (ev.x === undefined) continue;
      if (level.finished && hitTest(this.btnRestart, ev.x, ev.y)) {
        this.enter(); // 再来一局：无参 enter = 重建整局（当前难度不变）
        return;
      }
      if (hitTest(this.menuBtn, ev.x, ev.y)) {
        this.screens.switchTo('menu');
        return;
      }
      if (hitTest(this.shopBtn, ev.x, ev.y)) {
        this.screens.switchTo('shop', 'playing');
        return;
      }
      if (hitTest(this.bagBtn, ev.x, ev.y)) {
        this.screens.switchTo('backpack', 'playing');
        return;
      }
    }

    if (level.finished) return; // 关卡结束，冻结游戏，结果由 render 显示

    // 道具快捷键（1/2/3）：与背包「使用」按钮同一接口，绑定来自 SHOP_ITEMS.key
    for (const ev of events) {
      if (ev.type !== 'use') continue;
      const ent = Object.entries(SHOP_ITEMS).find(([, d]) => d.key === ev.key);
      if (!ent) continue; // 没有绑定该键的道具
      const res = useItem(ent[0], { game: this.game, popups: this.popups, buffs: this.game.buffs });
      this.toast = { text: res.message, t: 1.2 };
    }

    miner.tick(dt, events);
    this._checkGrabs();
    level.update(dt);

    // 本局刚结束（过关/超时）→ 写一次存档
    if (level.finished && !this._saved) {
      this._saved = true;
      this.game.save.finishLevel({
        tag: level.tag,
        result: level.result,
        score: level.score,
        timeUsed: level.elapsed,
      });
    }

    // 飘字动画
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < THEME.popup.life);

    // 快捷键使用提示倒计时
    if (this.toast.t > 0) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast.text = '';
    }
  }

  // 碰撞检测：EXTEND 状态下，钩尖碰到实体 → 抓住
  _checkGrabs() {
    const { miner, entities } = this.game;
    if (miner.state !== STATES.EXTEND) return;
    const tip = miner.hookTip();
    for (const e of entities) {
      if (e.dead || e.caught) continue;
      const dx = e.x - tip.x;
      const dy = e.y - tip.y;
      const reach = e.r + MINER.hookRadius;
      if (dx * dx + dy * dy < reach * reach) {
        miner.grab(e);
        break; // 一次只抓一个
      }
    }
  }

  render(ctx) {
    if (this._loading) {
      drawLoading(ctx, this._loading, this._loadTime);
      return;
    }
    const { level } = this.game;
    drawScene(ctx, this.game);
    drawHud(ctx, this.game);
    drawPopups(ctx, this.popups);
    drawToast(ctx, this.toast);
    if (level.finished) drawResult(ctx, level);
    // 最上层：结束后也能点（结束画面多加「再来一局」）
    const buttons = level.finished
      ? [this.btnRestart, this.bagBtn, this.shopBtn, this.menuBtn]
      : [this.bagBtn, this.shopBtn, this.menuBtn];
    drawButtons(ctx, buttons);
  }
}

/**
 * 商店：商品格子 + 购买按钮 + 金币余额；从主菜单或游戏内进入。
 * 与背包复用同一套格子 UI；游戏内打开时本局暂停（Playing 不再 update）。
 */
export class ShopScreen {
  constructor(game, screens) {
    this.game = game;
    this.screens = screens;
    this.from = 'menu'; // 从哪个界面进来，返回时回去
    this.toast = { text: '', t: 0 }; // 购买结果提示
    this.btnBack = makeButton(CANVAS.width - 150, 44, 134, 36, '返回');
    this.btnBag = makeButton(CANVAS.width - 292, 44, 60, 36, '背包'); // 直接切到背包界面
    this.cards = shopCards(game.shop.items); // 商品表固定，建一次即可
  }

  enter(from = 'menu') {
    this.from = from;
    this.toast = { text: '', t: 0 };
  }

  exit() {}

  update(dt, events) {
    // 提示条倒计时
    if (this.toast.t > 0) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast.text = '';
    }

    for (const ev of events) {
      if (ev.x === undefined) continue;
      if (hitTest(this.btnBack, ev.x, ev.y)) return backTo(this.screens, this.from);
      if (hitTest(this.btnBag, ev.x, ev.y)) {
        this.screens.switchTo('backpack', this.from); // 保留原始来源
        return;
      }
      for (let i = 0; i < this.cards.length; i++) {
        const buy = this.cards[i].buy;
        if (hitTest(buy, ev.x, ev.y)) {
          const res = this.game.shop.buy(this.game.shop.items[i].id);
          this.toast = {
            text: res.ok ? `已购买 ${res.item.label}` : '金币不足',
            t: 1.2,
          };
          return;
        }
      }
    }
  }

  render(ctx) {
    drawBackground(ctx);
    drawTitle(ctx, '商店', `金币 ${this.game.save.coins}`);
    drawItemGrid(ctx, this.cards);
    drawToast(ctx, this.toast);
    drawButtons(ctx, [this.btnBag, this.btnBack]);
  }
}

/** 背包：打开时遍历展示持有道具（图标 + 名字 + 右下角数量角标）；游戏内打开时每格带「使用」按钮 */
export class BackpackScreen {
  constructor(game, screens) {
    this.game = game;
    this.screens = screens;
    this.from = 'menu';
    this.toast = { text: '', t: 0 }; // 使用结果提示
    this.btnBack = makeButton(CANVAS.width - 150, 44, 134, 36, '返回');
    this.btnShop = makeButton(CANVAS.width - 292, 44, 60, 36, '商店'); // 直接切到商店
    this.cards = [];
  }

  enter(from = 'menu') {
    this.from = from;
    this.toast = { text: '', t: 0 };
    // 每次打开重新遍历（购买/使用后数量会变）。
    // 只有游戏内打开才带「使用」按钮：从主菜单打开只可查看（菜单里用掉的 buff 会在新局清空，白浪费）
    this.cards = bagCards(this.game.backpack.list(), this.from === 'playing');
  }

  exit() {}

  update(dt, events) {
    // 使用/失败提示倒计时
    if (this.toast.t > 0) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast.text = '';
    }
    for (const ev of events) {
      if (ev.x === undefined) continue;
      if (hitTest(this.btnBack, ev.x, ev.y)) return backTo(this.screens, this.from);
      if (hitTest(this.btnShop, ev.x, ev.y)) {
        this.screens.switchTo('shop', this.from); // 保留原始来源
        return;
      }
      for (const c of this.cards) {
        if (c.use && hitTest(c.use, ev.x, ev.y)) {
          // 走 items.useItem 统一消耗接口；结果（生效/无效）用 toast 提示
          const res = useItem(c.id, { game: this.game, popups: null, buffs: this.game.buffs });
          this.toast = { text: res.message, t: 1.2 };
          this.cards = bagCards(this.game.backpack.list(), this.from === 'playing'); // 刷新角标
          return;
        }
      }
    }
  }

  render(ctx) {
    drawBackground(ctx);
    drawTitle(ctx, '背包', `金币 ${this.game.save.coins}`);
    if (this.cards.length === 0) drawEmptyHint(ctx, '背包是空的，去商店看看吧');
    else drawItemGrid(ctx, this.cards);
    drawToast(ctx, this.toast);
    drawButtons(ctx, [this.btnShop, this.btnBack]);
  }
}
