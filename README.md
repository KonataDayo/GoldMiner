# 黄金矿工（Gold Miner）

经典「黄金矿工」玩法的网页复刻：纯前端 JavaScript + Canvas，**零依赖、零构建**，浏览器原生 ES Modules 直接运行。

🎮 在线试玩：<https://konatadayo.github.io/GoldMiner/>

## 玩法与操作

摆动钩子 → 发射 → 抓取金块/钻石/石头 → 负重收回 → 结算入账。限时内达到目标分数即过关。

| 操作 | 键位 / 方式 |
|---|---|
| 发射钩子 | 空格 / ↓ / 鼠标左键 / 触屏点击 |
| 使用道具 | 数字键 1（炸药）· 2（力量药水）· 3（生财药水）；触屏走「背包 → 使用」按钮 |
| 再来一局 | 结束画面按钮（同难度重开） |

## 特性

- **五状态状态机**（SWING / EXTEND / RETRACT_EMPTY / RETRACT_LOADED / SETTLE）：tick 驱动 + 输入事件队列
- **三档难度**（简单 / 普通 / 困难）：难度与生成算法全部配置化——价值-距离关联、物体尺寸缩放、Halton 低差异采样 + 拒绝式间距控制
- **商店 + 背包 + 道具系统**：炸药（炸掉钩住的物体）、力量药水（接下来 10 次抓钩收回 ×2）、生财药水（本局结算分 ×1.2）；buff 按「抓钩循环次数」消耗
- **本地存档**（localStorage）：金币、胜场、各难度最近战绩、背包数量；主菜单可清档（两段式确认）
- **多设备适配**：逻辑坐标固定 800×600，画布等比缩放 + 高分屏 DPR 锐化；手机触屏可玩，横竖屏自动适配
- **资源预载 barrier**：启动即预载贴图，进游戏未就绪时显示 Loading（非阻塞）；贴图按路径配置驱动，缺图自动回退矢量占位
- **美术素材**：assets/ 下透明 PNG；角色 / 钩子 / 抓取物 / 商品图标在对应 config 里填路径即切换，空路径 = 矢量占位

## 本地运行

无需安装任何依赖。ES Modules 需要 http(s) 协议（**不能双击 index.html 用 file:// 打开**）：

```bash
# 方式一：Python 静态服务器（本机有 Python 即可）
python -m http.server 8000     # 然后浏览器访问 http://localhost:8000

# 方式二：Node 环境
npx serve .

# 方式三：VS Code 装 Live Server 插件 → 右键 index.html → Open with Live Server
```

## 项目结构

```
GoldMiner/
├── index.html             # 页面骨架 + canvas 挂载
├── css/style.css          # 页面样式（居中画布 / 触屏优化）
├── js/
│   ├── main.js            # 入口：初始化 + rAF 主循环 + 多分辨率适配
│   ├── config.js          # 配置（画面）：画布 / 世界 / 主题 THEME / 角色外观
│   ├── config_gameplay.js # 配置（玩法）：矿工物理 / 绳子 / 状态机
│   ├── config_level.js    # 配置（关卡）：难度表 / 抓取物表
│   ├── config_shop.js     # 配置（商店）：商品表（含道具效果声明）/ 格子 UI
│   ├── input.js           # 输入：键盘 / 鼠标 / 触屏 → 事件队列
│   ├── miner.js           # 矿工：状态机 + 绳子 / 钩子物理
│   ├── entities.js        # 抓取物 + 关卡随机生成
│   ├── level.js           # 关卡：倒计时 / 计分 / 胜负判定
│   ├── savegame.js        # 本地存档（localStorage）
│   ├── backpack.js        # 背包（数量持久化在存档）
│   ├── shop.js            # 商店（扣金币 + 入背包）
│   ├── buffs.js           # 道具 buff 管理器（按抓钩次数递减）
│   ├── items.js           # 道具统一消耗接口 + action 执行逻辑
│   ├── screens.js         # 界面管理：ScreenManager + 主菜单 / 游戏 / 商店 / 背包
│   ├── render.js          # 全部绘制（贴图缓存 / 预载 / Loading）
│   └── util/math.js       # 纯函数工具：随机 / 插值 / 加权抽取 / Halton
├── assets/                # 素材（透明 PNG）
├── SESSION_LOG.md         # 完整开发记录与决策日志
└── README.md
```

设计要点：按功能模块拆分；配置数据驱动（加难度 / 加商品 / 换素材只改对应 config）；界面与玩法解耦（ScreenManager 共享游戏状态）。

## 部署

本仓库即用 **GitHub Pages** 托管（main 分支根目录，HTTPS）。更新 = `git push`，1–2 分钟自动生效。

存档保存在玩家各自浏览器的 localStorage（换设备不互通）；排行榜 / 云存档需要后端，属未来扩展。

## 开发记录

完整需求、技术方案、决策记录与逐轮进度见 [SESSION_LOG.md](SESSION_LOG.md)。
