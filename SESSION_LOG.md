# 黄金矿工复刻 — Session 记录

> 本文件是本次开发会话的完整记录，随开发进度持续更新。
> 会话开始时间：2026-10-22

## 一、项目需求

1. 复刻经典游戏「黄金矿工」（Gold Miner）
2. 本次 session 要被完整记录 → 本文件
3. 必须能在浏览器中运行，最终成果在浏览器中打开
4. 技术栈：JavaScript + Canvas（已定）
5. 按功能模块分文件，解耦、方便扩展；不要过度工程化
6. 角色（矿工）用状态机控制，tick 驱动 + 事件响应
7. 界面与游戏内分离：先做一块（游戏内），后续扩展界面切换
8. 素材（AI 生成）与音效后置，先占位
9. 美术素材走路径/config 配置；角色外观与全局主题色集中到 config 结构体，通用可复用
10. 难度参数与生成算法可配置：目标价值/限时/scale/数量上限/生成半径范围；每类型按百分比（ratio）分配 + spawnRate ∈ (0,1)；俄罗斯轮盘赌生成，总价值达标即停
11. 数学/功能性函数写入独立文件 util/math.js，优先复用现有实现（零依赖前提下用内置 API 薄封装）
12. 难度用表配置：每行含 tag 便于命名与运行时查找，先预置 easy / normal / hard 三档
13. 生成位置与价值关联：越贵的物体越倾向生成在离角色更远的位置；物体尺寸（sizeScale）也暴露为难度参数
14. 主菜单 ↔ 游戏切换：主菜单开始游戏 → 难度选择 → 进游戏；游戏内与游戏结束后都有按钮返回主菜单
15. 存档系统：SaveManager 管理本地存档——玩家属性（金币/获胜总次数）+ 每难度最近战绩（耗时等，有则替换、无则新增）；每次启动读档，无档则新建
16. 美术资源：调研 2D AI 生成与免费素材渠道（用户自行寻找，进行中）
17. 商店系统：Shop 独立类 + 商品类（价格等属性）+ SHOP_ITEMS 配置表；背包类管理持有数量（存进存档），打开时遍历展示；先建类与 HUD 展示，商店/背包按钮后接
18. 商店/背包界面与入口按钮：主菜单与游戏内 HUD 都可进入；游戏内打开即暂停；商店购买（扣币+入包+提示），背包打开时遍历展示（图标+名字+右下角数量角标），两界面复用同一套格子 UI（商店多价格+购买按钮）
19. 展示规则：游戏内 HUD 常驻显示金币与背包内容；主菜单标题页不再直接显示，点「商店/背包」进对应界面查看
20. config 按板块拆分：config.js（画面/主题/外观）、config_gameplay.js（物理/状态）、config_level.js（难度/物体）、config_shop.js（商品表+格子 UI 参数），各模块按需导入
21. 道具效果系统（方案一）：统一消耗接口 useItem（数量校验 → 附加效果 → 有效才扣 → 返回反馈）；Buffs 持有 buff 数据结构；效果声明数据驱动——SHOP_ITEMS 每行 effect 字段（buff 型 {type,attr,mul,charges,refresh} / action 型 {type}，执行逻辑集中 items.js 的 ACTIONS）
22. buff 计时模型（用户定）：按「抓钩释放次数」消耗——每次完整抓钩循环结束（回到 SWING）charges -1，扣完失效；重复使用刷新次数（refresh 配置参数）；次数制不合适再退回时间制；使用入口 = 背包格子「使用」按钮（复用商店购买按钮 UI）
23. 道具快捷键：数字键 1/2/3 在游戏内直接使用对应道具（绑定声明在 SHOP_ITEMS.key，数据驱动）；走 useItem 统一接口，无道具/无效提示且不消耗；主菜单标题页说明行 + HUD 背包行括号展示快捷键
24. 结果画面「再来一局」：点按钮直接重开当前难度（PlayingScreen.enter 重建整局，不进主菜单）
25. 清档：主菜单「清档」按钮两段式确认（2 秒内再点一次生效，超时还原）→ SaveManager.clear() 删档 + 内存复位默认值
26. 贴图混合：全局不设 globalCompositeOperation，透明 PNG 走 Canvas 默认 source-over（alpha 自动混合、drawImage 前不铺底色）；开 imageSmoothingQuality='high' 改善大图缩放边缘
27. 钩子贴图旋转：绕钩尖旋转绳角度，钩尖轨道仍是以矿工为中心的圆周；矢量占位同规则
28. 关闭屏幕调试信息（左下角 state/绳长/角度）；Console 状态转移日志保留（开发期有用）
29. 钩子朝向修正：钩子尖端（图内 +Y 方向）必须始终与绳子朝向一致，连接端（−Y）朝向矿工——rotate(−miner.angle)（canvas 顺时针为负角）
30. 抓取物贴图接入：OBJ_TYPES 每行 sprite 声明 assets/ 文件名（与矿工/钩子同思路）；绘制走 drawEntity 通用贴图分支，多类型可复用同一张图（imgCache 按路径缓存，只加载一次）；加载失败回退矢量占位
31. 资源预载 barrier（非阻塞）：启动即预载全部贴图（数据驱动收集 MINER_LOOK/OBJ_TYPES/SHOP_ITEMS 路径）；进游戏未就绪则 PlayingScreen 显示 Loading 占位动画（纯矢量），就绪后重建本局；onerror 放行回退矢量占位 + 10s 超时保险，永不卡死；再来一局/商店返回不重载
32. 公网部署：GitHub Pages 静态托管，任何人有链接即可游玩；SESSION_LOG.md 一并上传公开；部署前无需代码改动（相对路径 + 纯静态，存档仍在玩家本地浏览器）

## 二、可行性分析结论（2026-10-22）

**结论：完全可行。JS + Canvas 是复刻黄金矿工最合适的技术栈之一。**

### 2.1 技术匹配度

| 游戏机制 | Canvas 实现方式 | 难度 |
|---|---|---|
| 钩子左右摆动 | 角度随时间正弦振荡，`ctx.rotate` 绘制 | 低 |
| 钩子发射/伸长 | 沿固定角度直线运动，逐帧画绳线 | 低 |
| 抓取与回拉 | 圆形碰撞检测 + 钩子吸附 + 按重量减速 | 中 |
| 金块/钻石/石头 | 矢量绘制（圆+高光、菱形、多边形），零外部图片 | 低 |
| 关卡/倒计时/分数 | requestAnimationFrame 游戏循环 + 纯逻辑 | 低 |
| 商店系统（炸药/力量） | UI 状态机 | 低-中 |
| 爆炸/粒子特效 | 简单粒子数组 | 低 |

无需 WebGL、无需游戏引擎、无需构建工具。

### 2.2 风险点

1. **手感调优**：回拉速度曲线、钩子速度、关卡目标分数需要试玩反复调
2. 音效需要外部资源文件（可选，先做无声版）

## 三、开发环境与插件（2026-10-22 已确认）

- ✅ 本机已装 **Live Server**（ritwickdey.liveserver）→ 实时预览方案直接用现成的
- ✅ Node v22.11.0（开发期语法校验用）
- ✅ Python 3.13.13（备用：可临时起静态服务器）
- 可选增强：ESLint / Prettier / Error Lens（尚未安装，按需再加）

工作流：写代码 → Ctrl+S → 浏览器自动刷新 → 看效果。
（备选：Vite 可做到不刷新页面且保留游戏状态的热更新，引入 npm/构建工具，超出"不过度工程化"要求，暂不采用。）

## 四、Gameplay 需求（初版）

### 4.1 核心循环

摆动 → 发射 → 抓取/空钩 → 回拉 → 计分

### 4.2 规则

- 每关限时（约 60 秒）+ 目标分数，达标过关进入下一关，否则 Game Over
- 操作：空格 / 鼠标点击 发射钩子（兼容方向键 ↓）

### 4.3 物体表（初版）

| 物体 | 分值 | 重量（影响回拉速度） |
|---|---|---|
| 大金块 | 高 | 重 |
| 小金块 | 中 | 中 |
| 钻石 | 最高 | 轻 |
| 大石头 | 低/0 | 很重 |
| 小石头 | 低 | 中 |
| 神秘袋 | 随机金额 | 随机 |

### 4.4 扩展位（后置）

商店（炸药/力量药水/生财药水）、爆炸特效、音效、AI 素材替换矢量图。

## 五、技术方案（2026-10-22 审核通过）

### 5.1 文件结构（ES Modules，按功能模块拆分）

```
D:\GoldMiner\
├── index.html          # 页面骨架 + canvas 挂载
├── css/style.css       # 页面样式
├── js/
│   ├── main.js         # 入口：初始化 + rAF 游戏循环 + tick 分发
│   ├── config.js       # 配置（画面板块）：画布/世界/THEME 主题/角色外观
│   ├── config_gameplay.js # 配置（玩法板块）：矿工物理/绳子/状态机
│   ├── config_level.js # 配置（关卡板块）：难度表/抓取物表
│   ├── config_shop.js  # 配置（商店板块）：商品表 + 商店/背包格子 UI 参数
│   ├── input.js        # 输入：键盘/鼠标 → 事件队列（供状态机消费）
│   ├── miner.js        # 矿工角色：状态机 + 绳子/钩子物理
│   ├── entities.js     # 抓取物（金块/钻石/石头/袋子）+ 关卡生成
│   ├── level.js        # 关卡：倒计时、计分、胜负判定
│   ├── savegame.js     # 本地存档：玩家属性（金币/胜场/背包）+ 每难度最近战绩
│   ├── backpack.js     # 背包：持有道具数量（数据存存档，遍历/增减封装）
│   ├── shop.js         # 商店：Shop + ShopItem（商品列表来自 SHOP_ITEMS 表，购买=扣币+入包）
│   ├── buffs.js        # BuffManager：道具 buff 数据结构（挂载/按抓钩次数递减/查询/清场）
│   ├── items.js        # 道具效果：统一消耗接口 useItem + action 型执行逻辑（炸药）
│   ├── screens.js      # 界面管理：ScreenManager + MainMenu/Playing/Shop/Backpack
│   ├── render.js       # 全部绘制（读 config 的 THEME/外观；素材到位后只填路径）
│   └── util/
│       └── math.js     # 纯函数工具：rand/randRange/randInt/clamp/norm01/lerp/pickWeighted/Halton
└── SESSION_LOG.md
```

- 各文件间只通过 `import/export` 传递明确的数据，不互相依赖渲染细节
- ES Modules 是浏览器原生能力，配合 Live Server（http://localhost）直接跑，无构建工具
- 注意：ES Modules 在 file:// 双击打开时会被浏览器拦截；日后要"双击即玩"的发布版，最后再合并成单文件

### 5.2 矿工状态机（含用户追加的 SETTLE 状态）

```
      ┌────────────┐ 输入(空格/点击)  ┌──────────┐
      │    SWING   │ ───────────────→ │  EXTEND  │
      │  摆动待发射 │                  │ 绳子放出  │
      └────────────┘                  └────┬─────┘
           ↑ 收回到位                       │ 碰到物体
      ┌────┴────────────┐          ┌───────┴──────┐
      │  RETRACT_EMPTY  │ ← 到最长  │   RETRACT    │
      │  空钩收回        │  没抓到   │   LOADED     │
      └─────────────────┘          │  负重收回     │
                                   └──────┬───────┘
                                          ↓ 收到矿工处
                                   ┌──────┴───────┐
                                   │    SETTLE    │
                                   │ 结算：入账 +  │
                                   │ 播效果 + 判定 │
                                   │ 能否继续      │
                                   └──────┬───────┘
                                          ↓ 'continue' → SWING
                                          ↓ 'clear'/'over' → 关卡结束
```

- 每个状态实现 `enter() / update(dt) / exit()`（exit 暂无需求，接口预留）
- 全局 tick：main.js 每帧调 `miner.tick(dt, events)`，按当前状态分发
- **输入用事件队列**：input.js 捕获按键/点击压入队列，状态在 update 里消费
- 物理归位：摆角在 SWING 的 update 里算；负重回拉速度 = 基础速度 ÷ 重量（保底 40 px/s）
- **SETTLE 职责**：入账（onCollect 回调）+ 飘字效果 + 结束时调 checkContinue 判定 continue/clear/over
- 状态切换全部走显式 `setState()`，控制台打印转移日志便于调试
- 矿工通过回调钩子（onCollect / checkContinue）与关卡逻辑解耦，由 Playing 界面注入

### 5.3 界面管理（screens.js）

- `ScreenManager`：维护当前 screen，`switchTo(name, params)`（params 传给新 screen 的 enter）；每帧把 tick/render/输入转发给当前 screen
- Screen 统一接口：`{ enter(params), exit(), update(dt, events), render(ctx) }`
- 已实现 `MainMenu`（标题页 → 难度选择页，难度按钮由难度表自动生成）、`Playing`（HUD + 商店/背包/返回按钮）、`Shop` / `Backpack`（共用格子 UI）；`LevelResult` 后续按同一接口插入
- 共享状态 `game`（miner/entities/level/difficulty）放在 main.js；界面切换后状态保留，Playing.enter() 按所选难度重建
- 按钮交互：点击事件携带画布坐标（input.js），界面层做命中检测；按钮点击不当作玩法发射输入

### 5.4 每帧更新顺序

输入事件队列 → screen.update → miner.tick → 碰撞检测 → 关卡更新 → 绘制

### 5.5 配置与数据驱动（2026-10-23 第九轮：按板块拆分为四个 config 文件）

配置不再集中一个文件，按板块拆分、各模块按需导入：

| 文件 | 内容 | 用途 |
|---|---|---|
| `config.js` | `ASSET` 素材根目录、`CANVAS` 画布、`WORLD` 地面线、`THEME`（天空/地面/HUD/飘字/结果/按钮 ui/标题 menu/调试配色）、`MINER_LOOK` 角色外观通用 schema | 画面/主题/外观 |
| `config_gameplay.js` | `MINER`/`ROPE` 物理参数、`SETTLE_TIME`、`STATES` 状态名 | 玩法手感 |
| `config_level.js` | `DIFFICULTIES` 难度表（目标价值/限时/scale/数量上限/生成半径/spacingGap/valueDistanceBias/sizeScale；tag 命名 + label 显示名）+ `ACTIVE_DIFFICULTY` + `getDifficulty(tag)`；`OBJ_TYPES` 抓取物表（分值/重量/半径/ratio/spawnRate/sprite/占位色） | 难度与生成 |
| `config_shop.js` | `SHOP_ITEMS` 商品表（label/desc/price/color/sprite/**effect** 效果声明：buff 型 {attr,mul,charges,refresh} 或 action 型）+ `SHOP_UI` 格子布局参数（网格/图标/角标/字体/共用按钮：商店=购买、背包=使用） | 商店/背包/道具效果 |

贴图约定：`src` 为空 = 矢量占位；填了路径且图片加载成功 → render.js 自动切贴图，加载失败/未完成时回退矢量，素材可逐步替换。

## 六、决策记录

| 时间 | 决策 | 状态 |
|---|---|---|
| 2026-10-22 | 采用 JS + Canvas，零外部依赖 | 已定 |
| 2026-10-22 | ES Modules + Live Server（本机已装 Live Server） | ✅ 已定 |
| 2026-10-22 | 状态机五状态：SWING / EXTEND / RETRACT_EMPTY / RETRACT_LOADED / SETTLE | ✅ 已定 |
| 2026-10-22 | SETTLE 负责结算入账 + 效果 + 继续条件判定（用户追加） | ✅ 已定 |
| 2026-10-22 | 界面用 ScreenManager 抽象，先做 Playing 板块 | ✅ 已定 |
| 2026-10-22 | 素材/音效后置，先用 Canvas 矢量绘制占位 | 已定 |
| 2026-10-22 | 美术配置集中到 config.js：THEME（全局配色）+ 角色外观通用 schema（MINER_LOOK）+ 每类物体 sprite 路径位 | ✅ 已定 |
| 2026-10-22 | 难度参数集中 DIFFICULTY；生成算法 = ratio 加权抽取 + spawnRate 俄罗斯轮盘赌，总价值 ≥ 目标×scale 即停；位置按距矿工半径 clamp；工具函数入 util/math.js（零依赖，内置 Math 薄封装） | ✅ 已定 |
| 2026-10-22 | 生成分散：Halton 低差异序列候选 + 间距不足（< rA+rB+spacingGap）直接舍弃重生成（用户偏好：拒绝式 > 偏移式） | ✅ 已定 |
| 2026-10-22 | 难度改为表结构：每行含 tag（命名 + 运行时查找），预置 easy/normal/hard；ACTIVE_DIFFICULTY 指定当前启用 | ✅ 已定 |
| 2026-10-22 | 价值-距离关联：半径采样 u 向价值归一值 lerp（valueDistanceBias ∈ [0,1] 控制强度，0 = 纯 Halton，1 = 半径全由价值决定）；物体尺寸缩放 sizeScale 直接乘碰撞/显示半径 | ✅ 已定 |
| 2026-10-22 | 界面切换：启动进 MainMenu；难度按钮由 DIFFICULTIES 表生成（加难度行即加按钮）；game.difficulty 传 tag，Playing.enter() 重建 miner/entities/level；点击事件带画布坐标供按钮命中检测 | ✅ 已定 |
| 2026-10-23 | 存档用 localStorage + JSON（key `goldminer.save.v1`）：启动读档，无档/损坏自动新建；读写 try/catch，存储不可用降级为仅内存 | ✅ 已定 |
| 2026-10-23 | 存档数据：coins（每局结算按得分入账，胜负都保留）+ totalWins（过关 +1）+ records[tag] 最近战绩（有则替换无则新增）；金币/胜场显示在标题页，战绩显示在难度选择页 | ✅ 已定 |
| 2026-10-23 | 商店实例化选"页面打开即建"（eager）：ES 静态导入本就全量加载代码，实例化只是读配置表建对象（开销≈0）；HUD 每帧要渲染背包，背包/商店必须常驻；真正重的是贴图，已由 render 的懒加载管线（getImage 首绘才加载）覆盖。懒加载只对构造成本高的对象（如整张 sprite sheet 预载）有意义，且会带来 null 判断与生命周期复杂度 | ✅ 已定 |
| 2026-10-23 | 商店/背包数据流：SHOP_ITEMS 配置表 → ShopItem（价格等）→ Shop.buy = save.spendCoins + backpack.add；背包数量持久化进存档（backpack: {id: 数量}，旧档缺字段自动补齐）；HUD 第二行金币 + 背包遍历展示 | ✅ 已定 |
| 2026-10-23 | 商店/背包做成 ScreenManager 界面：游戏内打开即暂停（只 update 当前 screen，倒计时不动）；switchTo(name, params) 携带来源，返回游戏带 {resume:true} 不重置本局；商店↔背包可互跳并保留原始来源 | ✅ 已定 |
| 2026-10-23 | 商店/背包复用一套格子 UI：SHOP_UI 布局参数（config_shop.js）+ render.drawItemGrid（图标+名字+右下角数量角标，商店多价格+购买按钮）；购买结果用中央 toast 提示；主菜单标题页不显示金币，只在商店/背包界面显示 | ✅ 已定 |
| 2026-10-23 | config 按板块拆成 4 个文件（画面/玩法/关卡/商店），各模块按需导入；商店/背包依赖自己的 config_shop.js | ✅ 已定 |
| 2026-10-23 | 道具效果选方案一：统一消耗接口 useItem + BuffManager 持有数据结构；效果参数数据驱动——SHOP_ITEMS 每行 effect 字段（buff {attr,mul,charges,refresh} / action）；action 逻辑集中 items.js 的 ACTIONS；使用入口 = 背包格子「使用」按钮（与商店「购买」共用 SHOP_UI.btn） | ✅ 已定 |
| 2026-10-23 | 使用效果时序：useItem 先附加效果（buff 挂载 / action 立即执行，炸药转空钩收回），状态机按新状态继续 enter/update，执行过程读 buff（getRetractMul / scoreMul 注入）；action 无效（没勾住）不消耗数量 | ✅ 已定 |
| 2026-10-23 | buff 计时按抓钩释放次数（用户定，替代时间制）：每次完整抓钩循环结束（SWING enter，新增 onCycleDone 钩子）charges -1，扣完失效；重复使用刷新次数（refresh 参数，否则同属性相乘叠加）；次数制体验不佳可退回 ttl 时间制（buffs.js 注释留有方案） | ✅ 已定 |
| 2026-10-23 | 道具快捷键：数字键 1/2/3 固定绑定商品表顺序（SHOP_ITEMS.key 声明，数据驱动）；input.js 只报 use 事件不感知道具；PlayingScreen 匹配 key → useItem（与背包「使用」同一接口，toast 反馈）；主菜单说明行 + HUD 背包行括号显示快捷键；背包/商店界面内快捷键不生效（键盘事件被跳过） | ✅ 已定 |
| 2026-10-23 | 再来一局 = 结束画面上按钮直接调 PlayingScreen.enter()（无参 → 重建整局，当前难度不变，buff 清空）；存档写入逻辑不变 | ✅ 已定 |
| 2026-10-23 | 清档交互：主菜单「清档」按钮两段式确认（点一次变「再点一次确认」、2 秒超时还原），避免原生 confirm 弹窗、保持 canvas 内 UI 一致；SaveManager.clear() 删 localStorage + 内存复位默认值（backpack/records 重建空对象避免与 DEFAULTS 共享引用） | ✅ 已定 |
| 2026-10-24 | 贴图混合核查：全项目无 globalCompositeOperation，绘制全部走 Canvas 默认 source-over，透明 PNG alpha 自动混合（唯一 globalAlpha 用在飘字且用完复位）；只补 imageSmoothingQuality='high'（main.js 全局一次）改善大图缩放边缘 | ✅ 已定 |
| 2026-10-24 | 钩子贴图旋转：绕钩尖旋转 miner.angle（绳方向）——旋转枢轴在钩尖，钩尖本身在以矿工（绳起点）为中心的圆周上，轨道不变；矢量十字占位同样旋转 | ✅ 已定 |
| 2026-10-24 | 关闭屏幕调试信息：PlayingScreen 不再调 drawDebug；render.js 保留函数备调试复用；Console 状态转移日志保留（正常游玩不可见） | ✅ 已定 |
| 2026-10-24 | 钩子旋转方向修正：canvas rotate 顺时针为负，rotate(+angle) 把钩子图 +Y 尖端映到绳方向的镜像 (−sin a, cos a)，尖端指向错误；改为 rotate(−miner.angle)，图内 +Y 与绳方向 (sin a, cos a) 一致、−Y 连接端朝向矿工 | ✅ 已定 |
| 2026-10-24 | 抓取物贴图接入：OBJ_TYPES 每行 sprite 声明路径（配置驱动，与矿工/钩子同思路）；绘制走 drawEntity 通用贴图分支（任何类型声明即生效），imgCache 按路径缓存 → 多类型可复用同一张图只加载一次；加载失败/未完成回退矢量占位 | ✅ 已定 |
| 2026-10-24 | 资源预载方案 A：Loading 阶段内嵌 PlayingScreen（非阻塞，rAF 照跑，只阻塞「进游戏」不阻塞玩家）；启动即预载（菜单浏览时间 = 加载时间）；路径数据驱动收集（三处 config 自动遍历去重）；onerror 放行回退矢量占位 + 10s 超时兜底 | ✅ 已定 |
| 2026-10-24 | 部署路线：GitHub Pages 静态托管（用户自建仓库，SESSION_LOG.md 一并公开上传）；部署前零代码改动（纯静态 + 相对路径）；存档留在玩家本地浏览器，排行榜/云同步属未来后端需求 | ✅ 已定 |

## 七、开发进度

### 7.1 第一轮：框架（已完成）

- 全部 10 个文件创建，Node 语法校验通过
- 入口 main.js：游戏共享状态 + ScreenManager + rAF 循环（dt 钳制）
- tick 管线：输入事件队列 → screen.update → miner.tick → 碰撞检测 → 关卡更新 → 绘制
- 输入 input.js：空格 / ↓ / 鼠标左键 → 'fire' 事件入队，状态机消费
- 矿工状态机：五状态全部实现，含回调钩子解耦；状态转移打印到 Console
- 最小可玩闭环：发射 → 抓取（圆碰撞）→ 负重收回（速度÷重量）→ SETTLE 结算（+分飘字）→ 判定继续/结束
- 关卡：60s 倒计时 + 600 分目标；HUD 显示分数/目标/时间；结果占位画面
- 调试层：左下角实时显示 state / 绳长 / 角度

### 7.2 第二轮：美术配置整理（已完成）

- config.js 重构为分块配置：ASSET / 玩法参数 / OBJ_TYPES / THEME / MINER_LOOK
- 新增 THEME：天空渐变、地面、HUD、飘字、结果、调试的全部颜色/字体
- 新增 MINER_LOOK（角色外观通用 schema）：body 贴图+锚点、矢量占位、绳子颜色/粗细、钩子贴图+占位色；可直接复制套用到新角色
- OBJ_TYPES 每类物体加 `sprite: ''` 路径位
- render.js 全部改为读配置；实现图片缓存 + 贴图就绪检测：填路径自动切贴图，未加载完回退矢量占位
- entities.js 透传 sprite 字段；screens.js 飘字生命期改读 THEME.popup.life
- Node 语法校验通过

### 7.3 第三轮：bug 修复（2026-10-22）

- **现象**：钩子放长到最远、转 RETRACT_EMPTY 时崩溃：`Cannot read properties of undefined (reading 'call')`（miner.js setState）
- **原因**：RETRACT_EMPTY 状态漏写 `enter()`；setState 里 `this._states[next].enter.call(...)` 对 undefined 调用
- **修复**：补上 `enter() {}`（用户自己修复），并把约定写进代码注释：**每个状态必须实现 enter 和 update，没有逻辑就写空函数**
- 经验：状态机各状态接口契约要显式声明，缺实现时 fail-fast 报错是预期行为

### 7.4 第四轮：难度配置与随机生成（已完成）

- 新增 `DIFFICULTY` 配置块：targetValue / time / scale / maxCount / minSpawnRadius / maxSpawnRadius
- OBJ_TYPES 每类型新增 `ratio`（抽取权重）+ `spawnRate`（轮盘赌接受率 ∈ (0,1)）
- 生成算法（entities.js spawnLevel）：ratio 加权抽类型 → 掷随机数 vs spawnRate（Russian Roulette）→ 生成位置距矿工 [minR, maxR] 下方扇形 + clamp 进安全区 → 累计价值 ≥ targetValue × scale 停止；guard 5000 次 + maxCount 双保险
- 新增 js/util/math.js：rand / randRange / randInt / clamp / lerp / pickWeighted（零依赖，内置 Math 薄封装）；miner.js 改用它
- 新增 WORLD.groundY，地面线从 THEME（纯美术）拆出，生成区域与绘制共用
- 移除 TEST_LEVEL / TEST_SPAWNS 测试数据；Level 默认读 DIFFICULTY，未来多关卡可逐关传值
- Node 语法校验通过（9 个文件）

### 7.5 第五轮：生成分散 + 难度表（已完成）

- **修复生成偏侧 bug**：原角度范围 [15°, 165°] 的 sin 恒为正 → x 恒大于矿工 x，物体只能落在单侧半平面；改为正下方 ±75° 对称扇形
- **低差异采样**：util/math.js 新增 radicalInverse / halton2D（Halton 2D 低差异序列）；候选点天然分散；随机起点 seed 保证每局布局不同；面积均匀映射（对 r² 插值）
- **拒绝式间距控制**：与已生成物体距离 < rA + rB + spacingGap → 直接舍弃本次生成进入下一次（不做偏移调整，判断少）；DIFFICULTIES 每行新增 spacingGap
- **难度表**：DIFFICULTY 重构为 DIFFICULTIES 表（数组，每行含 tag），预置 easy / normal / hard 三档；`getDifficulty(tag)` 运行时查找（找不到回退首行）；`ACTIVE_DIFFICULTY = 'normal'` 指定当前启用
- Level 支持 `cfg.tag` 按 tag 查表；HUD 显示当前难度 tag；[spawn] 日志带难度名
- Node 语法校验通过（9 个文件）

### 7.6 第六轮：难度算法优化 + 主菜单/游戏切换（已完成）

- **价值-距离关联**：util/math.js 新增 `norm01`；entities.js 按物体价值归一值 lerp 半径采样 u（`valueDistanceBias` 越大越贵的物体越偏外圈），0 = 纯 Halton 不关联；价值范围由 OBJ_TYPES 自动算出
- **尺寸难度参数**：DIFFICULTIES 每行新增 `sizeScale`（easy 1.15 / normal 1.0 / hard 0.85），乘到 Entity 碰撞/显示半径，越小越难勾中；间距判断也用缩放后半径
- **主菜单**：MainMenuScreen 两页（标题页 → 难度选择页），难度按钮由 DIFFICULTIES 表 + `label` 自动生成，加难度行即加按钮；THEME 新增 ui（按钮）/menu（标题）配色块
- **界面切换链路**：启动进 menu → 选难度写 `game.difficulty` → Playing.enter() 按 tag 重建 miner（新增 `reset()`）/ entities（spawnLevel 支持传 tag）/ level；游戏内右上角「返回主菜单」按钮（点击不算发射），结果画面之上同样可点返回
- **输入坐标**：input.js 改为绑定 canvas 并记录点击画布坐标（x/y），界面层做按钮命中检测；键盘 fire 无坐标继续走玩法输入
- Node 语法校验通过（9 个文件）

### 7.7 第七轮：存档系统（已完成）

- 新增 js/savegame.js：SaveManager 封装 localStorage（key `goldminer.save.v1`，JSON）；启动读档，无档/损坏自动新建默认档；读写 try/catch，隐私模式等存储不可用时降级为仅内存不崩
- 数据模型：coins（每局结算按得分入账，胜负都保留挖到的分数）/ totalWins（过关 +1）/ records[难度tag]（最近一局 tag/result/score/timeUsed，有则替换、无则新增）
- Level 新增 elapsed 计时；PlayingScreen 在关卡结束当帧调 save.finishLevel（每局只写一次）
- 主菜单标题页显示金币/胜场；难度选择页每个按钮下方显示该难度最近战绩（暂无记录 / 胜·用时·分数）
- Node 语法校验通过（10 个文件）

### 7.8 第八轮：商店/商品/背包类（已完成）

- config.js 新增 SHOP_ITEMS 商品表（炸药/力量药水/生财药水，label/desc/price/color/sprite）；THEME.hud 新增 subFont/subLineY 第二行
- 新增 js/shop.js：ShopItem（价格等属性）+ Shop（items 由配置表生成；buy = spendCoins + 入包，返回 ok/reason）
- 新增 js/backpack.js：Backpack 封装持有数量（count/add/list/isEmpty），数据持久化在存档
- savegame.js 扩展：backpack: {id: 数量} 入档；旧档缺字段用 DEFAULTS 自动补齐；新增 spendCoins（不够返回 false 不动账）/addItem/getItemCount
- 实例化方式选定"页面打开即建"（eager，理由见决策记录）；main.js 按 save → backpack → shop 依赖顺序创建
- HUD 第二行：金币 + 背包道具（backpack.list() 遍历展示，空显示"背包：空"）；商店/背包按钮按需求后接
- Node 语法校验通过（12 个文件）

### 7.9 第九轮：商店/背包界面 + config 拆分（已完成）

- **config 按板块拆分**（原 config.js 一拆四）：[config.js](js/config.js)（画面：ASSET/CANVAS/WORLD/THEME/MINER_LOOK）、[config_gameplay.js](js/config_gameplay.js)（玩法：MINER/ROPE/SETTLE_TIME/STATES）、[config_level.js](js/config_level.js)（关卡：DIFFICULTIES/ACTIVE_DIFFICULTY/getDifficulty/OBJ_TYPES）、[config_shop.js](js/config_shop.js)（商店：SHOP_ITEMS + SHOP_UI 格子 UI 参数）；全部导入点按板块更新
- **商店/背包共用格子 UI**：render.js 新增 `drawItemGrid` —— 图标（贴图优先/矢量占位圆）+ 名字 + 右下角数量角标（背包），商店多价格与「购买」按钮；布局几何/字体/角标配色全部读 `SHOP_UI`，两界面同一套
- **商店界面 ShopScreen**：商品格子 + 金币余额 + 购买（Shop.buy → 扣币+入包）；成功/金币不足用中央 toast 提示；右上「背包」可互跳
- **背包界面 BackpackScreen**：打开时遍历 backpack.list() 展示（图标+名字+数量角标），空背包显示提示；右上「商店」可互跳
- **入口按钮**：主菜单标题页新增「商店」「背包」；游戏内 HUD 新增「背包」「商店」（返回主菜单左侧）
- **暂停/恢复**：ScreenManager.switchTo 支持传 params；从游戏内打开商店/背包即暂停（Playing 不再 update），返回带 { resume: true } 不重置本局；从主菜单进入则原路返回
- **展示规则**：主菜单标题页不再直接显示金币（改显示胜场），点「商店/背包」进界面查看；游戏内 HUD 仍常驻金币 + 背包内容
- Node 语法校验通过（15 个文件）

### 7.10 第十轮：道具效果系统（已完成）

- **统一消耗接口**：新增 [items.js](js/items.js) `useItem(id, ctx)` —— 数量校验 → 附加效果 → 有效才扣 1 个（写存档）→ 返回 { ok, message } 反馈；所有使用入口都走它
- **数据驱动效果声明**：[config_shop.js](js/config_shop.js) 每件商品加 `effect` 字段——buff 型 = 纯参数 { type:'buff', attr, mul, charges, refresh }，action 型 = { type:'action' } 标记、执行逻辑注册在 items.js 的 ACTIONS（炸药）
- **Buffs 管理器**：新增 [buffs.js](js/buffs.js) —— 持有 buff 数据结构（add / cycleDone / getMul / clear）；重复使用 refresh=true 刷新次数，否则同属性相乘叠加
- **计时模型（用户定：按抓钩释放次数）**：每次完整抓钩循环结束（矿工回到 SWING，新增 onCycleDone 钩子 → buffs.cycleDone()）charges -1，扣完失效；力量药水 = 接下来 10 次抓钩收回 ×2，生财药水 charges=null 持续到本局结束；新局 Playing.enter() 先 buffs.clear()（运行时态不存档）；商店/背包暂停天然冻结（循环不完成不扣）；若次数制体验不佳可退回 ttl 时间制（buffs.js 注释留有方案）
- **执行过程读 buff**：miner 注入 getRetractMul（负重收回速度 = base÷weight × 倍率，保底 40 后乘）；onCollect 结算分乘 scoreMul（四舍五入）
- **使用入口**：背包格子复用商店「购买」按钮位（SHOP_UI.buyBtn 改名 btn 共用）加「使用」按钮，点击 → useItem → toast 提示；**从主菜单打开背包只可查看**（使用按钮仅游戏内打开时出现，避免新局清空白浪费）
- **炸药行为**：仅 RETRACT_LOADED 有效——物体 dead + 💥 飘字 + 钩子转 RETRACT_EMPTY 空钩收回（miner 新增 blowCaught()）；没勾住返回 no-target 不消耗
- 力量药水 desc 同步改为「接下来 10 次抓钩收回速度翻倍」
- Node 语法校验通过（17 个文件）

### 7.11 第十一轮：快捷键 / 再来一局 / 清档（已完成）

- **道具快捷键**：[config_shop.js](js/config_shop.js) 每件商品加 `key`（1/2/3）；[input.js](js/input.js) 数字键上报 `{type:'use', key}`（只报按键不感知道具）；PlayingScreen 按 `SHOP_ITEMS.key` 匹配 → `useItem`（与背包「使用」按钮同一接口）→ 游戏内 toast 反馈；无效（没勾住/没道具）不消耗
- **快捷键展示**：主菜单标题页按钮列下加说明行「游戏内快捷键：1 炸药 · 2 力量药水 · 3 生财药水」（render 新增 drawHint，文本由 SHOP_ITEMS.key 自动生成）；HUD 背包行显示为「炸药(1)×1」格式
- **再来一局**：结束画面（过关/时间到）中央出现「再来一局」按钮 → `PlayingScreen.enter()` 无参重建整局（当前难度不变、buff 清空、倒计时/分数/物体全重置）；顶栏三个按钮仍可点
- **清档**：主菜单按钮列加「清档」（两段式确认：点一次变「再点一次确认」、2 秒超时还原；保持 canvas 内 UI，不用原生 confirm）；确认后 `SaveManager.clear()` 删 localStorage + 内存复位默认值，标题页胜场/金币/战绩立即归零
- 主菜单标题页按钮列调整为 4 个（开始游戏/商店/背包/清档，间距 68）
- Node 语法校验通过（17 个文件）

### 7.12 第十二轮：贴图混合 / 钩子旋转 / 关调试（已完成）

- **贴图混合核查**：全局无 globalCompositeOperation，所有绘制走 Canvas 默认 source-over —— 透明 PNG 的 alpha 通道自动与背景混合，drawImage 前不铺底色；唯一的 globalAlpha 在飘字里且用完复位为 1；[main.js](js/main.js) 全局补 `imageSmoothingQuality='high'` 改善大图（1024 级 PNG 缩到 64px/12px）的透明边缘；[render.js](js/render.js) 头部注释写明混合约定
- **钩子贴图旋转**：drawMiner 钩子分支改为 save/translate(钩尖)/rotate(miner.angle) 绘制——钩子图「顶部」始终朝向矿工（绳起始点），旋转枢轴在钩尖，钩尖位置本身就在以矿工为中心的圆周上（绳长固定 + 角度摆动），轨道不受影响；矢量十字占位同样旋转
- **关闭调试信息**：PlayingScreen.render 移除 drawDebug 调用（左下角 state/绳长/角度不再显示）；render.js 保留 drawDebug 函数备调试复用；Console 的状态转移日志保留
- 素材状态：assets/ 已放入 8 张透明 PNG，config.js 已填 miner.png / hook.png；抓取物 6 张（大小金块/钻石/大小石头/袋子）尚未填 config_level.js 的 sprite 字段，目前仍显示矢量占位
- Node 语法校验通过（17 个文件）

### 7.13 第十三轮：钩子朝向修正 + 抓取物贴图接入（已完成）

- **钩子朝向修正**：[render.js](js/render.js) drawMiner 钩子分支 `rotate(miner.angle)` → `rotate(-miner.angle)`。原因：canvas rotate(θ) 把图内 +Y 方向映到 (−sinθ, cosθ)，而绳方向是 (sin a, cos a)——θ=+a 得到的是它的镜像（钩尖朝反方向摆），θ=−a 才对齐。现在钩子尖端始终与绳子朝向一致（指向矿工外侧），连接端朝向矿工；旋转枢轴仍在钩尖、轨道不受影响
- **抓取物贴图接入**：[config_level.js](js/config_level.js) OBJ_TYPES 六行 sprite 填 assets/ 文件名——小金块 small_gold.png / 大金块 large_gold.png / 钻石 diamond.png / 小石头 small_stone.png / 大石头 large_stone.png / 神秘袋 mystery_bag.png
- **复用机制**：绘制全部走 drawEntity 的通用贴图分支（render.js 第二轮已就位）——任何类型在配置里声明 sprite 即自动切贴图，无需改绘制代码；imgCache 按路径缓存，多类型共用同一张图只加载一次；贴图未加载完成/文件缺失时该实体回退矢量占位，其余不受影响
- Node 语法校验通过（17 个文件）

### 7.14 第十四轮：资源预载 Loading barrier（已完成）

- **预载 API**：[render.js](js/render.js) 新增 `preloadAssets()`（幂等，返回 {done, failed, total, ready}）——数据驱动收集全部贴图路径（MINER_LOOK body/hook + OBJ_TYPES + SHOP_ITEMS，去重），每张图 onload/onerror 计数，全部结束（含失败）即 ready；10s 超时保险强制放行；`assetsReady()` 查询就绪
- **启动预热**：[main.js](js/main.js) 启动即调 `preloadAssets()`——玩家在主菜单/难度页浏览期间图片已在后台加载，正常进游戏连 Loading 都看不到
- **PlayingScreen loading 阶段**：[screens.js](js/screens.js) enter() 先查 `assetsReady()`：未就绪 → 挂 `_loading` 状态，update 轮询就绪、render 只画 `drawLoading`（背景 + Loading 动画点 + n/m 进度条，纯矢量不依赖贴图）；就绪当帧 `_begin()` 重建本局（原 enter 逻辑移入 _begin），首帧即贴图版零闪烁；resume（商店/背包返回）与再来一局不经过 loading
- **失败兜底**：onerror 也计数放行 → 该图回退矢量占位（原有机制），Loading 永不卡死；10s 超时强制 ready 是极端保险（个别图晚到仍走已有回退）
- Node 语法校验通过（17 个文件）

### 7.15 运行与验证

运行：VS Code 中右键 index.html → **Open with Live Server** → 浏览器打开
验证清单：
1. 打开后先进主菜单：标题 + 「开始游戏」→ 难度选择页（简单/普通/困难 + 返回）
2. 选难度进入游戏：HUD 显示所选难度 tag；三档难度下物体大小（sizeScale）与"贵在外圈"程度（valueDistanceBias）应不同
3. 游戏内右上角「返回主菜单」可随时回主菜单（点击按钮不触发发射）；再开局状态完全重置
4. F12 打开 Console，看 `[miner] swing → extend` 等转移日志、`[spawn]` 难度日志
5. 按空格/点击 → 钩子沿当前角度发射；到最远自动空钩收回（extend → retractEmpty）
6. 对准金块发射 → 抓住后负重收回（retractLoaded），大金块明显更慢
7. 收到矿工处 → settle → +分飘字 → 回到 swing
8. 分数达标 → "过关！"；倒计时归零 → "时间到…"；两者都可点「返回主菜单」
9. 打完一局回主菜单：标题页金币/胜场已更新；难度选择页该难度下显示"胜/负 · 用时 · 分数"（没打过的难度显示"暂无记录"）
10. 刷新页面存档仍在（localStorage 持久化）；DevTools 里清掉 localStorage 再刷新 → 自动新建默认档
11. HUD 第二行显示「金币 X · 背包 空」；打一局结束后金币随分数入账；DevTools 手动把 localStorage 存档的 coins 改大再刷新 → HUD 金币跟着变
12. 主菜单标题页不再显示金币，新增「商店」「背包」按钮：商店看商品+金币、点「购买」（金币不足提示 / 成功入包并扣币），背包看到对应数量角标；两界面右上互跳、返回回原界面
13. 游戏内 HUD 右上三个按钮（背包/商店/返回主菜单）：点「商店」倒计时暂停（HUD 时间不动），购买后返回游戏接着玩不重置；点「背包」空态/列表正常；结果画面上三个按钮仍可点
14. 游戏内打开背包：持有道具的格子有「使用」按钮；点「使用」→ toast「XX 生效！」、数量角标 -1；从主菜单打开背包没有「使用」按钮（只能查看）
15. 力量药水：使用后连抓 10 次（含空钩）收回全程 ×2，第 10 次循环结束回到 SWING 后失效；效果中重复使用刷新次数不叠加；生财药水：本局所有结算分 ×1.2（50 → 60），新开一局失效
16. 炸药：勾住物体时打开背包点「使用」→ toast「已炸掉」、数量 -1，返回游戏钩子空钩收回、物体消失；没勾住时使用 → toast「没有勾住物体」且不消耗；数量 0 → 提示且不消耗
17. 主菜单标题页：按钮列 4 个（开始游戏/商店/背包/清档），开始按钮上方有「游戏内快捷键：1 炸药 · 2 力量药水 · 3 生财药水」说明行
18. 游戏内按 1/2/3：有道具 → toast「XX 生效！」/「已炸掉」且数量 -1、HUD 背包行同步（格式「炸药(1)×1」）；没勾住按 1 → 「没有勾住物体」不消耗；没有该道具 → 「没有该道具」；在背包/商店界面按数字键无反应
19. 结束画面（过关/时间到）中央出现「再来一局」：点击后本局重置、同难度重开（倒计时/分数/物体全重建），不经过主菜单；顶栏按钮仍可点
20. 主菜单点「清档」→ 按钮变「再点一次确认」→ 2 秒内再点 → toast「存档已清空」，标题页胜场归 0、金币归 0、难度页战绩变「暂无记录」；2 秒不点按钮自动还原为「清档」；刷新页面确认存档确实被删（再打一局后是新档）
21. 透明 PNG 贴图（miner.png / hook.png 已接入）：贴图边缘无黑边/白边、透明区域透出背景，大图缩放后边缘平滑（imageSmoothingQuality high）
22. 发射/摆动钩子：hook.png 随绳方向旋转，钩子尖端始终与绳子朝向一致（指向矿工外侧）、连接端朝向矿工，钩尖始终在以矿工为中心的圆周上；把 hook.src 清空后矢量十字同样旋转
23. 游戏画面左下角调试信息已消失；F12 Console 的状态转移日志仍在（如需也关闭告知）
24. 场上 6 类抓取物显示对应贴图（小金块/大金块/钻石/小石头/大石头/神秘袋），尺寸随碰撞半径（显示直径 = r×2.6）
25. 复用/回退：把 OBJ_TYPES 某一行 sprite 清空 → 仅该类型回退矢量占位，其余类型与矿工/钩子贴图不受影响（imgCache 按路径缓存，同一张图多类型共用只加载一次）
26. 资源加载：硬刷新页面后立刻点「开始游戏」进游戏 → 短暂 Loading（动画点 + n/m 进度条）后进游戏，首帧即贴图版（无矢量占位闪烁）；在菜单停留几秒再进 → 直接进游戏无 Loading；删除 assets/ 某张图再刷新 → Loading 正常结束、该实体回退矢量占位、游戏可玩；再来一局与从商店/背包返回不出现 Loading

贴图接入方式（素材到位后）：把图片放进 `assets/`，在对应 config 的 `src` 填文件名即可——角色外观 [config.js](js/config.js)、抓取物 [config_level.js](js/config_level.js)、商品 [config_shop.js](js/config_shop.js)。

### 7.16 下一步（待定优先级）

- 部署上线 GitHub Pages（等用户创建仓库后：git init → commit → push → Settings 开启 Pages）
- 特效系统（方案已提交审核：A 轻量粒子数组 / B 按需动画函数 / C 序列帧贴图；审核通过后实现爆炸粒子、入账金光、过关彩带）
- 素材收尾：商品图标 3 张待生成后填 [config_shop.js](js/config_shop.js)（抓取物 6 张已于第十三轮接入）
- 手感调优（先试玩，再调 config_gameplay.js / config_level.js，重点：三档难度下 valueDistanceBias/sizeScale 的实际感受）
- 道具相关优化：buff 剩余次数显示在 HUD/背包（力量药水还剩几次）；次数制若体验不佳可退回 ttl 时间制（buffs.js 已留方案）
- 存档扩展：最佳战绩（目前只存最近一次）
- 负重收回的钟摆效果（重物把绳子拽向竖直方向，原版手感关键点）
- 正式关卡表 + 随机生成
- 音效
