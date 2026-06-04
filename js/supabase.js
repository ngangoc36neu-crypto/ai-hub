/* ============================================
   APERO AI HUB — Supabase Client
   Load order: supabase.js → main.js → inline script
   ============================================ */

const SUPABASE_URL = 'https://oaedfqlvbsnlwizdmhkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5Y_cXwgxziFm4cymOgGynQ_3pqkdwtO';

/* ===== GIỚI HẠN STAR/FORK =====
   - Mỗi user chỉ star/fork 1 lần / 1 asset (lượt bị từ chối không tính)
   - Hạn mức/tháng tính trên số lượt ĐÃ DUYỆT (approved) trong tháng hiện tại
   - Đổi số ở đây là áp dụng toàn hệ thống
   ===== */
const LIMIT_STAR_PER_MONTH = 10;
const LIMIT_FORK_PER_MONTH = 5;

/* ===== BASE FETCH ===== */
async function sbFetch(path, opts = {}) {
  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    ...(opts.headers || {})
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...opts, headers });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`[Supabase ${res.status}] ${msg}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/* ===== TIME HELPER ===== */
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Hôm qua';
  if (d < 7)  return `${d} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/* ===== ASSET MAPPING (v2.0) =====
   - status: 'pending'/'verified'/'rejected' (lowercase)
   - stars/forks: lấy từ stars_count/forks_count trong assets table (trigger tự update)
   - asset_content: nội dung text trực tiếp (thay thế link nếu không có file)
   ===== */
function mapAsset(row) {
  return {
    id:             row.id,
    asset_id:       row.asset_id        || '',
    name:           row.asset_name      || '',
    type:           row.asset_type      || '',
    domain:         row.domain          || '',
    desc:           row.description     || '',
    owner:          row.owner_name      || '',
    owner_user_id:  row.owner_user_id   || null,
    team:           row.team            || '',
    stars:          row.stars_count     || 0,   // trigger tự update
    forks:          row.forks_count     || 0,   // trigger tự update
    status:        (row.status          || 'pending').toLowerCase(),
    created:        row.created_at ? new Date(row.created_at).toLocaleDateString('vi-VN') : '',
    how_to_use:     row.how_to_use      || '',
    target_user:    row.target_user     || '',
    example_output: row.example_output  || '',
    asset_link:     row.asset_link      || '#',
    asset_content:  row.asset_content   || '',
    reviewer_note:  row.reviewer_note   || '',
    reviewed_by:    row.reviewed_by     || '',
    verified_at:    row.verified_at     || ''
  };
}

/* ===== ASSETS ===== */
async function dbGetAssets(status = null) {
  let q = '/assets?select=*&order=id.desc';
  if (status) q += `&status=eq.${status}`;
  return (await sbFetch(q)) || [];
}

async function dbGetAssetById(id) {
  const rows = await sbFetch(`/assets?id=eq.${id}&select=*&limit=1`);
  return rows?.[0] || null;
}

async function dbInsertAsset(data) {
  return sbFetch('/assets', {
    method:  'POST',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(data)
  });
}

async function dbUpdateAsset(id, data) {
  return sbFetch(`/assets?id=eq.${id}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(data)
  });
}

async function dbNextAssetId() {
  try {
    const rows = await sbFetch('/assets?select=asset_id&order=id.desc&limit=1');
    if (!rows || rows.length === 0) return 'APR-001';
    const last = rows[0].asset_id || 'APR-000';
    const num  = parseInt(last.replace('APR-', '') || '0') + 1;
    return `APR-${String(num).padStart(3, '0')}`;
  } catch (_) {
    return `APR-${Date.now().toString().slice(-4)}`;
  }
}

/* ===== STARS (table thực tế: stars_log) ===== */
async function dbGetStarsByAsset(assetId) {
  // JOIN users để hiển thị tên + team trong asset-detail
  return (await sbFetch(
    `/stars_log?asset_id=eq.${assetId}&select=*,users(full_name,team)&order=created_at.desc`
  )) || [];
}

async function dbGetPendingStars() {
  // JOIN users + assets để curator thấy tên thật & tính cross-team đúng
  return (await sbFetch(
    '/stars_log?status=eq.pending&select=*,users(full_name,team),assets(asset_name,team,owner_name)&order=created_at.asc'
  )) || [];
}

async function dbInsertStar(data) {
  // user_email redundant field — tránh JOIN khi query nhanh
  const payload = { status: 'pending', reward_amount: 0, ...data };
  if (!payload.user_email && CURRENT_USER?.email) payload.user_email = CURRENT_USER.email;
  return sbFetch('/stars_log', {
    method:  'POST',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(payload)
  });
}

async function dbUpdateStar(id, data) {
  return sbFetch(`/stars_log?id=eq.${id}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(data)
  });
}

/* ===== FORKS (table thực tế: forks_log) ===== */
async function dbGetForksByAsset(assetId) {
  // JOIN users để hiển thị tên + team trong asset-detail
  return (await sbFetch(
    `/forks_log?original_asset_id=eq.${assetId}&select=*,users(full_name,team)&order=created_at.desc`
  )) || [];
}

async function dbGetPendingForks() {
  // JOIN users + assets để curator thấy tên thật & tính cross-team đúng
  return (await sbFetch(
    '/forks_log?status=eq.pending&select=*,users(full_name,team),assets(asset_name,team,owner_name)&order=created_at.asc'
  )) || [];
}

async function dbInsertFork(data) {
  // output_link bắt buộc ở v2
  const payload = { status: 'pending', reward_amount: 0, ...data };
  if (!payload.user_email && CURRENT_USER?.email) payload.user_email = CURRENT_USER.email;
  return sbFetch('/forks_log', {
    method:  'POST',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(payload)
  });
}

async function dbUpdateFork(id, data) {
  return sbFetch(`/forks_log?id=eq.${id}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(data)
  });
}

/* ===== GIỚI HẠN STAR/FORK — HELPERS ===== */
// ISO của 00:00 ngày 1 tháng hiện tại (theo giờ máy người dùng)
function _monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// User đã có star "còn hiệu lực" (pending/approved, KHÔNG tính rejected) cho asset này chưa?
async function dbHasActiveStar(userId, assetId) {
  if (!userId) return false;
  const rows = await sbFetch(
    `/stars_log?user_id=eq.${userId}&asset_id=eq.${assetId}&status=neq.rejected&select=id&limit=1`
  ).catch(() => []);
  return (rows || []).length > 0;
}

async function dbHasActiveFork(userId, assetId) {
  if (!userId) return false;
  const rows = await sbFetch(
    `/forks_log?user_id=eq.${userId}&original_asset_id=eq.${assetId}&status=neq.rejected&select=id&limit=1`
  ).catch(() => []);
  return (rows || []).length > 0;
}

// Số star đã DUYỆT (approved) của user trong tháng hiện tại
async function dbCountApprovedStarsThisMonth(userId) {
  if (!userId) return 0;
  const rows = await sbFetch(
    `/stars_log?user_id=eq.${userId}&status=eq.approved&created_at=gte.${_monthStartISO()}&select=id`
  ).catch(() => []);
  return (rows || []).length;
}

async function dbCountApprovedForksThisMonth(userId) {
  if (!userId) return 0;
  const rows = await sbFetch(
    `/forks_log?user_id=eq.${userId}&status=eq.approved&created_at=gte.${_monthStartISO()}&select=id`
  ).catch(() => []);
  return (rows || []).length;
}

/* ===== ASSET DOWNLOADS (tracking tải xuống) ===== */
async function dbInsertDownload(data) {
  // Ghi log lúc tải — output_url để null, user điền sau từ trang profile
  const payload = {
    downloaded_at: new Date().toISOString(),
    user_email:    CURRENT_USER?.email || null,
    output_url:    null,
    ...data
  };
  return sbFetch('/asset_downloads', {
    method:  'POST',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(payload)
  });
}

async function dbUpdateDownloadOutput(id, outputUrl) {
  return sbFetch(`/asset_downloads?id=eq.${id}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify({ output_url: outputUrl })
  });
}

async function dbGetDownloadsByUser(userId) {
  return (await sbFetch(
    `/asset_downloads?user_id=eq.${userId}&select=*,assets(asset_name,asset_type)&order=downloaded_at.desc`
  )) || [];
}

async function dbGetAllDownloads() {
  // Lấy toàn bộ downloads kèm thông tin user + asset để tổng hợp phía client
  return (await sbFetch(
    '/asset_downloads?select=*,users(full_name,team),assets(asset_name,asset_type)&order=downloaded_at.desc'
  )) || [];
}

/* ===== USERS ===== */
async function dbGetUsers() {
  return (await sbFetch('/users?select=*&order=full_name.asc')) || [];
}

async function dbGetUserByEmail(email) {
  const rows = await sbFetch(`/users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
  return rows?.[0] || null;
}

/* ===== COMBINED (v2.0): stars_count/forks_count có sẵn trong assets table ===== */
async function dbGetAssetsWithCounts(status = null) {
  // Không cần query stars_log/forks_log riêng — DB trigger tự update counts
  const assets = await dbGetAssets(status);
  return assets.map(a => mapAsset(a));
}

/* ===== GET EMAIL BY USER ID ===== */
async function dbGetUserEmailById(userId) {
  if (!userId) return null;
  const rows = await sbFetch(`/users?id=eq.${userId}&select=email&limit=1`);
  return rows?.[0]?.email || null;
}

/* ===== GET ASSET OWNER EMAIL (2-step lookup) ===== */
async function dbGetOwnerEmailByAssetId(assetId) {
  if (!assetId) return null;
  const assetRows = await sbFetch(`/assets?id=eq.${assetId}&select=owner_user_id&limit=1`);
  const userId = assetRows?.[0]?.owner_user_id;
  return dbGetUserEmailById(userId);
}

/* ===== CURRENT USER ID (cached) ===== */
let _currentUserId = null;
async function getCurrentUserId() {
  if (_currentUserId) return _currentUserId;
  try {
    const u = await dbGetUserByEmail(CURRENT_USER.email);
    _currentUserId = u?.id || null;
  } catch (_) { _currentUserId = null; }
  return _currentUserId;
}

/* ===== USER-SPECIFIC QUERIES (profile page) ===== */
async function dbGetAssetsByUser(userId) {
  return (await sbFetch(`/assets?owner_user_id=eq.${userId}&select=*&order=id.desc`)) || [];
}

async function dbGetStarsByUser(userId) {
  // JOIN assets để hiển thị tên asset + type
  return (await sbFetch(
    `/stars_log?user_id=eq.${userId}&select=*,assets(asset_name,asset_type,domain)&order=created_at.desc`
  )) || [];
}

async function dbGetForksByUser(userId) {
  // JOIN assets để hiển thị tên asset gốc
  return (await sbFetch(
    `/forks_log?user_id=eq.${userId}&select=*,assets(asset_name,asset_type,domain)&order=created_at.desc`
  )) || [];
}

/* ===== NOTIFICATIONS (profile + bell) =====
   Tổng hợp notifications cho 1 user:
   - Asset của họ được duyệt / từ chối
   - Có người star asset của họ (approved)
   - Có người fork asset của họ (approved)
   ===== */
async function dbGetNotificationsForUser(userId) {
  // Lấy tất cả assets của user (để biết danh sách id)
  const myAssets = await dbGetAssetsByUser(userId);

  // Notification từ status thay đổi của chính asset
  const assetNotifs = myAssets
    .filter(a => a.status === 'verified' || a.status === 'rejected')
    .map(a => ({
      id:       `asset-${a.id}`,
      type:     a.status === 'verified' ? 'approved' : 'rejected',
      title:    a.status === 'verified'
                  ? `"${a.asset_name}" đã được duyệt!`
                  : `"${a.asset_name}" bị từ chối`,
      sub:      a.status === 'verified'
                  ? 'Asset của bạn đã được thêm vào thư viện.'
                  : (a.reviewer_note ? `Lý do: ${a.reviewer_note}` : ''),
      time:     a.verified_at || a.created_at,
      asset_id: a.id
    }));

  if (!myAssets.length) return assetNotifs;

  const myAssetIds = myAssets.map(a => a.id).join(',');

  // Stars trên assets của user (đã approved)
  let starNotifs = [], forkNotifs = [];
  try {
    const starRows = await sbFetch(
      `/stars_log?asset_id=in.(${myAssetIds})&status=eq.approved&select=*,users(full_name,team)&order=created_at.desc&limit=30`
    ) || [];
    starNotifs = starRows.map(s => ({
      id:       `star-${s.id}`,
      type:     'star',
      title:    `${s.users?.full_name || s.user_email || 'Ai đó'} đã star asset của bạn`,
      sub:      s.reason ? `"${s.reason}"` : '',
      time:     s.created_at,
      asset_id: s.asset_id
    }));
  } catch (_) {}

  // Forks trên assets của user (đã approved)
  try {
    const forkRows = await sbFetch(
      `/forks_log?original_asset_id=in.(${myAssetIds})&status=eq.approved&select=*,users(full_name,team)&order=created_at.desc&limit=30`
    ) || [];
    forkNotifs = forkRows.map(f => ({
      id:       `fork-${f.id}`,
      type:     'fork',
      title:    `${f.users?.full_name || f.user_email || 'Ai đó'} đã fork asset của bạn`,
      sub:      f.fork_description ? `Use case: ${f.fork_description}` : '',
      time:     f.created_at,
      asset_id: f.original_asset_id
    }));
  } catch (_) {}

  // Gộp + sort theo thời gian mới nhất
  return [...assetNotifs, ...starNotifs, ...forkNotifs]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 30);
}
