const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage
  }
});

let currentUser = null;
let currentProfile = null;
let showingAllDates = false;
let countdownTimer = null;

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function notify(message) {
  alert(message);
}

/* АВТОРИЗАЦІЯ */

async function login(event) {
  if (event) event.preventDefault();

  const email = $('login-email')?.value.trim();
  const password = $('login-password')?.value;

  if (!email || !password) {
    return notify('Введи електронну пошту та пароль');
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) return notify('Не вдалося увійти: ' + error.message);

  await renderUserState();
}

async function register(event) {
  if (event) event.preventDefault();

  const name = $('register-name')?.value.trim();
  const email = $('register-email')?.value.trim();
  const password = $('register-password')?.value;

  if (!name || !email || !password) {
    return notify('Заповни всі обов’язкові поля');
  }

  if (password.length < 6) {
    return notify('Пароль має містити щонайменше 6 символів');
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (error) return notify('Помилка реєстрації: ' + error.message);

  if (data.user) {
    const { error: profileError } = await db
      .from('profiles')
      .upsert({
        id: data.user.id,
        full_name: name,
        status: 'pending'
      });

    if (profileError) {
      console.error(profileError);
      notify('Акаунт створено, але профіль не вдалося записати. Повідом адміністратора.');
      return;
    }
  }

  closeRegisterDrawer();
  notify('Реєстрацію надіслано. Дочекайся схвалення адміністратора.');
  await renderUserState();
}

async function logout() {
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  location.reload();
}

async function renderUserState() {
  const { data: { user } } = await db.auth.getUser();
  currentUser = user || null;

  const guest = $('guest-view');
  const pending = $('pending-view');
  const main = $('main-view');
  const adminLink = $('admin-link');

  if (!user) {
    if (guest) guest.hidden = false;
    if (pending) pending.hidden = true;
    if (main) main.hidden = true;
    if (adminLink) adminLink.hidden = true;
    return;
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Помилка профілю:', error);
    notify('Не вдалося завантажити профіль: ' + error.message);
    return;
  }

  currentProfile = profile;

  if (!profile || profile.status === 'pending') {
    if (guest) guest.hidden = true;
    if (pending) pending.hidden = false;
    if (main) main.hidden = true;
    if (adminLink) adminLink.hidden = true;

    const greeting = $('pending-greeting');
    if (greeting) {
      greeting.textContent = profile?.greeting || 'Твоя заявка очікує схвалення адміністратора.';
    }
    return;
  }

  if (profile.status !== 'approved' && profile.status !== 'admin') {
    if (guest) guest.hidden = false;
    if (pending) pending.hidden = true;
    if (main) main.hidden = true;
    return;
  }

  if (guest) guest.hidden = true;
  if (pending) pending.hidden = true;
  if (main) main.hidden = false;
  if (adminLink) adminLink.hidden = profile.status !== 'admin';

  const userName = $('user-name');
  if (userName) userName.textContent = profile.full_name || user.email || '';

  const greeting = $('user-greeting');
  if (greeting) greeting.textContent = profile.greeting || '';

  showPage('news');
  loadCountdown();
}

/* ВИСУВНА ПАНЕЛЬ РЕЄСТРАЦІЇ */

function openRegisterDrawer() {
  $('register-drawer')?.classList.add('open');
  $('drawer-overlay')?.classList.add('visible');
  document.body.classList.add('drawer-open');
}

function closeRegisterDrawer() {
  $('register-drawer')?.classList.remove('open');
  $('drawer-overlay')?.classList.remove('visible');
  document.body.classList.remove('drawer-open');
}

function openLogin() {
  const loginBox = $('login-form');
  if (loginBox) loginBox.hidden = false;
}

function closeLogin() {
  const loginBox = $('login-form');
  if (loginBox) loginBox.hidden = true;
}

/* НАВІГАЦІЯ */

function showPage(page) {
  document.querySelectorAll('.page').forEach(section => {
    section.hidden = section.id !== `page-${page}`;
  });

  document.querySelectorAll('[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });

  if (page === 'news') loadNews();
  if (page === 'dates') loadDates();
  if (page === 'events') loadEvents();
}

/* НОВИНИ ТА КОМЕНТАРІ */

async function loadNews() {
  const box = $('news-container') || $('news-list');
  if (!box) return;

  box.innerHTML = '<p>Завантаження новин...</p>';

  const { data, error } = await db
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = 'Не вдалося завантажити новини: ' + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Новин поки немає.</p>';
    return;
  }

  box.innerHTML = data.map(item => `
    <article class="news-card">
      <h3>${escapeHTML(item.title)}</h3>
      <p class="news-date">${formatDate(item.created_at)}</p>
      <div class="news-content">${escapeHTML(item.content).replace(/\n/g, '<br>')}</div>
      <section class="comments-section">
        <h4>Коментарі</h4>
        <div id="comments-${item.id}">Завантаження коментарів...</div>
        <form onsubmit="addComment(event, '${item.id}')">
          <textarea name="comment" placeholder="Написати коментар..." required></textarea>
          <button type="submit">Надіслати</button>
        </form>
      </section>
    </article>
  `).join('');

  for (const item of data) {
    loadComments(item.id);
  }
}

async function loadComments(newsId) {
  const box = $(`comments-${newsId}`);
  if (!box) return;

  const { data, error } = await db
    .from('comments')
    .select('*')
    .eq('news_id', newsId)
    .order('created_at', { ascending: true });

  if (error) {
    box.textContent = 'Не вдалося завантажити коментарі.';
    console.error(error);
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p class="empty-comments">Коментарів поки немає.</p>';
    return;
  }

  box.innerHTML = data.map(comment => `
    <div class="comment">
      <strong>${escapeHTML(comment.author_name || 'Учасник')}</strong>
      <p>${escapeHTML(comment.content || comment.comment || '')}</p>
      <time>${formatDate(comment.created_at)}</time>
    </div>
  `).join('');
}

async function addComment(event, newsId) {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    return notify('Увійди в акаунт, щоб коментувати.');
  }

  const form = event.currentTarget;
  const content = form.elements.comment.value.trim();
  if (!content) return;

  const { error } = await db.from('comments').insert([{
    news_id: newsId,
    user_id: currentUser.id,
    author_name: currentProfile.full_name || currentUser.email,
    content
  }]);

  if (error) {
    return notify('Не вдалося додати коментар: ' + error.message);
  }

  form.reset();
  loadComments(newsId);
}

/* СПИСОК ІМЕНИН / ДНІВ СМЕРТІ */

function nextAnnualDate(item) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), Number(item.date_month) - 1, Number(item.date_day));

  if (next < today) {
    next = new Date(now.getFullYear() + 1, Number(item.date_month) - 1, Number(item.date_day));
  }

  return next;
}

function dateLabel(item) {
  return item.date_type === 'death' || item.is_death
    ? 'День смерті'
    : 'Іменини / день народження';
}

async function loadDates() {
  const box = $('dates-container') || $('dates-list');
  if (!box) return;

  box.innerHTML = '<p>Завантаження дат...</p>';

  const { data, error } = await db
    .from('dates')
    .select('*');

  if (error) {
    box.textContent = 'Не вдалося завантажити дати: ' + error.message;
    return;
  }

  const dates = (data || [])
    .filter(item => item.date_type !== 'event')
    .sort((a, b) => nextAnnualDate(a) - nextAnnualDate(b));

  if (!dates.length) {
    box.innerHTML = '<p>Записів поки немає.</p>';
    return;
  }

  const visibleDates = showingAllDates ? dates : dates.slice(0, 10);

  box.innerHTML = visibleDates.map(item => {
    const next = nextAnnualDate(item);
    const fullDate = [
      String(item.date_day).padStart(2, '0'),
      String(item.date_month).padStart(2, '0'),
      item.date_year || ''
    ].filter(Boolean).join('.');

    return `
      <article class="date-card">
        <div class="date-card-top">
          <span class="date-type">${escapeHTML(dateLabel(item))}</span>
          <time>${escapeHTML(fullDate)}</time>
        </div>
        <h3>${escapeHTML(item.person_name)}</h3>
        ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
        <small>Найближча дата: ${next.toLocaleDateString('uk-UA')}</small>
      </article>
    `;
  }).join('');

  if (dates.length > 10) {
    box.innerHTML += `
      <button class="show-all-button" onclick="toggleAllDates()">
        ${showingAllDates ? 'Показати менше' : 'Переглянути всі'}
      </button>
    `;
  }
}

function toggleAllDates() {
  showingAllDates = !showingAllDates;
  loadDates();
}

/* ПОДІЇ */

async function loadEvents() {
  const box = $('events-container') || $('events-list');
  if (!box) return;

  box.innerHTML = '<p>Завантаження подій...</p>';

  const { data, error } = await db
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true });

  if (error) {
    box.textContent = 'Не вдалося завантажити події: ' + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Найближчих подій поки немає.</p>';
    return;
  }

  const labels = {
    holiday: 'Свято',
    grief: 'Горе',
    other: 'Інше'
  };

  box.innerHTML = data.map(item => `
    <article class="event-card">
      <span class="event-type event-${escapeHTML(item.event_type || 'other')}">
        ${escapeHTML(labels[item.event_type] || 'Інше')}
      </span>
      <h3>${escapeHTML(item.title)}</h3>
      <time>${new Date(item.event_date).toLocaleString('uk-UA', {
        dateStyle: 'long',
        timeStyle: 'short'
      })}</time>
      ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
    </article>
  `).join('');
}

/* ЗВОРОТНИЙ ВІДЛІК ДО НАЙБЛИЖЧОЇ ПОДІЇ */

async function loadCountdown() {
  const box = $('countdown');
  if (!box) return;

  const { data, error } = await db
    .from('events')
    .select('title,event_date')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Помилка відліку:', error);
    box.textContent = 'Не вдалося завантажити найближчу подію.';
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Найближчих подій поки немає.</p>';
    if (countdownTimer) clearInterval(countdownTimer);
    return;
  }

  const event = data[0];
  const target = new Date(event.event_date).getTime();

  function update() {
    const distance = target - Date.now();

    if (distance <= 0) {
      box.innerHTML = `<p>Подія «${escapeHTML(event.title)}» уже почалася.</p>`;
      clearInterval(countdownTimer);
      loadCountdown();
      return;
    }

    const days = Math.floor(distance / 86400000);
    const hours = Math.floor((distance % 86400000) / 3600000);
    const minutes = Math.floor((distance % 3600000) / 60000);
    const seconds = Math.floor((distance % 60000) / 1000);

    box.innerHTML = `
      <p class="countdown-title">До події: ${escapeHTML(event.title)}</p>
      <div class="countdown-values">
        <div><strong>${days}</strong><span>днів</span></div>
        <div><strong>${String(hours).padStart(2, '0')}</strong><span>годин</span></div>
        <div><strong>${String(minutes).padStart(2, '0')}</strong><span>хвилин</span></div>
        <div><strong>${String(seconds).padStart(2, '0')}</strong><span>секунд</span></div>
      </div>
    `;
  }

  if (countdownTimer) clearInterval(countdownTimer);
  update();
  countdownTimer = setInterval(update, 1000);
}

/* ДОПОМІЖНЕ */

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

document.addEventListener('DOMContentLoaded', () => {
  $('register-open')?.addEventListener('click', openRegisterDrawer);
  $('register-close')?.addEventListener('click', closeRegisterDrawer);
  $('drawer-overlay')?.addEventListener('click', closeRegisterDrawer);
  $('login-open')?.addEventListener('click', openLogin);
  $('login-close')?.addEventListener('click', closeLogin);

  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  renderUserState();
});
