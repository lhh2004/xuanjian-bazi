// 玄鉴八字 - 管理后台
// 独立运行，通过 localStorage 与主系统共享数据

(function () {
  "use strict";

  // ========== 工具函数 ==========
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  // 默认管理员密码（首次登录后建议修改）
  const DEFAULT_ADMIN_PASSWORD = "admin123";
  const ADMIN_SESSION_KEY = "xuanjian-admin-session";

  // localStorage keys
  const STORAGE_KEYS = {
    member: "xuanjian-member-v1",
    wallet: "xuanjian-wallet-v1",
    withdrawals: "xuanjian-withdrawals-v1",
    codes: "xuanjian-codes-v1",
    archives: "xuanjian-archives-v1",
    adminConfig: "xuanjian-admin-config-v1",
    memberRecords: "xuanjian-member-records-v1",
    payments: "xuanjian_payments_v1"
  };

  // 提现配置默认值
  const DEFAULT_WITHDRAW_CONFIG = {
    minAmount: 10,
    dailyLimit: 5000,
    feeRate: 0.01,
    feeMin: 1,
    feeMax: 50,
    pendingHours: 24
  };

  // 会员套餐
  const MEMBER_PLANS = {
    month: { key: "month", name: "月度会员", days: 30, price: 29, unit: "月" },
    quarter: { key: "quarter", name: "季度会员", days: 90, price: 69, unit: "季", save: "省18元" },
    year: { key: "year", name: "年度会员", days: 365, price: 199, unit: "年", save: "省149元", best: true },
    lifetime: { key: "lifetime", name: "终身会员", days: 36500, price: 999, unit: "终身", save: "永久有效" }
  };

  // ========== 状态 ==========
  const state = {
    currentTab: "dashboard",
    walletOp: "recharge",
    reviewAction: null,
    reviewWithdrawId: null,
    withdrawFilter: "all",
    codeFilter: "all",
    paymentFilter: "all"
  };

  // ========== 存储操作 ==========
  function getStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getAdminConfig() {
    return getStorage(STORAGE_KEYS.adminConfig, {
      password: DEFAULT_ADMIN_PASSWORD,
      withdrawConfig: { ...DEFAULT_WITHDRAW_CONFIG }
    });
  }

  function saveAdminConfig(config) {
    setStorage(STORAGE_KEYS.adminConfig, config);
  }

  function getWithdrawals() {
    return getStorage(STORAGE_KEYS.withdrawals, []);
  }

  function saveWithdrawals(list) {
    setStorage(STORAGE_KEYS.withdrawals, list);
  }

  function getWallet() {
    return getStorage(STORAGE_KEYS.wallet, { balance: 0, records: [] });
  }

  function saveWallet(wallet) {
    setStorage(STORAGE_KEYS.wallet, wallet);
  }

  function getCodes() {
    return getStorage(STORAGE_KEYS.codes, []);
  }

  function saveCodes(codes) {
    setStorage(STORAGE_KEYS.codes, codes);
  }

  function getMemberState() {
    return getStorage(STORAGE_KEYS.member, null);
  }

  function getMemberRecords() {
    return getStorage(STORAGE_KEYS.memberRecords, []);
  }

  function getPayments() {
    return getStorage(STORAGE_KEYS.payments, []);
  }

  function savePayments(list) {
    setStorage(STORAGE_KEYS.payments, list);
  }

  function getPaymentConfig() {
    return getStorage("xuanjian_payconfig_v1", { wechatQr: "", alipayQr: "", payeeName: "", autoConfirm: false });
  }

  function getWithdrawConfig() {
    const config = getAdminConfig();
    return config.withdrawConfig || { ...DEFAULT_WITHDRAW_CONFIG };
  }

  // ========== 登录验证 ==========
  function isLoggedIn() {
    const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return session === "authenticated";
  }

  function login(password) {
    const config = getAdminConfig();
    if (password === config.password) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "authenticated");
      return true;
    }
    return false;
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    $("#admin-app").hidden = true;
    $("#admin-login").style.display = "flex";
    $("#admin-password").value = "";
  }

  // ========== Toast 提示 ==========
  function showToast(message, icon) {
    const region = $("#toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <i data-lucide="${icon || "check"}"></i>
      <span>${message}</span>
    `;
    region.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    if (window.lucide) lucide.createIcons({ root: toast });
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ========== 模态框 ==========
  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function bindModalClose() {
    $$(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove("open");
          backdrop.setAttribute("aria-hidden", "true");
        }
      });
    });
    $$(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        const backdrop = btn.closest(".modal-backdrop");
        if (backdrop) {
          backdrop.classList.remove("open");
          backdrop.setAttribute("aria-hidden", "true");
        }
      });
    });
  }

  // ========== Tab 切换 ==========
  function switchTab(tab) {
    state.currentTab = tab;
    $$(".admin-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.adminTab === tab);
    });
    $$(".admin-tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `admin-tab-${tab}`);
    });
    // 刷新对应Tab的数据
    if (tab === "dashboard") renderDashboard();
    if (tab === "withdraw") renderWithdrawList();
    if (tab === "payments") renderPaymentList();
    if (tab === "codes") renderCodesList();
    if (tab === "wallet") renderWalletRecords();
    if (tab === "members") renderMemberRecords();
    if (tab === "settings") loadSettings();
  }

  // ========== 数据概览 ==========
  function renderDashboard() {
    const withdrawals = getWithdrawals();
    const codes = getCodes();
    const wallet = getWallet();
    const member = getMemberState();
    const payments = getPayments();

    const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
    const approvedTotal = withdrawals
      .filter((w) => w.status === "approved")
      .reduce((s, w) => s + Number(w.actualAmount), 0);
    const availableCodes = codes.filter((c) => !c.used && new Date(c.expireAt) > new Date()).length;
    const reviewingPayments = payments.filter((p) => p.status === "pending" || p.status === "reviewing");
    const paidTotal = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + Number(p.receivedAmount || p.amount), 0);

    const paymentBadge = $("#payment-badge");
    if (paymentBadge) {
      const reviewingCount = payments.filter((p) => p.status === "reviewing").length;
      paymentBadge.textContent = reviewingCount;
      paymentBadge.hidden = reviewingCount === 0;
    }

    const stats = [
      { label: "待确认到账", value: reviewingPayments.length, unit: "笔", icon: "receipt" },
      { label: "已到账金额", value: `¥${paidTotal.toFixed(2)}`, icon: "banknote" },
      { label: "待审核提现", value: pendingCount, unit: "笔", icon: "clock" },
      { label: "钱包余额", value: `¥${Number(wallet.balance).toFixed(2)}`, icon: "wallet" }
    ];

    $("#dashboard-stats").innerHTML = stats.map((s) => `
      <div class="admin-stat-card">
        <span class="stat-label">${s.label}</span>
        <strong class="stat-value">${s.value}</strong>
        ${s.unit ? `<span class="stat-unit">${s.unit}</span>` : ""}
      </div>
    `).join("");
  }

  // ========== 提现审核 ==========
  function methodName(method) {
    const map = { wechat: "微信", alipay: "支付宝", bank: "银行卡" };
    return map[method] || method;
  }

  function renderWithdrawList() {
    const withdrawals = getWithdrawals();
    const config = getWithdrawConfig();

    const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
    const approvedTotal = withdrawals
      .filter((w) => w.status === "approved")
      .reduce((s, w) => s + Number(w.actualAmount), 0);

    $("#stat-pending").textContent = pendingCount;
    $("#stat-approved").textContent = `¥${approvedTotal.toFixed(2)}`;
    $("#stat-total").textContent = withdrawals.length;

    // 更新导航角标
    const badge = $("#pending-badge");
    if (pendingCount > 0) {
      badge.hidden = false;
      badge.textContent = pendingCount;
    } else {
      badge.hidden = true;
    }

    // 过滤
    let list = withdrawals;
    if (state.withdrawFilter !== "all") {
      list = withdrawals.filter((w) => w.status === state.withdrawFilter);
    }

    const statusMap = {
      pending: { label: "待审核", class: "pending" },
      approved: { label: "已打款", class: "success" },
      rejected: { label: "已拒绝", class: "error" },
      cancelled: { label: "已撤销", class: "muted" }
    };

    if (list.length === 0) {
      $("#admin-withdraw-list").innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox"></i>
          <span>暂无提现申请</span>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: $("#admin-withdraw-list") });
      return;
    }

    $("#admin-withdraw-list").innerHTML = list.map((w) => {
      const st = statusMap[w.status] || { label: w.status, class: "" };
      return `
        <div class="withdraw-item">
          <div class="withdraw-item-head">
            <span class="withdraw-id">${w.id}</span>
            <span class="withdraw-status ${st.class}">${st.label}</span>
          </div>
          <div class="withdraw-item-body">
            <div class="withdraw-row">
              <span>申请人</span>
              <em>${w.realName || "-"}</em>
            </div>
            <div class="withdraw-row">
              <span>提现金额</span>
              <strong>¥${Number(w.amount).toFixed(2)}</strong>
            </div>
            <div class="withdraw-row">
              <span>手续费</span>
              <em>¥${Number(w.fee).toFixed(2)}</em>
            </div>
            <div class="withdraw-row">
              <span>实发金额</span>
              <strong class="text-accent">¥${Number(w.actualAmount).toFixed(2)}</strong>
            </div>
            <div class="withdraw-row">
              <span>提现方式</span>
              <em>${methodName(w.method)}</em>
            </div>
            <div class="withdraw-row">
              <span>收款账号</span>
              <em>${w.account}</em>
            </div>
            <div class="withdraw-row">
              <span>申请时间</span>
              <em>${new Date(w.createdAt).toLocaleString("zh-CN")}</em>
            </div>
            ${w.note ? `
              <div class="withdraw-row">
                <span>用户备注</span>
                <em>${w.note}</em>
              </div>
            ` : ""}
          </div>
          ${w.status === "pending" ? `
            <div class="admin-withdraw-actions">
              <button class="button primary small" data-approve-withdraw="${w.id}" type="button">
                <i data-lucide="check"></i>同意打款
              </button>
              <button class="button ghost small" data-reject-withdraw="${w.id}" type="button">
                <i data-lucide="x"></i>拒绝
              </button>
            </div>
          ` : w.processNote ? `
            <div class="withdraw-item-foot">
              <span class="process-note">处理备注：${w.processNote}</span>
            </div>
          ` : ""}
        </div>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons({ root: $("#admin-withdraw-list") });
  }

  function approveWithdraw(id) {
    state.reviewAction = "approve";
    state.reviewWithdrawId = id;
    const withdrawals = getWithdrawals();
    const w = withdrawals.find((item) => item.id === id);
    if (!w) return;

    $("#review-action-label").textContent = "同意打款";
    $("#review-title").textContent = "确认打款";
    $("#review-body").innerHTML = `
      <p>确认已向 <strong>${w.realName || "-"}</strong> 的 ${methodName(w.method)} 账户 <strong>${w.account}</strong> 打款 <strong class="text-accent">¥${Number(w.actualAmount).toFixed(2)}</strong> ？</p>
      <div class="form-row" style="margin-top: 16px;">
        <label>处理备注（选填）</label>
        <input type="text" id="review-note" placeholder="请输入处理备注">
      </div>
    `;
    $("#review-confirm-btn").className = "button primary";
    openModal("review-modal");
  }

  function rejectWithdraw(id) {
    state.reviewAction = "reject";
    state.reviewWithdrawId = id;
    const withdrawals = getWithdrawals();
    const w = withdrawals.find((item) => item.id === id);
    if (!w) return;

    $("#review-action-label").textContent = "拒绝申请";
    $("#review-title").textContent = "拒绝提现";
    $("#review-body").innerHTML = `
      <p>确认拒绝 <strong>${w.realName || "-"}</strong> 的提现申请 <strong>¥${Number(w.amount).toFixed(2)}</strong>？</p>
      <p style="color: var(--muted); font-size: 12px;">拒绝后金额将退回用户钱包余额。</p>
      <div class="form-row" style="margin-top: 16px;">
        <label>拒绝原因</label>
        <input type="text" id="review-note" placeholder="请输入拒绝原因">
      </div>
    `;
    $("#review-confirm-btn").className = "button danger";
    openModal("review-modal");
  }

  function confirmReview() {
    const id = state.reviewWithdrawId;
    const action = state.reviewAction;
    if (!id || !action) return;

    const note = $("#review-note")?.value?.trim() || "";
    const withdrawals = getWithdrawals();
    const idx = withdrawals.findIndex((w) => w.id === id);
    if (idx === -1) return;

    const w = withdrawals[idx];

    if (action === "approve") {
      w.status = "approved";
      w.processNote = note || "已完成打款";
      w.approvedAt = new Date().toISOString();
    } else if (action === "reject") {
      w.status = "rejected";
      w.processNote = note || "审核未通过";
      w.rejectedAt = new Date().toISOString();
      // 退回余额
      const wallet = getWallet();
      wallet.balance = Number((Number(wallet.balance) + Number(w.amount)).toFixed(2));
      wallet.records.unshift({
        id: `rec-${Date.now()}`,
        type: "refund",
        amount: Number(w.amount),
        balance: wallet.balance,
        description: `提现驳回退款 ${w.id}`,
        createdAt: new Date().toISOString()
      });
      wallet.records = wallet.records.slice(0, 100);
      saveWallet(wallet);
    }

    withdrawals[idx] = w;
    saveWithdrawals(withdrawals);
    closeModal("review-modal");
    renderWithdrawList();
    renderDashboard();
    showToast(action === "approve" ? "已确认打款" : "已拒绝申请", "check");
  }

  // ========== 到账确认 ==========
  const PAYMENT_STATUS_MAP = {
    pending: { label: "待支付", class: "pending" },
    reviewing: { label: "待确认到账", class: "reviewing" },
    paid: { label: "已到账", class: "approved" },
    failed: { label: "到账失败", class: "rejected" },
    cancelled: { label: "已取消", class: "cancelled" },
    refunded: { label: "已退款", class: "cancelled" },
    expired: { label: "已过期", class: "cancelled" }
  };

  function renderPaymentList() {
    const payments = getPayments();
    const filter = state.paymentFilter || "all";

    let list = payments;
    if (filter !== "all") {
      list = payments.filter((p) => p.status === filter);
    }

    const reviewing = payments.filter((p) => p.status === "reviewing");
    const paid = payments.filter((p) => p.status === "paid");
    const failed = payments.filter((p) => p.status === "failed");

    const paidTotal = paid.reduce((s, p) => s + Number(p.receivedAmount || p.amount), 0);

    const elReviewing = $("#stat-payment-reviewing");
    const elPaid = $("#stat-payment-paid");
    const elFailed = $("#stat-payment-failed");
    if (elReviewing) elReviewing.textContent = reviewing.length;
    if (elPaid) elPaid.textContent = `¥${paidTotal.toFixed(2)}`;
    if (elFailed) elFailed.textContent = failed.length;

    const badge = $("#payment-badge");
    if (badge) {
      badge.textContent = reviewing.length;
      badge.hidden = reviewing.length === 0;
    }

    const listEl = $("#admin-payment-list");
    if (!listEl) return;

    if (list.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="receipt"></i>
          <span>暂无支付订单</span>
        </div>`;
      if (window.lucide) lucide.createIcons();
      return;
    }

    listEl.innerHTML = list.slice(0, 100).map((p) => {
      const st = PAYMENT_STATUS_MAP[p.status] || { label: p.status, class: "" };
      const created = new Date(p.createdAt).toLocaleString("zh-CN");
      const paid = p.paidAt ? new Date(p.paidAt).toLocaleString("zh-CN") : null;
      const methodIcon = p.method === "wechat" ? "message-circle" : "credit-card";
      const methodName = p.method === "wechat" ? "微信支付" : "支付宝";
      const receivedAmount = p.receivedAmount != null ? Number(p.receivedAmount).toFixed(2) : null;
      const orderAmount = Number(p.amount).toFixed(2);
      const canConfirm = p.status === "pending" || p.status === "reviewing";
      const canFail = p.status === "pending" || p.status === "reviewing";

      return `
        <div class="payment-item ${st.class}">
          <div class="payment-item-head">
            <div class="payment-order-no">
              <i data-lucide="${methodIcon}" style="width:16px;height:16px"></i>
              <span>${p.orderNo}</span>
            </div>
            <span class="payment-status ${st.class}">${st.label}</span>
          </div>
          <div class="payment-item-body">
            <div class="payment-row">
              <span>套餐</span>
              <em>${p.planName || "-"}</em>
            </div>
            <div class="payment-row">
              <span>支付方式</span>
              <em>${methodName}</em>
            </div>
            <div class="payment-row">
              <span>订单金额</span>
              <strong>¥${orderAmount}</strong>
            </div>
            ${receivedAmount ? `
            <div class="payment-row">
              <span>到账金额</span>
              <strong class="text-accent">¥${receivedAmount}</strong>
            </div>` : ""}
            <div class="payment-row">
              <span>创建时间</span>
              <em>${created}</em>
            </div>
            ${paid ? `
            <div class="payment-row">
              <span>到账时间</span>
              <em>${paid}</em>
            </div>` : ""}
            ${p.activated ? `
            <div class="payment-row">
              <span>会员状态</span>
              <strong class="text-accent">已自动解锁</strong>
            </div>` : ""}
            ${p.failReason ? `
            <div class="payment-row">
              <span>失败原因</span>
              <em style="color:var(--danger)">${p.failReason}</em>
            </div>` : ""}
          </div>
          ${canConfirm || canFail ? `
          <div class="payment-item-actions">
            ${canConfirm ? `
            <div class="payment-confirm-row">
              <input type="number" class="payment-amount-input" placeholder="输入实际到账金额" step="0.01" min="0" data-payment-order="${p.orderNo}" />
              <button class="button primary small" data-confirm-payment="${p.orderNo}" type="button">
                <i data-lucide="check-circle"></i>确认到账
              </button>
            </div>` : ""}
            ${canFail ? `
            <button class="button ghost small" data-fail-payment="${p.orderNo}" type="button" style="margin-top:8px">
              <i data-lucide="x-circle"></i>标记未到账
            </button>` : ""}
          </div>` : ""}
        </div>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons();

    // 绑定确认到账按钮
    $$("[data-confirm-payment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderNo = btn.dataset.confirmPayment;
        const input = $(`[data-payment-order="${orderNo}"]`);
        const amount = input ? input.value : "";
        handleConfirmPayment(orderNo, amount);
      });
    });

    // 绑定标记失败按钮
    $$("[data-fail-payment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const orderNo = btn.dataset.failPayment;
        handleFailPayment(orderNo);
      });
    });
  }

  function handleConfirmPayment(orderNo, receivedAmountStr) {
    const amount = Number(receivedAmountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("请输入有效的到账金额", "alert");
      return;
    }

    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) {
      showToast("订单不存在", "alert");
      return;
    }

    const order = payments[idx];
    const orderAmount = Number(order.amount);

    // 金额不足，无法解锁
    if (amount < orderAmount) {
      order.status = "failed";
      order.receivedAmount = amount;
      order.failReason = `到账金额不足：需 ¥${orderAmount.toFixed(2)}，实到 ¥${amount.toFixed(2)}`;
      order.failedAt = Date.now();
      payments[idx] = order;
      savePayments(payments);
      renderPaymentList();
      renderDashboard();
      showToast(`到账金额不足（¥${amount.toFixed(2)} < ¥${orderAmount.toFixed(2)}），无法解锁`, "alert");
      return;
    }

    // 金额匹配，确认到账并自动解锁会员
    order.status = "paid";
    order.paidAt = Date.now();
    order.receivedAmount = amount;

    // 自动激活会员
    const member = getMemberState();
    const base = (member && !member.expired && member.expireAt) ? member.expireAt : Date.now();
    const plan = MEMBER_PLANS[order.planKey] || { key: order.planKey, name: order.planName, days: 30 };

    const nextMember = {
      plan: plan.key,
      planName: plan.name,
      activatedAt: Date.now(),
      expireAt: base + plan.days * 86400000,
      source: `支付订单 ${orderNo}（到账 ¥${amount.toFixed(2)}）`
    };
    setStorage(STORAGE_KEYS.member, nextMember);

    // 记录会员开通记录
    const records = getMemberRecords();
    records.unshift({
      userId: order.userId || "local-user",
      userName: order.userName || "本地用户",
      plan: plan.key,
      planName: plan.name,
      days: plan.days,
      activatedAt: Date.now(),
      createdAt: Date.now(),
      source: "payment",
      orderNo: orderNo,
      receivedAmount: amount
    });
    setStorage(STORAGE_KEYS.memberRecords, records.slice(0, 200));

    order.activated = true;
    payments[idx] = order;
    savePayments(payments);

    renderPaymentList();
    renderDashboard();
    showToast(`到账 ¥${amount.toFixed(2)} 确认成功，会员已自动解锁`, "check");
  }

  function handleFailPayment(orderNo) {
    if (!confirm("确认标记此订单为未到账？用户将无法解锁会员。")) return;

    const payments = getPayments();
    const idx = payments.findIndex((p) => p.orderNo === orderNo);
    if (idx === -1) return;

    const order = payments[idx];
    if (order.status !== "pending" && order.status !== "reviewing") return;

    order.status = "failed";
    order.failReason = "管理员确认未收到款项";
    order.failedAt = Date.now();
    payments[idx] = order;
    savePayments(payments);

    renderPaymentList();
    renderDashboard();
    showToast("已标记为未到账", "alert");
  }

  // ========== 卡密管理 ==========
  function generateCode(plan, expireDays) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const segments = [];
    for (let s = 0; s < 3; s++) {
      let seg = "";
      for (let i = 0; i < 5; i++) {
        seg += chars[Math.floor(Math.random() * chars.length)];
      }
      segments.push(seg);
    }
    const prefix = "XJ";
    return `${prefix}-${segments[0]}.${segments[1]}-${segments[2]}`;
  }

  function generateBatchCodes(planKey, count, expireDays) {
    const plan = MEMBER_PLANS[planKey];
    if (!plan) return [];
    const codes = getCodes();
    const now = new Date();
    const expireAt = new Date(now.getTime() + expireDays * 24 * 60 * 60 * 1000).toISOString();
    const newCodes = [];
    for (let i = 0; i < count; i++) {
      const code = {
        id: `code-${Date.now()}-${i}`,
        code: generateCode(),
        plan: planKey,
        planName: plan.name,
        days: plan.days,
        price: plan.price,
        used: false,
        usedBy: null,
        usedAt: null,
        createdAt: now.toISOString(),
        expireAt
      };
      newCodes.push(code);
      codes.unshift(code);
    }
    saveCodes(codes);
    return newCodes;
  }

  function renderCodesList() {
    const codes = getCodes();
    const now = new Date();

    const available = codes.filter((c) => !c.used && new Date(c.expireAt) > now);
    const used = codes.filter((c) => c.used);
    const expired = codes.filter((c) => !c.used && new Date(c.expireAt) <= now);

    $("#stat-codes-available").textContent = available.length;
    $("#stat-codes-used").textContent = used.length;
    $("#stat-codes-expired").textContent = expired.length;

    let list = codes;
    if (state.codeFilter === "available") list = available;
    else if (state.codeFilter === "used") list = used;
    else if (state.codeFilter === "expired") list = expired;

    if (list.length === 0) {
      $("#admin-code-list").innerHTML = `
        <div class="empty-state">
          <i data-lucide="key"></i>
          <span>暂无卡密</span>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: $("#admin-code-list") });
      return;
    }

    $("#admin-code-list").innerHTML = list.map((c) => {
      let status = "available";
      let statusLabel = "未使用";
      if (c.used) { status = "used"; statusLabel = "已使用"; }
      else if (new Date(c.expireAt) <= now) { status = "expired"; statusLabel = "已过期"; }

      return `
        <div class="code-item">
          <div class="code-main">
            <div class="code-value">${c.code}</div>
            <div class="code-meta">
              ${c.planName} · ${c.days}天 · ¥${c.price}
              ${c.used ? ` · 使用人：${c.usedBy || "-"}` : ""}
              · 生成：${new Date(c.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </div>
          <span class="code-status ${status}">${statusLabel}</span>
          ${!c.used ? `<button class="code-copy-btn" data-copy-code="${c.code}" type="button" title="复制">
            <i data-lucide="copy"></i>
          </button>` : ""}
        </div>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons({ root: $("#admin-code-list") });
  }

  // ========== 余额管理 ==========
  function renderWalletRecords() {
    const wallet = getWallet();
    const records = wallet.records || [];

    if (records.length === 0) {
      $("#admin-wallet-records").innerHTML = `
        <div class="empty-state">
          <i data-lucide="wallet"></i>
          <span>暂无流水记录</span>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: $("#admin-wallet-records") });
      return;
    }

    const typeMap = {
      recharge: { label: "充值", class: "income", icon: "plus-circle" },
      income: { label: "收入", class: "income", icon: "arrow-down-left" },
      withdraw: { label: "提现", class: "expense", icon: "arrow-up-right" },
      refund: { label: "退款", class: "income", icon: "rotate-ccw" },
      deduct: { label: "扣款", class: "expense", icon: "minus-circle" },
      admin_recharge: { label: "管理员充值", class: "income", icon: "shield-check" },
      admin_deduct: { label: "管理员扣款", class: "expense", icon: "shield-alert" }
    };

    $("#admin-wallet-records").innerHTML = records.slice(0, 50).map((r) => {
      const t = typeMap[r.type] || { label: r.type, class: "", icon: "circle" };
      return `
        <div class="wallet-record">
          <div class="wallet-record-icon ${t.class}">
            <i data-lucide="${t.icon}"></i>
          </div>
          <div class="wallet-record-info">
            <strong>${t.label}</strong>
            <small>${r.description || ""}</small>
          </div>
          <div class="wallet-record-amount ${t.class}">
            ${t.class === "income" ? "+" : "-"}¥${Number(r.amount).toFixed(2)}
          </div>
          <div class="wallet-record-balance">
            余额 ¥${Number(r.balance).toFixed(2)}
          </div>
          <div class="wallet-record-time">
            ${new Date(r.createdAt).toLocaleString("zh-CN")}
          </div>
        </div>
      `;
    }).join("");

    if (window.lucide) lucide.createIcons({ root: $("#admin-wallet-records") });
  }

  function handleWalletOp() {
    const amount = Number($("#wallet-amount").value);
    const reason = $("#wallet-reason").value.trim();
    const userId = $("#wallet-user-id").value.trim() || "本地用户";

    if (!amount || amount <= 0) {
      $("#wallet-feedback").textContent = "请输入有效金额";
      $("#wallet-feedback").className = "redeem-feedback error";
      return;
    }

    const wallet = getWallet();
    const op = state.walletOp;

    if (op === "deduct" && amount > wallet.balance) {
      $("#wallet-feedback").textContent = "扣款金额不能超过当前余额";
      $("#wallet-feedback").className = "redeem-feedback error";
      return;
    }

    if (op === "recharge") {
      wallet.balance = Number((Number(wallet.balance) + amount).toFixed(2));
      wallet.records.unshift({
        id: `rec-${Date.now()}`,
        type: "admin_recharge",
        amount,
        balance: wallet.balance,
        description: reason || `管理员充值（${userId}）`,
        createdAt: new Date().toISOString()
      });
    } else {
      wallet.balance = Number((Number(wallet.balance) - amount).toFixed(2));
      wallet.records.unshift({
        id: `rec-${Date.now()}`,
        type: "admin_deduct",
        amount,
        balance: wallet.balance,
        description: reason || `管理员扣款（${userId}）`,
        createdAt: new Date().toISOString()
      });
    }

    wallet.records = wallet.records.slice(0, 100);
    saveWallet(wallet);

    $("#wallet-feedback").textContent = op === "recharge" ? "充值成功" : "扣款成功";
    $("#wallet-feedback").className = "redeem-feedback success";
    $("#wallet-amount").value = "";
    $("#wallet-reason").value = "";

    renderWalletRecords();
    renderDashboard();
    showToast(op === "recharge" ? "充值成功" : "扣款成功", "check");

    setTimeout(() => {
      $("#wallet-feedback").textContent = "";
      $("#wallet-feedback").className = "redeem-feedback";
    }, 2000);
  }

  // ========== 会员记录 ==========
  function renderMemberRecords() {
    const records = getMemberRecords();

    if (records.length === 0) {
      $("#admin-member-records").innerHTML = `
        <div class="empty-state">
          <i data-lucide="users"></i>
          <span>暂无会员记录</span>
        </div>`;
      if (window.lucide) lucide.createIcons({ root: $("#admin-member-records") });
      return;
    }

    $("#admin-member-records").innerHTML = records.slice(0, 50).map((r) => `
      <div class="member-record-item">
        <div class="member-record-info">
          <div class="member-record-name">${r.userName || r.userId || "用户"}</div>
          <div class="member-record-meta">
            ${r.planName || ""} · ${r.days || 0}天 · 激活时间：${new Date(r.activatedAt || r.createdAt).toLocaleString("zh-CN")}
          </div>
        </div>
        <span class="member-record-plan">${r.planName || "会员"}</span>
      </div>
    `).join("");

    if (window.lucide) lucide.createIcons({ root: $("#admin-member-records") });
  }

  // ========== 系统设置 ==========
  function loadSettings() {
    const config = getWithdrawConfig();
    $("#cfg-min-amount").value = config.minAmount;
    $("#cfg-daily-limit").value = config.dailyLimit;
    $("#cfg-fee-rate").value = config.feeRate * 100;
    $("#cfg-fee-min").value = config.feeMin;
    $("#cfg-fee-max").value = config.feeMax;
    $("#cfg-pending-hours").value = config.pendingHours;
  }

  function saveSettings() {
    const adminConfig = getAdminConfig();
    adminConfig.withdrawConfig = {
      minAmount: Number($("#cfg-min-amount").value) || 10,
      dailyLimit: Number($("#cfg-daily-limit").value) || 5000,
      feeRate: Number($("#cfg-fee-rate").value) / 100 || 0.01,
      feeMin: Number($("#cfg-fee-min").value) || 1,
      feeMax: Number($("#cfg-fee-max").value) || 50,
      pendingHours: Number($("#cfg-pending-hours").value) || 24
    };
    saveAdminConfig(adminConfig);
    $("#cfg-feedback").textContent = "配置已保存";
    $("#cfg-feedback").className = "redeem-feedback success";
    showToast("配置已保存", "check");
    setTimeout(() => {
      $("#cfg-feedback").textContent = "";
      $("#cfg-feedback").className = "redeem-feedback";
    }, 2000);
  }

  function changePassword() {
    const current = $("#pwd-current").value;
    const newPwd = $("#pwd-new").value;
    const confirm = $("#pwd-confirm").value;

    const config = getAdminConfig();

    if (current !== config.password) {
      $("#pwd-feedback").textContent = "当前密码不正确";
      $("#pwd-feedback").className = "redeem-feedback error";
      return;
    }
    if (!newPwd || newPwd.length < 6) {
      $("#pwd-feedback").textContent = "新密码至少6位";
      $("#pwd-feedback").className = "redeem-feedback error";
      return;
    }
    if (newPwd !== confirm) {
      $("#pwd-feedback").textContent = "两次输入的新密码不一致";
      $("#pwd-feedback").className = "redeem-feedback error";
      return;
    }

    config.password = newPwd;
    saveAdminConfig(config);

    $("#pwd-feedback").textContent = "密码修改成功";
    $("#pwd-feedback").className = "redeem-feedback success";
    $("#pwd-current").value = "";
    $("#pwd-new").value = "";
    $("#pwd-confirm").value = "";
    showToast("密码修改成功", "check");

    setTimeout(() => {
      $("#pwd-feedback").textContent = "";
      $("#pwd-feedback").className = "redeem-feedback";
    }, 2000);
  }

  // ========== 数据导入导出 ==========
  function exportAllData() {
    const data = {};
    Object.keys(STORAGE_KEYS).forEach((key) => {
      data[STORAGE_KEYS[key]] = getStorage(STORAGE_KEYS[key], null);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xuanjian-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("数据已导出", "download");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        Object.keys(data).forEach((key) => {
          if (data[key] !== null && data[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });
        showToast("数据导入成功", "upload");
        // 刷新各页面数据
        renderDashboard();
        renderWithdrawList();
        renderCodesList();
        renderWalletRecords();
        renderMemberRecords();
        loadSettings();
      } catch (err) {
        showToast("导入失败：文件格式错误", "x");
      }
    };
    reader.readAsText(file);
  }

  function clearAllData() {
    if (!confirm("确定要清空全部数据吗？此操作不可逆！")) return;
    if (!confirm("再次确认：所有会员、卡密、提现、钱包数据将被全部清空！")) return;

    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    showToast("数据已清空", "trash-2");
    setTimeout(() => {
      location.reload();
    }, 1000);
  }

  // ========== 导出提现记录 ==========
  function exportWithdrawals() {
    const withdrawals = getWithdrawals();
    let list = withdrawals;
    if (state.withdrawFilter !== "all") {
      list = withdrawals.filter((w) => w.status === state.withdrawFilter);
    }

    const statusMap = {
      pending: "待审核",
      approved: "已打款",
      rejected: "已拒绝",
      cancelled: "已撤销"
    };

    const header = "申请编号,申请人,提现方式,收款账号,金额,手续费,实发,状态,申请时间,备注\n";
    const rows = list.map((w) => [
      w.id,
      w.realName || "",
      methodName(w.method),
      w.account,
      w.amount,
      w.fee,
      w.actualAmount,
      statusMap[w.status] || w.status,
      new Date(w.createdAt).toLocaleString("zh-CN"),
      (w.note || "").replace(/,/g, "，")
    ].join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("导出成功", "download");
  }

  // ========== 事件绑定 ==========
  function bindEvents() {
    // 登录
    $("#admin-login-btn").addEventListener("click", () => {
      const pwd = $("#admin-password").value;
      if (login(pwd)) {
        $("#admin-login").style.display = "none";
        $("#admin-app").hidden = false;
        renderDashboard();
        if (window.lucide) lucide.createIcons();
      } else {
        $("#admin-login-hint").textContent = "密码错误，请重试";
      }
    });

    $("#admin-password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("#admin-login-btn").click();
    });

    // 退出
    $("#admin-logout-btn").addEventListener("click", logout);

    // 侧边栏导航
    $$(".admin-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        const tab = item.dataset.adminTab;
        if (tab) switchTab(tab);
      });
    });

    // 提现过滤
    $("#withdraw-status-filter").addEventListener("change", (e) => {
      state.withdrawFilter = e.target.value;
      renderWithdrawList();
    });

    // 支付订单过滤
    const paymentFilter = $("#payment-status-filter");
    if (paymentFilter) {
      paymentFilter.addEventListener("change", (e) => {
        state.paymentFilter = e.target.value;
        renderPaymentList();
      });
    }

    // 提现列表操作（事件委托）
    $("#admin-withdraw-list").addEventListener("click", (e) => {
      const approveBtn = e.target.closest("[data-approve-withdraw]");
      const rejectBtn = e.target.closest("[data-reject-withdraw]");
      if (approveBtn) approveWithdraw(approveBtn.dataset.approveWithdraw);
      if (rejectBtn) rejectWithdraw(rejectBtn.dataset.rejectWithdraw);
    });

    // 审核确认
    $("#review-confirm-btn").addEventListener("click", confirmReview);

    // 导出提现
    $("#withdraw-export-btn").addEventListener("click", exportWithdrawals);

    // 生成卡密
    $("#gen-code-btn").addEventListener("click", () => {
      $("#gen-code-feedback").textContent = "";
      $("#gen-code-feedback").className = "redeem-feedback";
      openModal("gen-code-modal");
    });

    $("#gen-code-confirm-btn").addEventListener("click", () => {
      const plan = $("#gen-code-plan").value;
      const count = Math.min(Math.max(Number($("#gen-code-count").value) || 1, 1), 100);
      const expireDays = Math.max(Number($("#gen-code-expire").value) || 365, 1);

      const newCodes = generateBatchCodes(plan, count, expireDays);
      $("#gen-code-feedback").textContent = `成功生成 ${newCodes.length} 张卡密`;
      $("#gen-code-feedback").className = "redeem-feedback success";

      renderCodesList();
      renderDashboard();
      showToast(`成功生成 ${newCodes.length} 张卡密`, "key");

      setTimeout(() => closeModal("gen-code-modal"), 1000);
    });

    // 卡密过滤
    $("#code-status-filter").addEventListener("change", (e) => {
      state.codeFilter = e.target.value;
      renderCodesList();
    });

    // 复制卡密
    $("#admin-code-list").addEventListener("click", (e) => {
      const copyBtn = e.target.closest("[data-copy-code]");
      if (copyBtn) {
        const code = copyBtn.dataset.copyCode;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => showToast("已复制卡密", "copy"));
        } else {
          const ta = document.createElement("textarea");
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          showToast("已复制卡密", "copy");
        }
      }
    });

    // 钱包操作类型
    $$("[data-wallet-op]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.walletOp = btn.dataset.walletOp;
        $$("[data-wallet-op]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    // 钱包操作提交
    $("#wallet-submit-btn").addEventListener("click", handleWalletOp);

    // 设置保存
    $("#cfg-save-btn").addEventListener("click", saveSettings);

    // 修改密码
    $("#pwd-change-btn").addEventListener("click", changePassword);

    // 数据管理
    $("#export-all-data-btn").addEventListener("click", exportAllData);
    $("#import-all-data-btn").addEventListener("click", () => {
      $("#import-file-input").click();
    });
    $("#import-file-input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importData(file);
      e.target.value = "";
    });
    $("#clear-all-data-btn").addEventListener("click", clearAllData);

    // 模态框关闭
    bindModalClose();
  }

  // ========== 初始化 ==========
  function init() {
    bindEvents();

    if (isLoggedIn()) {
      $("#admin-login").style.display = "none";
      $("#admin-app").hidden = false;
      renderDashboard();
    } else {
      $("#admin-login").style.display = "flex";
    }

    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
