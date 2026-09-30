// ==UserScript==
// @name         通用 - 屏蔽自动登录弹窗
// @namespace    qlb
// @version      6.0.0
// @description  屏蔽自动登录弹窗，手动操作按钮正常触发。配置请在 Tampermonkey 菜单打开。
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  try {
    console.log('[QLB] ========== 启动 v6.0 ==========');
  } catch (e) {}

  // ==================== 第 1 部分：存储层（GM_setValue 跨域共享） ====================
  const DEFAULT_SITES = {
    'pan.quark.cn': {
      modalRoot: '.ant-modal-root',
      loginModal: '.ant-modal.login-modal',
      closeBtn: '.ant-modal.login-modal .ant-modal-close',
      mask: '.ant-modal-mask',
      modalScope: '.ant-modal',
    },
    'pan.baidu.com': {
      modalRoot: '.passport-modal-wrap',
      loginModal: '.passport-modal',
      closeBtn: '.passport-modal .close-btn',
      mask: '.passport-modal-mask',
      modalScope: '.passport-modal',
    },
    '*.aliyundrive.com': {
      modalRoot: '[class*="modal-root"]',
      loginModal: '[class*="LoginDialog"],[class*="login-dialog"]',
      closeBtn: '[class*="LoginDialog"] [class*="close"]',
      mask: '[class*="modal-mask"]',
      modalScope: '[class*="modal"],[class*="dialog"]',
    },
  };

  // 匹配当前 hostname：先精确匹配，再通配符（*.domain.com）
  function matchHost(sites, host) {
    if (sites[host]) return { cfg: sites[host], key: host };
    // *.aliyundrive.com 能匹配 www.aliyundrive.com / pan.aliyundrive.com / aliyundrive.com
    for (const key of Object.keys(sites)) {
      if (key.startsWith('*.')) {
        const suffix = key.slice(1); // ".aliyundrive.com"
        if (host === suffix.slice(1) || host.endsWith(suffix))
          return { cfg: sites[key], key: key };
      }
    }
    return null;
  }
  const SK = 'qlb-sites-v1';
  const store = {
    load: function () {
      try {
        return JSON.parse(GM_getValue(SK)) || DEFAULT_SITES;
      } catch (e) {
        return DEFAULT_SITES;
      }
    },
    save: function (o) {
      try {
        GM_setValue(SK, JSON.stringify(o));
      } catch (e) {}
    },
    reset: function () {
      try {
        GM_setValue(SK, JSON.stringify(DEFAULT_SITES));
      } catch (e) {}
    },
  };

  // ==================== 第 2 部分：当前网站配置 ====================
  const HOST = location.hostname;
  let SITES = store.load();
  let matched = matchHost(SITES, HOST);
  let SITE = matched ? matched.cfg : null;
  try {
    console.log(
      '[QLB] host=' +
        HOST +
        ' → ' +
        (matched ? '匹配 ' + matched.key + ' ✅' : '❌ 未配置')
    );
  } catch (e) {}

  // ==================== 第 3 部分：状态 & 核心 ====================
  const WIN = 8000;
  let intent = false,
    intentTimer = null;
  const seen = new WeakSet();
  let obs = null,
    cssNode = null;

  function setIntent() {
    intent = true;
    if (document.body) document.body.setAttribute('data-qlb', '1');
    if (intentTimer) clearTimeout(intentTimer);
    intentTimer = setTimeout(function () {
      intent = false;
      if (document.body) document.body.removeAttribute('data-qlb');
    }, WIN);
  }

  function handle(root) {
    if (!root || seen.has(root) || !SITE) return;
    const lm = root.querySelector(SITE.loginModal);
    if (!lm) return;
    seen.add(root);
    if (intent) {
      console.log('[QLB] 🟢 放行');
      return;
    }
    const cb = root.querySelector(SITE.closeBtn);
    if (cb) {
      cb.click();
      console.log('[QLB] 🔴 屏蔽(点关闭)');
    } else {
      root.style.display = 'none';
      console.log('[QLB] 🔴 屏蔽(CSS)');
    }
    document.body.style.overflow = '';
  }

  function mount() {
    if (!SITE) return;
    // CSS 兜底
    cssNode = document.createElement('style');
    cssNode.textContent =
      'body:not([data-qlb="1"]) ' +
      SITE.loginModal +
      ',body:not([data-qlb="1"]) ' +
      SITE.mask +
      '{display:none!important}';
    (document.head || document.documentElement).appendChild(cssNode);
    // Observer
    obs = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SITE.modalRoot)) handle(n);
          if (n.querySelectorAll)
            n.querySelectorAll(SITE.modalRoot).forEach(handle);
        });
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // 扫描
    document.querySelectorAll(SITE.modalRoot).forEach(handle);
    setTimeout(function () {
      document.querySelectorAll(SITE.modalRoot).forEach(handle);
    }, 600);
    setTimeout(function () {
      document.querySelectorAll(SITE.modalRoot).forEach(handle);
    }, 1800);
  }
  function unmount() {
    if (obs) obs.disconnect();
    if (cssNode && cssNode.parentNode) cssNode.parentNode.removeChild(cssNode);
    obs = null;
    cssNode = null;
  }

  // ==================== 第 4 部分：点击监听 ====================
  try {
    document.addEventListener(
      'click',
      function (e) {
        if (!SITE) return;
        const t = e.target.closest(
          'button,a,[role="button"],[class*="btn"],[class*="Btn"],[class*="action"],[class*="Action"],[class*="save"],[class*="Save"],[class*="download"],[class*="Download"]'
        );
        if (!t) return;
        if (t.closest(SITE.modalScope || '.ant-modal')) return;
        const text = (t.innerText || t.textContent || '').trim();
        if (/header|nav|footer|menu|icon|logo/i.test(t.className || '')) return;
        if (
          /^(首页|主页|文件|我的|分享|设置|更多|返回|×|关闭|OK|确定)$/.test(
            text
          )
        )
          return;
        setIntent();
      },
      true
    );
  } catch (e) {
    console.error('[QLB] 点击监听失败', e);
  }

  // ==================== 第 5 部分：配置面板（只在菜单打开时注入） ====================
  let panelEl = null;

  function openUI() {
    // 避免重复打开
    if (panelEl && panelEl.parentNode) {
      panelEl.remove();
      panelEl = null;
    }

    // 刷新数据
    SITES = store.load();
    const m = matchHost(SITES, HOST);
    SITE = m ? m.cfg : null;

    panelEl = document.createElement('div');
    panelEl.id = 'qlb-panel';
    panelEl.style.cssText =
      'position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:500px!important;max-height:80vh!important;background:#fff!important;color:#222!important;border-radius:12px!important;box-shadow:0 12px 48px rgba(0,0,0,.25)!important;z-index:2147483646!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;font-size:13px!important;line-height:1.5!important;font-family:-apple-system,"Segoe UI",Roboto,sans-serif!important;';

    // 遮罩背景（点外面关闭）
    const bg = document.createElement('div');
    bg.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483645;';
    bg.onclick = function () {
      panelEl.remove();
      bg.remove();
      panelEl = null;
    };

    // 标题
    const h = document.createElement('div');
    h.style.cssText =
      'padding:14px 16px;font-weight:600;font-size:14px;border-bottom:1px solid #eee;background:#fafafa;display:flex;justify-content:space-between;';
    const hTitle = document.createElement('span');
    hTitle.textContent = '登录弹窗屏蔽 · 配置';
    h.appendChild(hTitle);
    const closeX = document.createElement('button');
    closeX.textContent = '×';
    closeX.style.cssText =
      'border:none;background:none;cursor:pointer;color:#888;font-size:20px;line-height:1;';
    closeX.onclick = function () {
      panelEl.remove();
      bg.remove();
      panelEl = null;
    };
    h.appendChild(closeX);
    panelEl.appendChild(h);

    // 主体
    const bodyWrap = document.createElement('div');
    bodyWrap.style.cssText = 'overflow-y:auto;padding:12px 16px;flex:1;';

    Object.keys(SITES)
      .sort()
      .forEach(function (host) {
        const cfg = SITES[host];
        const card = document.createElement('div');
        card.className = 'qlb-site';
        card.style.cssText =
          'border:1px solid #e8e8e8;border-radius:8px;margin-bottom:10px;overflow:hidden;';

        const head = document.createElement('div');
        head.style.cssText =
          'padding:10px 12px;background:#fafafa;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';
        const sn = document.createElement('span');
        sn.style.cssText = 'font-weight:500;color:#333;';
        sn.textContent = host;
        if (host === HOST) {
          const tag = document.createElement('span');
          tag.textContent = '当前';
          tag.style.cssText =
            'font-size:11px;color:#fff;background:#4a90d9;padding:1px 8px;border-radius:10px;margin-left:6px;';
          sn.appendChild(tag);
        }
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;';
        const del = document.createElement('button');
        del.textContent = '删除';
        del.style.cssText =
          'border:none;background:none;color:#e74c3c;cursor:pointer;font-size:12px;';
        del.onclick = function (ev) {
          ev.stopPropagation();
          if (!confirm('删除 ' + host + '？')) return;
          card.dataset.del = '1';
          card.style.display = 'none';
        };
        actions.appendChild(del);
        head.appendChild(sn);
        head.appendChild(actions);

        const fields = document.createElement('div');
        fields.style.cssText =
          'padding:0;display:none;border-top:1px solid #e8e8e8;';

        const fieldDefs = [
          {
            key: 'modalRoot',
            label: 'modalRoot (弹窗根容器)',
            ph: '.ant-modal-root',
          },
          {
            key: 'loginModal',
            label: 'loginModal (登录弹窗本体)',
            ph: '.ant-modal.login-modal',
          },
          {
            key: 'closeBtn',
            label: 'closeBtn (关闭按钮)',
            ph: '.ant-modal-close',
          },
          { key: 'mask', label: 'mask (遮罩层)', ph: '.ant-modal-mask' },
          {
            key: 'modalScope',
            label: 'modalScope (弹窗内部)',
            ph: '.ant-modal',
          },
        ];
        fieldDefs.forEach(function (fd) {
          const row = document.createElement('div');
          row.style.cssText = 'padding:8px 12px 0;';
          const lab = document.createElement('label');
          lab.style.cssText =
            'display:block;font-size:11px;color:#888;margin-bottom:2px;';
          lab.textContent = fd.label;
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.dataset.f = fd.key;
          inp.placeholder = fd.ph;
          if (cfg[fd.key]) inp.value = cfg[fd.key];
          inp.style.cssText =
            'width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:5px;font-size:12px;font-family:monospace;box-sizing:border-box;';
          row.appendChild(lab);
          row.appendChild(inp);
          fields.appendChild(row);
        });
        const padBottom = document.createElement('div');
        padBottom.style.cssText = 'height:8px;';
        fields.appendChild(padBottom);

        head.onclick = function (ev) {
          if (ev.target === del) return;
          fields.style.display =
            fields.style.display === 'block' ? 'none' : 'block';
        };

        card.appendChild(head);
        card.appendChild(fields);
        bodyWrap.appendChild(card);
      });

    panelEl.appendChild(bodyWrap);

    // 添加新网站区
    const addRow = document.createElement('div');
    addRow.style.cssText =
      'padding:10px 16px;border-top:1px dashed #ddd;background:#fcfcfc;display:flex;gap:6px;';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = '输入 hostname，如 pan.qq.com';
    addInput.style.cssText =
      'flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:5px;font-size:12px;';
    const addBtn = document.createElement('button');
    addBtn.textContent = '＋ 添加';
    addBtn.style.cssText =
      'padding:7px 14px;border:none;border-radius:5px;background:#4a90d9;color:#fff;cursor:pointer;font-size:12px;';
    addBtn.onclick = function () {
      const hn = addInput.value.trim();
      if (!hn) {
        alert('请输入 hostname');
        return;
      }
      if (SITES[hn]) {
        alert(hn + ' 已存在');
        return;
      }
      // 直接保存空壳配置，让用户填
      SITES[hn] = {
        modalRoot: '',
        loginModal: '',
        closeBtn: '',
        mask: '',
        modalScope: '',
      };
      store.save(SITES);
      // 重新打开刷新列表
      panelEl.remove();
      bg.remove();
      openUI();
    };
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    panelEl.appendChild(addRow);

    // 底部工具栏
    const tb = document.createElement('div');
    tb.style.cssText =
      'padding:10px 16px;border-top:1px solid #eee;background:#fafafa;display:flex;gap:8px;justify-content:space-between;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '重置默认';
    resetBtn.style.cssText =
      'padding:7px 14px;border:1px solid #ccc;border-radius:5px;background:#fff;cursor:pointer;font-size:12px;';
    resetBtn.onclick = function () {
      if (!confirm('恢复默认配置？你添加/修改的都会丢失。')) return;
      store.reset();
      panelEl.remove();
      bg.remove();
      openUI();
    };
    const rightBtns = document.createElement('div');
    rightBtns.style.cssText = 'display:flex;gap:8px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText =
      'padding:7px 14px;border:1px solid #ccc;border-radius:5px;background:#fff;cursor:pointer;font-size:12px;';
    cancelBtn.onclick = function () {
      panelEl.remove();
      bg.remove();
      panelEl = null;
    };
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存并生效';
    saveBtn.style.cssText =
      'padding:7px 14px;border:none;border-radius:5px;background:#2ecc71;color:#fff;cursor:pointer;font-size:12px;font-weight:500;';
    saveBtn.onclick = function () {
      const result = {};
      bodyWrap.querySelectorAll('.qlb-site').forEach(function (card) {
        if (card.dataset.del) return;
        const nameEl = card.querySelector('span');
        if (!nameEl) return;
        // 排除 <span> 内的子元素（比如"当前"标签）
        const hostNode = nameEl.firstChild;
        const host = (
          hostNode ? hostNode.textContent : nameEl.textContent
        ).trim();
        const cfg = {};
        card.querySelectorAll('input[data-f]').forEach(function (inp) {
          const v = inp.value.trim();
          if (v) cfg[inp.dataset.f] = v;
        });
        if (Object.keys(cfg).length >= 2) result[host] = cfg; // 至少有 modalRoot + loginModal 才保存
      });
      store.save(result);
      SITES = result;
      const m2 = matchHost(SITES, HOST);
      SITE = m2 ? m2.cfg : null;
      unmount();
      mount();
      alert(
        '✅ 已保存！\n\n当前网站 ' +
          HOST +
          '：' +
          (SITE ? '已生效' : '暂无配置')
      );
      panelEl.remove();
      bg.remove();
      panelEl = null;
    };
    rightBtns.appendChild(cancelBtn);
    rightBtns.appendChild(saveBtn);
    tb.appendChild(resetBtn);
    tb.appendChild(rightBtns);
    panelEl.appendChild(tb);

    // 先插 bg 再插 panel
    document.body.appendChild(bg);
    document.body.appendChild(panelEl);
  }

  // ==================== 第 6 部分：Tampermonkey 菜单 ====================
  try {
    GM_registerMenuCommand('🛠️ 打开配置面板', openUI);
    GM_registerMenuCommand('🔄 重置为默认配置', function () {
      if (!confirm('恢复默认配置？')) return;
      store.reset();
      SITES = store.load();
      const m3 = matchHost(SITES, HOST);
      SITE = m3 ? m3.cfg : null;
      unmount();
      mount();
      alert('已重置');
    });
    GM_registerMenuCommand('📋 查看当前网站配置', function () {
      alert(
        'Host: ' +
          HOST +
          '\n' +
          (SITE
            ? '配置:\n' + JSON.stringify(SITE, null, 2)
            : '❌ 当前网站无配置')
      );
    });
    console.log('[QLB] ✅ Tampermonkey 菜单已注册');
  } catch (e) {
    console.warn('[QLB] GM_registerMenuCommand 不可用', e);
    // 回退：加一个悬浮按钮（仅当 GM 菜单不可用时）
    const fab = document.createElement('div');
    fab.id = 'qlb-fab';
    fab.textContent = '⚙️';
    fab.title = 'QLB 配置（GM菜单不可用时的回退）';
    fab.style.cssText =
      'position:fixed!important;right:18px!important;bottom:22px!important;width:36px!important;height:36px!important;border-radius:50%!important;background:#4a4a4a!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:2147483647!important;cursor:pointer!important;font-size:18px!important;box-shadow:0 2px 8px rgba(0,0,0,.2)!important;';
    fab.onclick = function () {
      openUI();
    };
    document.body.appendChild(fab);
  }

  // ==================== 第 7 部分：启动核心 ====================
  try {
    mount();
    console.log('[QLB] ✅ mount 完成');
  } catch (e) {
    console.error('[QLB] mount 失败', e);
  }
})();
