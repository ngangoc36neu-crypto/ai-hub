/* ============================================
   APERO AI HUB — JavaScript (v3.0)
   Auth-aware: session từ localStorage
   Load order: supabase.js → main.js → inline
   ============================================ */

/* ===== APPS SCRIPT WEB APP URL =====
   Dán URL từ Apps Script → Deploy → Manage deployments vào đây
   ===== */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbygM0Gb_DCNG4qn9E--S-XPt1GNjQ4BGy3Lg-V8Kupp828au1qRelcNKP0sciznQpIBtg/exec';

/* ===== ICON HELPERS ===== */
const STAR_ICON = `<span style="color:var(--amber);">★</span>`;
const FORK_ICON = `<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle;opacity:0.75"><path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"/></svg>`;

/* ============================================
   AUTH SYSTEM
   - Email hợp lệ: @apero.vn hoặc @talent.apero.vn
   - Role hierarchy: Contributor < Curator < Hub Owner
   - Session lưu trong localStorage
   ============================================ */

const AUTH_KEY      = 'apero_hub_user';
const VALID_DOMAINS = ['@apero.vn', '@talent.apero.vn'];
const ROLE_LEVELS   = { 'Contributor': 1, 'Curator': 2, 'Hub Owner': 3 };

/* Đọc session */
function getSessionUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
  catch { return null; }
}

/* Lưu session sau khi login */
function setSessionUser(dbUser) {
  const words    = (dbUser.full_name || '').split(' ').filter(Boolean);
  const initials = words.map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const session  = {
    id:        dbUser.id,
    name:      dbUser.full_name,   // alias để tương thích code cũ
    full_name: dbUser.full_name,
    initials,
    email:     dbUser.email,
    team:      dbUser.team,
    role:      dbUser.role,
    is_active: dbUser.is_active
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
}

/* Đăng xuất */
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'login.html';
}

/* Kiểm tra domain email hợp lệ */
function isValidDomain(email) {
  return VALID_DOMAINS.some(d => (email || '').toLowerCase().endsWith(d));
}

/* Kiểm tra role tối thiểu */
function hasRole(minRole) {
  const u = getSessionUser();
  if (!u) return false;
  return (ROLE_LEVELS[u.role] || 0) >= (ROLE_LEVELS[minRole] || 0);
}

/* Guard: yêu cầu đăng nhập (redirect nếu chưa) */
function requireAuth() {
  const u = getSessionUser();
  if (!u) { window.location.href = 'login.html'; return null; }
  return u;
}

/* Guard: yêu cầu role tối thiểu */
function requireRole(minRole) {
  const u = requireAuth();
  if (!u) return null;
  if (!hasRole(minRole)) {
    showToast('Bạn không có quyền truy cập trang này.', 't-error');
    setTimeout(() => { window.location.href = 'library.html'; }, 1500);
    return null;
  }
  return u;
}

/* ===== CURRENT_USER — tương thích ngược với code cũ =====
   Luôn phản ánh user đang đăng nhập.
   Inline scripts dùng CURRENT_USER.name/.email/.team/.role vẫn hoạt động. */
const _session = getSessionUser();
let CURRENT_USER = _session || {
  id: null, name: '', full_name: '', initials: '?',
  email: '', team: '', role: 'Contributor', is_active: true
};

/* ============================================
   AUTO AUTH GUARD
   Tự động redirect sang login.html nếu chưa login
   (trừ trang login.html chính nó)
   ============================================ */
(function autoGuard() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'login.html') return;          // bỏ qua trang login
  if (!getSessionUser()) {
    window.location.href = 'login.html';
  }
})();

/* ============================================
   SIDEBAR — cập nhật động theo user đang login
   ============================================ */
function initSidebar() {
  const u = getSessionUser();
  if (!u) return;

  /* Avatar + tên + role */
  const footerAvatar = document.querySelector('.sidebar-footer .avatar');
  const footerName   = document.querySelector('.sidebar-footer .av-name');
  const footerSub    = document.querySelector('.sidebar-footer .av-sub');
  if (footerAvatar) footerAvatar.textContent = u.initials;
  if (footerName)   footerName.textContent   = u.name;
  if (footerSub)    footerSub.textContent    = `${u.role} · ${u.team}`;

  /* Ẩn toàn bộ section Quản trị (Trang chủ + Curator Dashboard) nếu không đủ quyền */
  if (!hasRole('Curator')) {
    document.querySelectorAll('.sidebar-section-admin').forEach(el => el.style.display = 'none');
  }

  /* Thêm nút Logout vào sidebar footer */
  const footer = document.querySelector('.sidebar-footer');
  if (footer && !document.getElementById('logoutBtn')) {
    const btn = document.createElement('button');
    btn.id        = 'logoutBtn';
    btn.textContent = 'Đăng xuất';
    btn.onclick   = logout;
    btn.style.cssText = `
      width:100%; margin-top:10px; padding:8px 12px;
      background:rgba(248,113,113,0.10); border:1px solid rgba(248,113,113,0.25);
      border-radius:6px; color:var(--red); font-size:12px; font-weight:600;
      cursor:pointer; transition:background 0.15s;
    `;
    btn.onmouseenter = () => btn.style.background = 'rgba(248,113,113,0.20)';
    btn.onmouseleave = () => btn.style.background = 'rgba(248,113,113,0.10)';
    footer.appendChild(btn);
  }
}

/* Chạy initSidebar + initNotificationBell + injectFormModal sau khi DOM sẵn sàng */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initNotificationBell();
  injectFormModal();
});

/* ============================================
   GOOGLE FORM MODAL — dùng chung toàn app
   ============================================ */
function injectFormModal() {
  if (document.getElementById('globalFormModal')) return;
  const div = document.createElement('div');
  div.id = 'globalFormModal';
  div.style.cssText = 'display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.55);align-items:center;justify-content:center;';
  div.innerHTML = `
    <div style="background:#fff;border-radius:12px;width:min(780px,96vw);height:min(88vh,820px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
        <div style="font-size:15px;font-weight:700;color:#111;">📝 Submit Asset mới</div>
        <button onclick="closeFormModal()" style="background:none;border:none;cursor:pointer;font-size:22px;color:#6b7280;line-height:1;padding:2px 6px;" title="Đóng">×</button>
      </div>
      <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSfE1vjbDJ0YRN3C1KJiggVzNkGk_1P1YKWg8f8bX0Dbhuj68g/viewform?embedded=true"
        style="flex:1;border:none;width:100%;" frameborder="0" marginheight="0" marginwidth="0">Đang tải...</iframe>
    </div>`;
  div.addEventListener('click', e => { if (e.target === div) closeFormModal(); });
  document.body.appendChild(div);
}

function openFormModal() {
  const m = document.getElementById('globalFormModal');
  if (m) { m.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeFormModal() {
  const m = document.getElementById('globalFormModal');
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

/* ============================================
   UI HELPERS (không thay đổi)
   ============================================ */
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function switchTab(groupId, tabId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tabId));
  group.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === tabId));
}

function getTypeBadge(type) {
  const map = {
    'Prompt':   't-prompt',
    'Skill':    't-prompt',
    'Tool':     't-tool',
    'Workflow': 't-workflow',
    'Template': 't-template',
    'Agent':    't-agent',
    'Use Case': 't-usecase'
  };
  return map[type] || 't-usecase';
}

function getStatusBadge(status) {
  const map = {
    'verified': '<span class="badge b-verified">Verified</span>',
    'pending':  '<span class="badge b-draft">Chờ duyệt</span>',
    'rejected': '<span class="badge b-rejected">Từ chối</span>',
    'draft':    '<span class="badge b-draft">Chờ duyệt</span>',
  };
  return map[status] || '';
}

function showLoading(elId, msg = 'Đang tải...') {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = `<div style="padding:20px;color:var(--text-2);text-align:center;">${msg}</div>`;
}

/* Close modal on backdrop / ESC */
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('show');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
});

/* ============================================
   NOTIFICATION BELL
   Tự inject vào .topbar-right của mọi trang
   ============================================ */

const NOTIF_READ_KEY = 'apero_notif_last_read';

function getLastReadTime() {
  return parseInt(localStorage.getItem(NOTIF_READ_KEY) || '0');
}
function setLastReadTime() {
  localStorage.setItem(NOTIF_READ_KEY, Date.now().toString());
}

let _notifOpen = false;

async function initNotificationBell() {
  const u = getSessionUser();
  if (!u || !u.id) return;
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  const wrap = document.createElement('div');
  wrap.className = 'notif-wrap';
  wrap.id = 'notifWrap';
  wrap.innerHTML = `
    <button class="notif-btn" id="notifBtn" onclick="toggleNotifDropdown()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      <span class="notif-count" id="notifCount" style="display:none;">0</span>
    </button>
    <div class="notif-dropdown" id="notifDropdown">
      <div class="notif-hd">
        <span>Thông báo</span>
        <button onclick="markAllNotifsRead()"
          style="font-size:11px;color:var(--blue);background:none;border:none;cursor:pointer;padding:0;">
          Đánh dấu đã đọc
        </button>
      </div>
      <div id="notifList"><div class="notif-empty">Đang tải...</div></div>
    </div>`;

  /* Chèn trước phần tử đầu tiên trong topbar-right */
  topbarRight.insertBefore(wrap, topbarRight.firstChild);

  /* Đóng dropdown khi click ra ngoài */
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      const dd = document.getElementById('notifDropdown');
      if (dd) dd.classList.remove('open');
      _notifOpen = false;
    }
  });

  await _refreshNotifications();
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  _notifOpen = !_notifOpen;
  dd.classList.toggle('open', _notifOpen);
}

async function _refreshNotifications() {
  const u = getSessionUser();
  if (!u || !u.id) return;
  try {
    const notifs  = await dbGetNotificationsForUser(u.id);
    const lastRead = getLastReadTime();
    const unread  = notifs.filter(n => new Date(n.time).getTime() > lastRead);

    const countEl = document.getElementById('notifCount');
    if (countEl) {
      if (unread.length > 0) {
        countEl.textContent = unread.length > 9 ? '9+' : unread.length;
        countEl.style.display = 'flex';
      } else {
        countEl.style.display = 'none';
      }
    }
    _renderNotifList(notifs, lastRead);
  } catch (err) {
    console.error('_refreshNotifications:', err);
    const el = document.getElementById('notifList');
    if (el) el.innerHTML = '<div class="notif-empty">Không thể tải thông báo.</div>';
  }
}

function _renderNotifList(notifs, lastRead) {
  const el = document.getElementById('notifList');
  if (!el) return;
  if (!notifs.length) {
    el.innerHTML = '<div class="notif-empty">Chưa có thông báo nào.</div>';
    return;
  }
  const icoMap = {
    approved: { cls: 'approved', html: '✓' },
    rejected: { cls: 'rejected', html: '✕' },
    star:     { cls: 'star',     html: '★' },
    fork:     { cls: 'fork',     html: '⑂' }
  };
  el.innerHTML = notifs.slice(0, 20).map(n => {
    const isUnread = new Date(n.time).getTime() > lastRead;
    const ico = icoMap[n.type] || { cls: '', html: '•' };
    return `
      <div class="notif-item${isUnread ? ' unread' : ''}">
        <div class="notif-icon ${ico.cls}">${ico.html}</div>
        <div class="notif-body">
          <div class="notif-title">${n.title}</div>
          ${n.sub ? `<div class="notif-sub">${n.sub}</div>` : ''}
          <div class="notif-time">${timeAgo(n.time)}</div>
        </div>
      </div>`;
  }).join('');
}

function markAllNotifsRead() {
  setLastReadTime();
  const countEl = document.getElementById('notifCount');
  if (countEl) countEl.style.display = 'none';
  document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
}

/* ============================================
   GAMING DETECTION HELPERS
   Dùng trong curator.html để phát hiện vi phạm
   ============================================ */

/**
 * Phân tích 1 star/fork và trả về mảng flag.
 * @param {Object} item     - row từ stars_log hoặc forks_log (đã JOIN users + assets)
 * @param {string} type     - 'star' | 'fork'
 * @param {Object} userStarCountMap - { user_id: số pending stars }
 * @returns {Array<{level:'high'|'medium'|'low', text:string}>}
 */
function detectGamingFlags(item, type, userStarCountMap) {
  const flags = [];

  if (type === 'star') {
    const reason    = (item.reason || '').trim();
    const reasonLen = reason.length;
    const userTeam  = item.users?.team  || '';
    const assetTeam = item.assets?.team || '';
    const ownerName = item.assets?.owner_name || '';
    const userName  = item.users?.full_name   || '';
    // cross-team: chỉ xét khi cả 2 team đều có giá trị hợp lệ
    const knownTeams = userTeam && assetTeam && userTeam !== '?' && assetTeam !== '?';
    const isCross    = knownTeams && userTeam !== assetTeam;
    const userId     = item.user_id;

    /* 1. Reason rỗng hoặc quá ngắn */
    if (reasonLen === 0)
      flags.push({ level: 'high',   text: 'Không có reason' });
    else if (reasonLen < 20)
      flags.push({ level: 'high',   text: `Reason quá ngắn (${reasonLen} ký tự)` });
    else if (reasonLen < 40)
      flags.push({ level: 'medium', text: `Reason hơi ngắn (${reasonLen} ký tự)` });

    /* 2. Cùng team với owner */
    if (knownTeams && !isCross)
      flags.push({ level: 'medium', text: `Cùng team với owner (${userTeam}) → reward 0₫` });

    /* 3. User star chính asset của mình */
    if (ownerName && userName && ownerName === userName)
      flags.push({ level: 'high', text: 'Star chính asset của bản thân!' });

    /* 4. Nhiều pending stars từ cùng 1 user trong batch này */
    const cnt = userStarCountMap?.[userId] || 0;
    if (cnt >= 4)
      flags.push({ level: 'high',   text: `${cnt} pending stars từ cùng user này` });
    else if (cnt >= 2)
      flags.push({ level: 'medium', text: `${cnt} pending stars từ cùng user này` });

    /* 5. Reason generic / copy-paste */
    const genericPhrases = ['tốt','hay','ok','good','nice','great','hay quá','tốt quá','👍','useful','hữu ích'];
    if (genericPhrases.includes(reason.toLowerCase()))
      flags.push({ level: 'high', text: 'Reason quá chung chung — không mô tả giá trị thực' });
  }

  if (type === 'fork') {
    const desc    = (item.fork_description || '').trim();
    const changes = (item.changes_made    || '').trim();
    const userTeam  = item.users?.team  || '';
    const assetTeam = item.assets?.team || '';
    const knownTeams = userTeam && assetTeam && userTeam !== '?' && assetTeam !== '?';
    const isCross    = knownTeams && userTeam !== assetTeam;

    /* 1. Use case rỗng hoặc quá ngắn */
    if (desc.length === 0)
      flags.push({ level: 'high',   text: 'Không mô tả use case' });
    else if (desc.length < 20)
      flags.push({ level: 'high',   text: `Use case quá ngắn (${desc.length} ký tự)` });

    /* 2. Không mô tả thay đổi */
    if (changes.length === 0)
      flags.push({ level: 'high',   text: 'Không mô tả thay đổi so với bản gốc' });
    else if (changes.length < 15)
      flags.push({ level: 'medium', text: `Thay đổi mô tả quá sơ sài (${changes.length} ký tự)` });

    /* 3. Thiếu output link */
    if (!item.output_link)
      flags.push({ level: 'high',   text: 'Thiếu output link (bắt buộc)' });

    /* 4. Cùng team (reward = 0 nhưng ít nghiêm trọng hơn) */
    if (knownTeams && !isCross)
      flags.push({ level: 'low',    text: `Cùng team với owner (${userTeam}) → reward 0₫` });
  }

  return flags;
}

/**
 * Render HTML cho risk flags.
 */
/**
 * Render risk flags — luôn hiển thị ít nhất badge "sạch".
 * @param {Array} flags
 * @param {string} type - 'star'|'fork' để show label đúng
 */
function renderRiskFlags(flags, type) {
  const dot = { high: '🔴', medium: '🟡', low: '🟢' };
  if (!flags || !flags.length) {
    return `<div class="risk-flags">
      <span class="risk-flag" style="background:rgba(52,211,153,0.10);color:var(--green);border:1px solid rgba(52,211,153,0.25);">
        ✅ Không có dấu hiệu vi phạm
      </span>
    </div>`;
  }
  const hasHigh = flags.some(f => f.level === 'high');
  const header  = hasHigh
    ? `<span class="risk-flag risk-high" style="font-weight:700;">⚠️ Cần xem xét kỹ</span>`
    : `<span class="risk-flag risk-medium" style="font-weight:700;">🟡 Cần chú ý</span>`;
  return `<div class="risk-flags">
    ${header}
    ${flags.map(f => `<span class="risk-flag risk-${f.level}">${dot[f.level] || ''} ${f.text}</span>`).join('')}
  </div>`;
}

/**
 * Đếm số pending stars theo từng user_id.
 * @param {Array} stars - mảng rows từ stars_log
 * @returns {Object} { user_id: count }
 */
function buildUserStarMap(stars) {
  const map = {};
  (stars || []).forEach(s => {
    if (s.user_id) map[s.user_id] = (map[s.user_id] || 0) + 1;
  });
  return map;
}
