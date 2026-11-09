const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage
  }
});

function showMessage(message) {
  alert(message);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function showTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.hidden = tab.id !== tabName;
  });

  if (tabName === 'users') loadUsers();
  if (tabName === 'news') loadNews();
  if (tabName === 'dates') loadDates();
  if (tabName === 'events') loadEvents();
}

async function checkAdmin() {
  const { data: { user }, error: authError } = await db.auth.getUser();

  if (authError || !user) {
    location.href = 'index.html';
    return;
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (error || profile?.status !== 'admin') {
    alert('Доступ заборонено');
    location.href = 'index.html';
    return;
  }

  showTab('users');
}

async function logout() {
  await db.auth.signOut();
  location.href = 'index.html';
}

/* КОРИСТУВАЧІ */

async function loadUsers() {
  const pendingBox = document.getElementById('pending-users');
  const approvedBox = document.getElementById('approved-users');

  if (!pendingBox || !approvedBox) return;

  const { data, error } = await db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    pendingBox.textContent = error.message;
    return;
  }

  const pending = data.filter(user => user.status === 'pending');
  const approved = data.filter(user =>
    user.status === 'approved' || user.status === 'admin'
  );

  pendingBox.innerHTML = '<h3>Очікують схвалення</h3>' +
    (pending.length
      ? pending.map(user => `
        <div class="admin-item">
          <strong>${escapeHTML(user.full_name || user.email || user.id)}</strong>
          <button onclick="approveUser('${user.id}')">Схвалити</button>
        </div>
      `).join('')
      : '<p>Немає користувачів</p>');

  approvedBox.innerHTML = approved.map(user => `
    <div class="admin-item">
      ${escapeHTML(user.full_name || user.email || user.id)}
      <span>${escapeHTML(user.status)}</span>
    </div>
  `).join('');
}

async function approveUser(id) {
  const greeting = prompt('Привітання для користувача (необов’язково):') || '';

  const { error } = await db
    .from('profiles')
    .update({ status: 'approved', greeting })
    .eq('id', id);

  if (error) return showMessage('Помилка: ' + error.message);

  showMessage('Користувача схвалено');
  loadUsers();
}

/* НОВИНИ */

async function loadNews() {
  const box = document.getElementById('news-list');
  if (!box) return;

  const { data, error } = await db
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = error.message;
    return;
  }

  box.innerHTML = (data || []).map(item => `
    <div class="admin-item">
      <strong>${escapeHTML(item.title)}</strong>
      <p>${escapeHTML(item.content)}</p>
      <button onclick="deleteNews('${item.id}')">Видалити</button>
    </div>
  `).join('');
}

async function addNews(event) {
  event.preventDefault();

  const title = document.getElementById('news-title').value.trim();
  const content = document.getElementById('news-content').value.trim();

  if (!title || !content) return;

  const { error } = await db
    .from('news')
    .insert([{ title, content }]);

  if (error) return showMessage('Помилка: ' + error.message);

  document.getElementById('news-form').reset();
  showMessage('Новину додано');
  loadNews();
}

async function deleteNews(id) {
  if (!confirm('Видалити цю новину?')) return;

  const { error } = await db.from('news').delete().eq('id', id);

  if (error) return showMessage('Помилка: ' + error.message);

  loadNews();
}

/* ІМЕНИНИ / СМЕРТЬ */

async function loadDates() {
  const box = document.getElementById('dates-list');
  if (!box) return;

  const { data, error } = await db
    .from('dates')
    .select('*');

  if (error) {
    box.textContent = error.message;
    return;
  }

  const sorted = (data || []).sort((a, b) => {
    return nextOccurrence(a) - nextOccurrence(b);
  });

  box.innerHTML = sorted.map(item => {
    const type = item.date_type === 'death' || item.is_death
      ? 'День смерті'
      : 'Іменини / день народження';

    const date = [
      String(item.date_day).padStart(2, '0'),
      String(item.date_month).padStart(2, '0'),
      item.date_year || ''
    ].filter(Boolean).join('.');

    return `
      <div class="admin-item">
        <strong>${escapeHTML(item.person_name)}</strong>
        <span>${escapeHTML(type)}</span>
        <p>${escapeHTML(date)}</p>
        <p>${escapeHTML(item.description || '')}</p>
        <button onclick="deleteDate('${item.id}')">Видалити</button>
      </div>
    `;
  }).join('');
}

function nextOccurrence(item) {
  const now = new Date();
  const day = Number(item.date_day);
  const month = Number(item.date_month) - 1;

  let date = new Date(now.getFullYear(), month, day);

  if (date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    date = new Date(now.getFullYear() + 1, month, day);
  }

  return date.getTime();
}

async function addDate(event) {
  event.preventDefault();

  const person_name = document.getElementById('person-name').value.trim();
  const date_day = Number(document.getElementById('date-day').value);
  const date_month = Number(document.getElementById('date-month').value);
  const yearValue = document.getElementById('date-year').value;
  const date_year = yearValue ? Number(yearValue) : null;
  const date_type = document.getElementById('date-type').value;
  const description = document.getElementById('date-description').value.trim();

  const daysInMonth = new Date(2000, date_month, 0).getDate();

  if (!person_name || date_day < 1 || date_day > daysInMonth ||
      date_month < 1 || date_month > 12) {
    return showMessage('Перевір правильність дати');
  }

  const { error } = await db.from('dates').insert([{
    person_name,
    date_day,
    date_month,
    date_year,
    date_type,
    is_death: date_type === 'death',
    description
  }]);

  if (error) return showMessage('Помилка: ' + error.message);

  document.getElementById('date-form').reset();
  showMessage('Дату додано');
  loadDates();
}

async function deleteDate(id) {
  if (!confirm('Видалити цей запис?')) return;

  const { error } = await db.from('dates').delete().eq('id', id);

  if (error) return showMessage('Помилка: ' + error.message);

  loadDates();
}

/* ПОДІЇ */

async function loadEvents() {
  const box = document.getElementById('events-list');
  if (!box) return;

  const { data, error } = await db
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });

  if (error) {
    box.textContent = error.message;
    return;
  }

  const labels = {
    holiday: 'Свято',
    grief: 'Горе',
    other: 'Інше'
  };

  box.innerHTML = (data || []).map(item => `
    <div class="admin-item">
      <strong>${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(labels[item.event_type] || 'Інше')}</span>
      <p>${escapeHTML(new Date(item.event_date).toLocaleString('uk-UA'))}</p>
      <p>${escapeHTML(item.description || '')}</p>
      <button onclick="deleteEvent('${item.id}')">Видалити</button>
    </div>
  `).join('');
}

async function addEvent(event) {
  event.preventDefault();

  const title = document.getElementById('event-title').value.trim();
  const event_type = document.getElementById('event-type').value;
  const date = document.getElementById('event-date').value;
  const description = document.getElementById('event-description').value.trim();

  if (!title || !date) {
    return showMessage('Заповни назву та дату події');
  }

  const { error } = await db.from('events').insert([{
    title,
    event_type,
    event_date: new Date(date).toISOString(),
    description
  }]);

  if (error) return showMessage('Помилка: ' + error.message);

  document.getElementById('event-form').reset();
  showMessage('Подію додано');
  loadEvents();
}

async function deleteEvent(id) {
  if (!confirm('Видалити цю подію?')) return;

  const { error } = await db.from('events').delete().eq('id', id);

  if (error) return showMessage('Помилка: ' + error.message);

  loadEvents();
}

checkAdmin();
