const DEFAULT_ACTIVITIES = [
  'Swimming', 'Cycling', 'Coding', 'Gaming', 'Chilling',
  'Reading', 'Sleeping', 'School', 'Summer camp', 'Homework',
  'Driving lesson', 'Chores', 'Bike Repair', 'Nap'
];

const STORAGE_KEYS = {
  customActivities: 'planner_custom_activities',
  schedule: 'planner_schedule',
  notified: 'planner_notified'
};

let selectedActivity = null;
let checkInterval = null;
const scheduledTimers = new Map();

// ── DOM refs ──────────────────────────────────────────────
const screenHome = document.getElementById('screen-home');
const screenTime = document.getElementById('screen-time');
const activityGrid = document.getElementById('activity-grid');
const schedulePreview = document.getElementById('schedule-preview');
const scheduleList = document.getElementById('schedule-list');
const todayDate = document.getElementById('today-date');
const selectedActivityName = document.getElementById('selected-activity-name');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const timeError = document.getElementById('time-error');
const btnBack = document.getElementById('btn-back');
const btnConfirm = document.getElementById('btn-confirm');
const modalOverlay = document.getElementById('modal-overlay');
const customInput = document.getElementById('custom-activity-input');
const btnCancelCustom = document.getElementById('btn-cancel-custom');
const btnSaveCustom = document.getElementById('btn-save-custom');
const toast = document.getElementById('toast');
const notifBanner = document.getElementById('notif-banner');
const notifStatus = document.getElementById('notif-status');
const btnTestNotif = document.getElementById('btn-test-notif');
const btnEnableNotif = document.getElementById('btn-enable-notif');

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function notificationsSupported() {
  return 'Notification' in window && window.isSecureContext;
}

// ── Storage helpers ───────────────────────────────────────
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCustomActivities() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.customActivities)) || [];
  } catch {
    return [];
  }
}

function saveCustomActivities(list) {
  localStorage.setItem(STORAGE_KEYS.customActivities, JSON.stringify(list));
}

function getAllActivities() {
  return [...DEFAULT_ACTIVITIES, ...getCustomActivities()];
}

function getSchedule() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.schedule)) || {};
    return all[todayKey()] || [];
  } catch {
    return [];
  }
}

function saveSchedule(items) {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.schedule) || '{}');
  all[todayKey()] = items;
  localStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(all));
  rescheduleAllNotifications();
  syncNotificationsToSW(items);
}

function getNotifiedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.notified) || '[]'));
  } catch {
    return new Set();
  }
}

function markNotified(id) {
  const set = getNotifiedSet();
  set.add(id);
  localStorage.setItem(STORAGE_KEYS.notified, JSON.stringify([...set]));
  syncNotifiedToSW();
}

function clearOldNotified() {
  const key = todayKey();
  const stored = localStorage.getItem(STORAGE_KEYS.notified + '_date');
  if (stored !== key) {
    localStorage.setItem(STORAGE_KEYS.notified, '[]');
    localStorage.setItem(STORAGE_KEYS.notified + '_date', key);
  }
}

// ── UI helpers ────────────────────────────────────────────
function showScreen(name) {
  screenHome.classList.toggle('active', name === 'home');
  screenTime.classList.toggle('active', name === 'time');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function setTodayDate() {
  todayDate.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function updateNotifBanner() {
  notifBanner.classList.remove('hidden', 'ok', 'warn', 'error');

  if (!window.isSecureContext) {
    notifStatus.textContent = isIOS()
      ? 'iPhone needs HTTPS for notifications. Ask to set up GitHub Pages (free).'
      : 'Notifications need a secure (HTTPS) connection.';
    notifBanner.classList.add('error');
    btnEnableNotif.disabled = true;
    btnTestNotif.disabled = true;
    return;
  }

  btnEnableNotif.disabled = false;
  btnTestNotif.disabled = false;

  if (!('Notification' in window)) {
    notifStatus.textContent = 'Notifications are not supported in this browser.';
    notifBanner.classList.add('error');
    return;
  }

  if (Notification.permission === 'granted') {
    notifStatus.textContent = 'Notifications are on. Tap Test to try one.';
    notifBanner.classList.add('ok');
    btnEnableNotif.classList.add('hidden');
    return;
  }

  btnEnableNotif.classList.remove('hidden');

  if (Notification.permission === 'denied') {
    notifStatus.textContent = 'Notifications blocked. Settings → Safari → Planner, or reinstall from Home Screen.';
    notifBanner.classList.add('error');
  } else {
    notifStatus.textContent = 'Tap Enable, then Allow when iPhone asks.';
    notifBanner.classList.add('warn');
  }
}

// ── Activity grid ─────────────────────────────────────────
function renderActivities() {
  activityGrid.innerHTML = '';
  getAllActivities().forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'activity-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => openTimePicker(name));
    activityGrid.appendChild(btn);
  });

  const moreBtn = document.createElement('button');
  moreBtn.className = 'activity-btn more';
  moreBtn.textContent = '+ More';
  moreBtn.addEventListener('click', openCustomModal);
  activityGrid.appendChild(moreBtn);
}

function openTimePicker(name) {
  selectedActivity = name;
  selectedActivityName.textContent = name;
  timeError.classList.add('hidden');

  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  startTimeInput.value = `${h}:${m}`;

  const end = new Date(now.getTime() + 60 * 60 * 1000);
  endTimeInput.value = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;

  showScreen('time');
}

function openCustomModal() {
  customInput.value = '';
  modalOverlay.classList.remove('hidden');
  setTimeout(() => customInput.focus(), 100);
}

function closeCustomModal() {
  modalOverlay.classList.add('hidden');
}

function saveCustomActivity() {
  const name = customInput.value.trim();
  if (!name) return;

  const customs = getCustomActivities();
  if (getAllActivities().some(a => a.toLowerCase() === name.toLowerCase())) {
    showToast('Activity already exists');
    return;
  }

  customs.push(name);
  saveCustomActivities(customs);
  closeCustomModal();
  renderActivities();
  openTimePicker(name);
}

// ── Schedule ──────────────────────────────────────────────
function renderSchedule() {
  const items = getSchedule().sort((a, b) => a.start.localeCompare(b.start));

  if (items.length === 0) {
    schedulePreview.classList.add('hidden');
    return;
  }

  schedulePreview.classList.remove('hidden');
  scheduleList.innerHTML = '';

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'schedule-item';
    li.innerHTML = `
      <span class="name">${escapeHtml(item.name)}</span>
      <span class="time">${formatTime(item.start)} – ${formatTime(item.end)}</span>
      <button class="delete-btn" aria-label="Remove">×</button>
    `;
    li.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id));
    scheduleList.appendChild(li);
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function deleteItem(id) {
  saveSchedule(getSchedule().filter(i => i.id !== id));
  renderSchedule();
  showToast('Activity removed');
}

function confirmActivity() {
  const start = startTimeInput.value;
  const end = endTimeInput.value;
  if (!start || !end) return;

  if (end <= start) {
    timeError.classList.remove('hidden');
    return;
  }

  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: selectedActivity,
    start,
    end,
    date: todayKey()
  };

  saveSchedule([...getSchedule(), item]);
  renderSchedule();
  showScreen('home');
  showToast(`${selectedActivity} added!`);
  requestNotificationPermission();
}

// ── Notifications ───────────────────────────────────────
function timeToMsToday(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function clearScheduledTimers() {
  scheduledTimers.forEach(timer => clearTimeout(timer));
  scheduledTimers.clear();
}

function scheduleAt(key, ms, title, body, notifyId) {
  if (scheduledTimers.has(key)) {
    clearTimeout(scheduledTimers.get(key));
  }

  const delay = ms - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(() => {
    scheduledTimers.delete(key);
    if (!getNotifiedSet().has(notifyId)) {
      showNotification(title, body);
      markNotified(notifyId);
    }
  }, delay);

  scheduledTimers.set(key, timer);
}

function rescheduleAllNotifications() {
  clearScheduledTimers();
  if (Notification.permission !== 'granted') return;

  const notified = getNotifiedSet();

  getSchedule().forEach(item => {
    const startId = `${item.id}-start`;
    const endId = `${item.id}-end`;
    const startMs = timeToMsToday(item.start);
    const endMs = timeToMsToday(item.end);

    if (!notified.has(startId)) {
      scheduleAt(
        startId,
        startMs,
        `Time for ${item.name}!`,
        `Your ${item.name} session starts now.`,
        startId
      );
    }

    if (!notified.has(endId)) {
      scheduleAt(
        endId,
        endMs,
        `${item.name} finished`,
        `Your ${item.name} session is over.`,
        endId
      );
    }
  });
}

async function requestNotificationPermission() {
  showToast('Requesting permission…');

  if (!window.isSecureContext) {
    showToast('Need HTTPS — Mac server won\'t work for notifications');
    updateNotifBanner();
    return false;
  }

  if (!('Notification' in window)) {
    showToast('Notifications not supported here');
    updateNotifBanner();
    return false;
  }

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    updateNotifBanner();
    if (result === 'granted') {
      showToast('Notifications enabled!');
      rescheduleAllNotifications();
      return true;
    }
    showToast('Permission denied');
    return false;
  }

  updateNotifBanner();
  if (Notification.permission === 'granted') {
    rescheduleAllNotifications();
    return true;
  }

  showToast('Enable in iPhone Settings, then reopen Planner');
  return false;
}

async function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: title
      });
      return;
    }
  } catch {
    // fall through
  }

  new Notification(title, { body, icon: 'icons/icon-192.png' });
}

async function sendTestNotification() {
  showToast('Sending test…');

  if (!window.isSecureContext) {
    showToast('Notifications need HTTPS on iPhone');
    return;
  }

  const ok = await requestNotificationPermission();
  if (!ok) return;

  await showNotification('Planner works!', 'You will get alerts when activities start.');
  showToast('Test notification sent!');
}

function checkDueNotifications() {
  if (Notification.permission !== 'granted') return;

  const now = Date.now();
  const notified = getNotifiedSet();

  getSchedule().forEach(item => {
    const startId = `${item.id}-start`;
    const endId = `${item.id}-end`;
    const startMs = timeToMsToday(item.start);
    const endMs = timeToMsToday(item.end);

    if (now >= startMs && now < startMs + 90_000 && !notified.has(startId)) {
      showNotification(`Time for ${item.name}!`, `Your ${item.name} session starts now.`);
      markNotified(startId);
    }

    if (now >= endMs && now < endMs + 90_000 && !notified.has(endId)) {
      showNotification(`${item.name} finished`, `Your ${item.name} session is over.`);
      markNotified(endId);
    }
  });
}

function startNotificationChecker() {
  checkDueNotifications();
  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(checkDueNotifications, 10_000);
}

function syncNotificationsToSW(items) {
  const payload = {
    type: 'SCHEDULE_UPDATE',
    schedule: items,
    date: todayKey(),
    notified: [...getNotifiedSet()]
  };

  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage(payload);
  } else {
    navigator.serviceWorker?.ready.then(reg => {
      reg.active?.postMessage(payload);
    });
  }
}

function syncNotifiedToSW() {
  syncNotificationsToSW(getSchedule());
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    syncNotificationsToSW(getSchedule());
  } catch (err) {
    console.warn('SW registration failed:', err);
  }
}

// ── Event listeners ───────────────────────────────────────
btnBack?.addEventListener('click', () => showScreen('home'));
btnConfirm?.addEventListener('click', confirmActivity);
btnCancelCustom?.addEventListener('click', closeCustomModal);
btnSaveCustom?.addEventListener('click', saveCustomActivity);
btnTestNotif?.addEventListener('click', sendTestNotification);
btnEnableNotif?.addEventListener('click', requestNotificationPermission);
customInput?.addEventListener('keydown', e => { if (e.key === 'Enter') saveCustomActivity(); });
modalOverlay?.addEventListener('click', e => { if (e.target === modalOverlay) closeCustomModal(); });

// Backup: event delegation in case cached HTML differs
document.addEventListener('click', e => {
  const t = e.target;
  if (t.id === 'btn-test-notif') sendTestNotification();
  if (t.id === 'btn-enable-notif') requestNotificationPermission();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkDueNotifications();
    rescheduleAllNotifications();
  }
});

window.addEventListener('focus', () => {
  checkDueNotifications();
  rescheduleAllNotifications();
});

// ── Init ──────────────────────────────────────────────────
async function init() {
  setTodayDate();
  clearOldNotified();
  renderActivities();
  renderSchedule();
  updateNotifBanner();
  await registerSW();
  if (notificationsSupported() && Notification.permission === 'granted') {
    rescheduleAllNotifications();
  }
  startNotificationChecker();
}

init();
