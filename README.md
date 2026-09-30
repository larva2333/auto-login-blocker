# 🔐 Auto Login Blocker

一个 Tampermonkey（油猴）脚本，屏蔽网盘等网站**自动弹出**的登录弹窗，同时保证**手动操作**（点击"登录"/"下载"/"保存到网盘"等按钮）时弹窗正常触发。

## 功能

- ✅ 拦截页面自动弹出的登录弹窗（定时器、路由守卫、API 拦截器触发的）
- ✅ 用户主动点击按钮时放行，登录流程不受影响
- ✅ 支持配置面板，可视化增删各网站的弹窗选择器
- ✅ 支持通配符子域名（如 `*.aliyundrive.com` 自动覆盖所有子域名）
- ✅ CSS 兜底 + JS 点击关闭双重保险
- ✅ 配置持久化到 Tampermonkey 存储（跨域共享）

## 原理

脚本**不尝试区分弹窗本身**，而是追踪弹窗出现前的用户行为：

```
用户点按钮 ──→ 设置 intent=true (8秒窗口) ──┐
                                             ├─→ 8秒内弹窗 → 🟢 放行
页面自动弹窗 ─→ intent=false ──────────────→ │
                                             └─→ 8秒后     → 🔴 屏蔽
```

自动弹窗（定时/路由守卫）没有用户点击作为前置条件 → intent=false → 屏蔽。
手动操作一定有 click 事件 → intent=true → 放行。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击脚本文件名 `quark-login-blocker.user.js` → 打开 Raw 或直接复制内容
3. Tampermonkey 管理面板 → 新建脚本 → 粘贴 → 保存

或访问 [GreasyFork](https://greasyfork.org/) 搜索本脚本一键安装。

## 已适配网站

| 网站 | UI 框架 | 状态 |
|------|---------|------|
| pan.quark.cn | Ant Design | ✅ 默认配置 |
| pan.baidu.com | 自写 | ✅ 默认配置 |
| *.aliyundrive.com | 自写 (class*=匹配) | ✅ 默认配置 |

> 其他网站可通过配置面板添加，见下文。

## 自定义配置

点击浏览器右上角 🐒 Tampermonkey 图标 → 找到本脚本：

```
├─ 🛠️ 打开配置面板      — 可视化增删改各网站的选择器
├─ 🔄 重置为默认配置     — 一键还原
└─ 📋 查看当前网站配置   — 快速检查当前域名匹配的配置
```

展开某个网站卡片后可编辑 5 个选择器：

| 字段 | 说明 | 示例 |
|------|------|------|
| `modalRoot` | 弹窗根容器（MutationObserver 监听目标） | `.ant-modal-root` |
| `loginModal` | 登录弹窗本体（判定条件） | `.ant-modal.login-modal` |
| `closeBtn` | 关闭按钮（JS 点击关闭） | `.ant-modal.login-modal .ant-modal-close` |
| `mask` | 遮罩层（CSS 兜底隐藏） | `.ant-modal-mask` |
| `modalScope` | 弹窗内部元素（排除点击监听误触发） | `.ant-modal` |

保存后立即生效，无需刷新页面。

## 通配符语法

配置 key 支持 `*` 前缀匹配所有子域名：

```json
{
  "*.aliyundrive.com": { ... }
}
```

自动覆盖 `www.aliyundrive.com`、`pan.aliyundrive.com`、`aliyundrive.com` 等。

匹配优先级：**精确匹配 > 通配符匹配**。所以如果 `pan.aliyundrive.com` 的 DOM 结构特殊，可以单独加一条精确配置覆盖。

## 调试

打开浏览器 F12 → Console，搜索 `[QLB]`：

```
[QLB] host=pan.quark.cn → 匹配 pan.quark.cn ✅
[QLB] ========== 启动完成 ==========
```

## 许可证

MIT
