// ==UserScript==
// @name         通用 - 屏蔽自动登录弹窗
// @namespace    qlb
// @version      1.1.0
// @description  屏蔽自动登录弹窗，手动操作按钮正常触发。配置请在 Tampermonkey 菜单打开。
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
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

  // ==================== Toast 工具（替换 alert/confirm） ====================
  function toast(msg, type) {
    type = type || 'info';
    const colors = {
      success: { bg: '#2ecc71', fg: '#fff' },
      error: { bg: '#e74c3c', fg: '#fff' },
      info: { bg: '#2c3e50', fg: '#fff' },
    };
    const c = colors[type] || colors.info;
    const t = document.createElement('div');
    t.style.cssText =
      'position:fixed!important;top:20px!important;left:50%!important;transform:translateX(-50%)!important;' +
      'background:' +
      c.bg +
      '!important;color:' +
      c.fg +
      '!important;padding:10px 20px!important;' +
      'border-radius:6px!important;box-shadow:0 4px 16px rgba(0,0,0,.25)!important;' +
      'z-index:2147483647!important;font-size:13px!important;font-weight:500!important;' +
      'font-family:-apple-system,"Segoe UI",Roboto,sans-serif!important;' +
      'transition:opacity .25s!important;opacity:0!important;pointer-events:none!important;';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () {
      t.style.opacity = '1';
    });
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () {
        t.remove();
      }, 260);
    }, 2200);
  }

  function uiConfirm(msg, onOk, onCancel) {
    onOk = onOk || function () {};
    onCancel = onCancel || function () {};
    // 复用 toast 的位置但做成带按钮的小卡片
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed!important;top:20px!important;left:50%!important;transform:translateX(-50%)!important;' +
      'background:#fff!important;color:#222!important;padding:14px 16px!important;' +
      'border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,.3)!important;' +
      'z-index:2147483647!important;font-size:13px!important;' +
      'font-family:-apple-system,"Segoe UI",Roboto,sans-serif!important;' +
      'display:flex!important;flex-direction:column!important;gap:10px!important;' +
      'transition:opacity .2s!important;opacity:0!important;min-width:220px!important;max-width:380px!important;';
    const msgEl = document.createElement('div');
    msgEl.textContent = msg;
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    const noBtn = document.createElement('button');
    noBtn.textContent = '取消';
    noBtn.style.cssText =
      'padding:6px 14px;border:1px solid #ccc;border-radius:5px;background:#fff;cursor:pointer;font-size:12px;';
    const yesBtn = document.createElement('button');
    yesBtn.textContent = '确定';
    yesBtn.style.cssText =
      'padding:6px 14px;border:none;border-radius:5px;background:#e74c3c;color:#fff;cursor:pointer;font-size:12px;';
    noBtn.onclick = function () {
      box.style.opacity = '0';
      setTimeout(function () {
        box.remove();
      }, 210);
      onCancel();
    };
    yesBtn.onclick = function () {
      box.style.opacity = '0';
      setTimeout(function () {
        box.remove();
      }, 210);
      onOk();
    };
    btnRow.appendChild(noBtn);
    btnRow.appendChild(yesBtn);
    box.appendChild(msgEl);
    box.appendChild(btnRow);
    document.body.appendChild(box);
    requestAnimationFrame(function () {
      box.style.opacity = '1';
    });
  }

  // ==================== 第 5 部分：配置面板（只在菜单打开时注入） ====================
  function openUI(options) {
    options = options || {};
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

    // 注入浅色主题样式（优先级最高，覆盖页面暗色）
    const themeStyle = document.createElement('style');
    themeStyle.textContent = [
      '#qlb-panel {',
      '  font-family: -apple-system, "Segoe UI", Roboto, sans-serif !important;',
      '  font-size: 13px !important;',
      '  color: #222 !important;',
      '  background: #fff !important;',
      '  color-scheme: light !important;',
      '}',
      '#qlb-panel input, #qlb-panel textarea, #qlb-panel select {',
      '  -webkit-appearance: none !important;',
      '  appearance: none !important;',
      '  color-scheme: light !important;',
      '  background: #fff !important;',
      '  background-color: #fff !important;',
      '  color: #222 !important;',
      '  -webkit-text-fill-color: #222 !important;',
      '  border: 1px solid #d9d9d9 !important;',
      '  border-radius: 5px !important;',
      '  padding: 6px 10px !important;',
      '  font-size: 12px !important;',
      '  font-family: "SF Mono", Consolas, Monaco, monospace !important;',
      '  outline: none !important;',
      '  width: 100% !important;',
      '  box-sizing: border-box !important;',
      '}',
      '#qlb-panel input:focus, #qlb-panel textarea:focus, #qlb-panel select:focus { border-color: #4a90d9 !important; box-shadow: 0 0 0 2px rgba(74,144,217,.15) !important; }',
      '#qlb-panel button {',
      '  -webkit-appearance: none !important;',
      '  appearance: none !important;',
      '  color-scheme: light !important;',
      '  background: #fff !important;',
      '  color: #222 !important;',
      '  border: 1px solid #d9d9d9 !important;',
      '  border-radius: 5px !important;',
      '  cursor: pointer !important;',
      '  font-size: 12px !important;',
      '  padding: 6px 14px !important;',
      '  transition: all .15s !important;',
      '}',
      '#qlb-panel button:hover { border-color: #4a90d9 !important; color: #4a90d9 !important; background: #fff !important; }',
      '#qlb-panel button:disabled { opacity: .5 !important; cursor: not-allowed !important; }',
      '#qlb-panel label { color: #888 !important; font-size: 11px !important; }',
      '#qlb-panel * { color-scheme: light !important; }',
    ].join('\\n');
    (document.head || document.documentElement).appendChild(themeStyle);

    // 单独一个 style 管 placeholder，插到最后确保优先级最高
    const phStyle = document.createElement('style');
    phStyle.textContent = [
      '/* placeholder 强制样式 — 放最后确保最高优先级 */',
      '#qlb-panel input:not(:placeholder-shown) { background-color: #fff !important; }',
      '#qlb-panel input:placeholder-shown { background-color: #fafafa !important; }',
      '#qlb-panel input::-webkit-input-placeholder { color: #d0d0d0 !important; -webkit-text-fill-color: #d0d0d0 !important; opacity: 1 !important; font-style: italic !important; }',
      '#qlb-panel input::-moz-placeholder { color: #d0d0d0 !important; opacity: 1 !important; font-style: italic !important; }',
      '#qlb-panel input:-ms-input-placeholder { color: #d0d0d0 !important; opacity: 1 !important; font-style: italic !important; }',
      '#qlb-panel input::placeholder { color: #d0d0d0 !important; -webkit-text-fill-color: #d0d0d0 !important; opacity: 1 !important; font-style: italic !important; }',
    ].join('\n');
    document.head.appendChild(phStyle);

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
          uiConfirm('删除 ' + host + '？', function () {
            delete SITES[host];
            store.save(SITES);
            const mm = matchHost(SITES, HOST);
            SITE = mm ? mm.cfg : null;
            unmount();
            mount();
            panelEl.remove();
            bg.remove();
            openUI();
            toast('已删除', 'success');
          });
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
          // 用 setProperty + 'important' 覆盖一切页面样式
          const imp = function (k, v) {
            inp.style.setProperty(k, v, 'important');
          };
          imp('width', '100%');
          imp('padding', '6px 10px');
          imp('border', '1px solid #d9d9d9');
          imp('border-radius', '5px');
          imp('background', '#fff');
          imp('background-color', '#fff');
          imp('color', '#222');
          imp('-webkit-text-fill-color', '#222');
          imp('font-size', '12px');
          imp('font-family', '"SF Mono", Consolas, Monaco, monospace');
          imp('box-sizing', 'border-box');
          imp('outline', 'none');
          imp('color-scheme', 'light');
          imp('-webkit-appearance', 'none');
          imp('appearance', 'none');
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
    const imp2 = function (k, v) {
      addInput.style.setProperty(k, v, 'important');
    };
    imp2('flex', '1');
    imp2('padding', '7px 10px');
    imp2('border', '1px solid #d9d9d9');
    imp2('border-radius', '5px');
    imp2('background', '#fff');
    imp2('background-color', '#fff');
    imp2('color', '#222');
    imp2('-webkit-text-fill-color', '#222');
    imp2('font-size', '12px');
    imp2('color-scheme', 'light');
    imp2('-webkit-appearance', 'none');
    imp2('appearance', 'none');
    const addBtn = document.createElement('button');
    addBtn.textContent = '＋ 添加';
    addBtn.style.cssText =
      'padding:7px 14px;border:none;border-radius:5px;background:#4a90d9;color:#fff;cursor:pointer;font-size:12px;';
    addBtn.onclick = function () {
      const hn = addInput.value.trim();
      if (!hn) {
        toast('请输入 hostname', 'error');
        return;
      }
      if (SITES[hn]) {
        toast(hn + ' 已存在', 'error');
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
      uiConfirm('恢复默认配置？你添加/修改的都会丢失。', function () {
        store.reset();
        panelEl.remove();
        bg.remove();
        openUI();
        toast('已重置默认配置', 'success');
      });
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
      let hasError = false;
      let firstErrorCard = null;
      const result = {};

      // 先清除之前的错误高亮和提示
      bodyWrap.querySelectorAll('.qlb-err-tip').forEach(function (el) {
        el.remove();
      });
      bodyWrap.querySelectorAll('input[data-f]').forEach(function (inp) {
        inp.style.removeProperty('border');
        inp.style.removeProperty('box-shadow');
      });

      bodyWrap.querySelectorAll('.qlb-site').forEach(function (card) {
        if (card.dataset.del) return;
        const nameEl = card.querySelector('span');
        if (!nameEl) return;
        const hostNode = nameEl.firstChild;
        const host = (
          hostNode ? hostNode.textContent : nameEl.textContent
        ).trim();
        const cfg = {};

        card.querySelectorAll('input[data-f]').forEach(function (inp) {
          const v = inp.value.trim();
          if (!v) return;
          try {
            document.createElement('div').querySelector(v);
            cfg[inp.dataset.f] = v;
          } catch (e) {
            hasError = true;
            if (!firstErrorCard) firstErrorCard = card;
            // 输入框红框
            inp.style.setProperty('border', '2px solid #e74c3c', 'important');
            inp.style.setProperty(
              'box-shadow',
              '0 0 0 3px rgba(231,76,60,.2)',
              'important'
            );
            // 输入框下面插入红色提示文字
            const tip = document.createElement('div');
            tip.className = 'qlb-err-tip';
            tip.textContent = '❌ 选择器格式错误: "' + v + '"';
            tip.style.cssText =
              'color:#e74c3c;font-size:11px;margin-top:3px;margin-bottom:2px;';
            inp.parentNode.insertBefore(tip, inp.nextSibling);
          }
        });

        if (Object.keys(cfg).length >= 2) result[host] = cfg;
      });

      if (hasError) {
        if (firstErrorCard) {
          // card.children[1] 就是 fields div（DOM 结构固定：head + fields）
          const fieldsDiv = firstErrorCard.children[1];
          if (fieldsDiv) fieldsDiv.style.display = 'block';
          // 聚焦第一个红色输入框
          const badInp = firstErrorCard.querySelector(
            'input[style*="2px solid"]'
          );
          if (badInp) badInp.focus();
          // 滚到可视区域
          firstErrorCard.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
        return;
      }

      store.save(result);
      SITES = result;
      const m2 = matchHost(SITES, HOST);
      SITE = m2 ? m2.cfg : null;
      unmount();
      mount();
      toast(
        '已保存！当前网站 ' + HOST + '：' + (SITE ? '已生效' : '暂无配置'),
        'success'
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

    // 如果有指定要展开的配置项，找到对应卡片展开、高亮并滚动到可视区
    if (options && options.expandHost) {
      bodyWrap.querySelectorAll('.qlb-site').forEach(function (c) {
        const sn = c.querySelector('span');
        if (sn && sn.firstChild.textContent.trim() === options.expandHost) {
          const f = c.children[1];
          if (f) f.style.display = 'block';
          if (options.highlight) {
            c.style.setProperty('border', '2px solid #4a90d9', 'important');
            c.style.setProperty(
              'box-shadow',
              '0 0 0 3px rgba(74,144,217,.2)',
              'important'
            );
          }
          c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  // ==================== 第 6 部分：Tampermonkey 菜单 ====================
  // 只在顶层窗口注册菜单，iframe 里跳过（否则会注册 N 个同名菜单）
  const IS_TOP = window.top === window.self;
  try {
    if (IS_TOP) {
      GM_registerMenuCommand('🛠️ 打开配置面板', openUI);
      GM_registerMenuCommand('🔄 重置为默认配置', function () {
        uiConfirm('恢复默认配置？', function () {
          store.reset();
          SITES = store.load();
          const m3 = matchHost(SITES, HOST);
          SITE = m3 ? m3.cfg : null;
          unmount();
          mount();
          toast('已重置默认配置', 'success');
        });
      });
      GM_registerMenuCommand('📋 查看当前网站配置', function () {
        if (matched) {
          openUI({ expandHost: matched.key, highlight: true });
        } else {
          openUI();
        }
      });
      console.log('[QLB] ✅ Tampermonkey 菜单已注册');
    } else {
      console.log('[QLB] iframe 内跳过菜单注册');
    }
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
