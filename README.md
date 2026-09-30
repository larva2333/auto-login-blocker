# 🔐 Auto Login Blocker

一个 Tampermonkey（油猴）脚本，屏蔽网盘等网站**自动弹出**的登录弹窗，同时保证**手动操作**（点击"登录"/"下载"/"保存到网盘"等按钮）时弹窗正常触发。

> v1.1.0 · MIT License

---

## ✨ 功能

- 🛡️ **拦截自动弹窗** — 定时器、路由守卫、API 拦截器等触发的登录弹窗一键屏蔽
- 🟢 **手动操作放行** — 用户主动点击按钮时，8 秒内弹窗正常触发
- ⚙️ **可视化配置面板** — 增删各网站的弹窗选择器，无需改代码
- 🌐 **通配符子域名** — `*.aliyundrive.com` 自动覆盖所有子域名
- 🔁 **双重兜底** — CSS 隐藏 + JS 点击关闭，确保弹窗被处理
- 💾 **配置持久化** — 基于 Tampermonkey `GM_setValue`，跨域共享
- 🎨 **自带 Toast 通知** — 不依赖原生 `alert`，弹窗被屏蔽时友好提示
- 🌙 **暗色/亮色通用** — 配置面板输入框强制亮色主题，不受页面暗色模式影响

---

## 🧠 原理

脚本**不尝试识别"这个弹窗是自动的还是手动的"**，而是追踪弹窗出现前的用户行为：

```
用户点击按钮 ──→ 设置 intent=true（8 秒窗口） ──┐
                                                ├─→ 8 秒内弹窗 → 🟢 放行
页面自动弹窗  ──→ intent=false                  ──┘
                                                ──→ 8 秒后弹窗 → 🔴 屏蔽
```

| 场景 | intent | 行为 |
|------|--------|------|
| 页面加载后 setTimeout 弹窗 | `false` | 屏蔽 |
| 浏览中路由跳转触发弹窗 | `false` | 屏蔽 |
| 点击"下载"按钮触发弹窗 | `true` | 放行 |
| 点击"保存到网盘"触发弹窗 | `true` | 放行 |

自动弹窗（定时/路由守卫）没有用户 click 作为前置条件 → `intent=false` → 屏蔽。
手动操作一定有 click 事件 → `intent=true` → 放行。

---

## 📦 安装

1. 安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)
2. 点右上角 🐒 Tampermonkey 图标 → 添加新脚本
3. 打开 [quark-login-blocker.user.js](./quark-login-blocker.user.js) 复制全部内容
4. 粘贴到 Tampermonkey 编辑区 → `Ctrl+S` 保存

或直接点脚本文件的 **Raw** 链接：Tampermonkey 会弹出安装提示。

---

## 🎯 已适配网站

| 网站 | UI 框架 | 状态 |
|------|---------|------|
| `pan.quark.cn` | Ant Design | ✅ 默认配置 |
| `pan.baidu.com` | 自研 | ✅ 默认配置 |
| `*.aliyundrive.com` | 自研（class*=匹配） | ✅ 默认配置 |

> 其他网站可通过配置面板自行添加，见下文。

---

## ⚙️ 自定义配置

点浏览器右上角 🐒 Tampermonkey 图标 → 找到"通用 - 屏蔽自动登录弹窗"：

```
├─ 🛠️ 打开配置面板       — 可视化增删改各网站的选择器
├─ 🔄 重置为默认配置      — 一键还原
└─ 📋 查看当前网站配置    — 快速检查当前域名匹配的配置
```

每个网站需要配置 5 个字段：

| 字段 | 用途 | 示例 |
|------|------|------|
| `modalRoot` | 弹窗根容器，MutationObserver 监听这个 | `.ant-modal-root` |
| `loginModal` | 登录弹窗本体，用来判定是不是"要处理的弹窗" | `.ant-modal.login-modal` |
| `closeBtn` | 弹窗里的关闭按钮，JS 点击它关闭 | `.ant-modal.login-modal .ant-modal-close` |
| `mask` | 遮罩层，CSS 兜底隐藏 | `.ant-modal-mask` |
| `modalScope` | 弹窗内部选择器，排除点击监听误判 | `.ant-modal` |

**填完保存立即生效，无需刷新页面。**

---

## 🔤 通配符语法

配置的 key 支持 `*.` 前缀匹配所有子域名：

```json
{
  "*.aliyundrive.com": {
    "modalRoot": "[class*=\"modal-root\"]",
    "loginModal": "[class*=\"LoginDialog\"], [class*=\"login-dialog\"]",
    "closeBtn": "[class*=\"LoginDialog\"] [class*=\"close\"]",
    "mask": "[class*=\"modal-mask\"]",
    "modalScope": "[class*=\"modal\"], [class*=\"dialog\"]"
  }
}
```

自动覆盖 `www.aliyundrive.com`、`pan.aliyundrive.com`、`aliyundrive.com` 等。

**匹配优先级**：精确匹配 > 通配符匹配。如果某个子域名 DOM 结构不同，可以单独加一条精确配置覆盖。

---

## 🔍 调试

打开浏览器 F12 → Console，搜索 `[QLB]`：

```
[QLB] ========== 启动 v6.0 ==========
[QLB] host=pan.quark.cn → 匹配 pan.quark.cn ✅
[QLB] 🔴 屏蔽(点关闭)
```

每条日志都带 `[QLB]` 前缀，方便过滤。

---

## 📝 添加新网站

1. 打开目标网站，按 F12 查看 DOM
2. 找到登录弹窗的根容器、本体、关闭按钮、遮罩层对应的 CSS 选择器
3. Tampermonkey 菜单 → 🛠️ 打开配置面板 → ➕ 添加网站
4. 填入域名和 5 个选择器 → 保存
5. 刷新页面验证

如果点击关闭按钮后弹窗还在，说明选择器不对；如果 8 秒窗口没触发，检查点击监听是否匹配到了目标按钮。

---

## 📜 许可证

MIT © LunaTechLab
