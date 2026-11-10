
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

/* БЕЗПЕЧНЕ ВІДОБРАЖЕННЯ ТЕКСТУ */

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

/* ВХІД І РЕЄСТРАЦІЯ */

function showLogin() {
  $('guest-section').hidden = true;
  $('auth-section').style.display = 'flex';
}

function closeLogin() {
  $('auth-section').style.display = 'none';

  if (!currentUser) {
    $('guest-section').hidden = false;
  }
}

function openRegister() {
  const drawer = $('register-drawer');

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
}

function closeRegister() {
  const drawer = $('register-drawer');

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
}

async function login(event) {
  event.preventDefault();

  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password) {
    return notify('Введи електронну пошту та пароль.');
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return notify('Помилка входу: ' + error.message);
  }

  $('auth-section').style.display = 'none';
  await renderUserState();
}

async function register(event) {
  event.preventDefault();

  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim();
  const password = $('reg-password').value;

  if (!name || !email || password.length < 6) {
    return notify(
      'Заповни всі поля. Пароль має містити щонайменше 6 символів.'
    );
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) {
    return notify('Помилка реєстрації: ' + error.message);
  }

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

      return notify(
        'Акаунт створено, але профіль не записано: ' +
        profileError.message
      );
    }
  }

  $('reg-name').value = '';
  $('reg-email').value = '';
  $('reg-password').value = '';

  closeRegister();

  if (data.session) {
    await renderUserState();
  } else {
    notify(
      'Заявку створено. Якщо підтвердження пошти увімкнене, ' +
      'спочатку підтверди адресу через лист.'
    );
  }
}

async function logout() {
  const { error } = await db.auth.signOut();

  if (error) {
    return notify('Не вдалося вийти: ' + error.message);
  }

  currentUser = null;
  currentProfile = null;

  location.reload();
}

/* СТАН КОРИСТУВАЧА */

async function renderUserState() {
  const {
    data: { user },
    error: authError
  } = await db.auth.getUser();

  if (authError) {
    console.error(authError);
    return;
  }

  currentUser = user || null;

  const guest = $('guest-section');
  const pending = $('pending-section');
  const main = $('main-section');
  const admin = $('admin-btn');

  if (!user) {
    guest.hidden = false;
    pending.style.display = 'none';
    main.style.display = 'none';
    admin.style.display = 'none';

    loadCountdown();
    return;
  }

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return notify(
      'Помилка завантаження профілю: ' + error.message
    );
  }

  currentProfile = profile;

  guest.hidden = true;
  $('auth-section').style.display = 'none';

  if (!profile || profile.status === 'pending') {
    pending.style.display = 'block';
    main.style.display = 'none';
    admin.style.display = 'none';

    $('pending-greeting').textContent =
      profile?.greeting ||
      'Твоя заявка очікує схвалення адміністратора.';

    return;
  }

  if (!['approved', 'admin'].includes(profile.status)) {
    pending.style.display = 'none';
    main.style.display = 'none';
    guest.hidden = false;
    return;
  }

  pending.style.display = 'none';
  main.style.display = 'block';

  admin.style.display =
    profile.status === 'admin' ? 'inline-flex' : 'none';

  $('greeting-text').textContent =
    profile.greeting ||
    `Вітаємо, ${profile.full_name || 'учаснику'}!`;

  showPage('news');
  loadCountdown();
}

/* НАВІГАЦІЯ */

function showPage(page) {
  document.querySelectorAll('.page').forEach(section => {
    section.hidden = section.id !== `page-${page}`;
  });

  document.querySelectorAll('[data-page]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.page === page
    );
  });

  if (page === 'news') loadNews();
  if (page === 'dates') loadDates();
  if (page === 'events') loadEvents();
}

/* НОВИНИ */

async function loadNews() {
  const box = $('page-news');

  if (!box) return;

  box.innerHTML = '<p>Завантаження новин...</p>';

  const { data, error } = await db
    .from('news')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent =
      'Помилка завантаження новин: ' + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Новин поки немає.</p>';
    return;
  }

  box.innerHTML = data.map(item => `
    <article class="news-card">
      <h3>${escapeHTML(item.title)}</h3>

      <p class="news-date">
        ${formatDate(item.created_at)}
      </p>

      <div class="news-content">
        ${escapeHTML(item.content).replace(/\n/g, '<br>')}
      </div>

      <section class="comments-section">
        <h4>Коментарі</h4>

        <div id="comments-${escapeHTML(item.id)}">
          Завантаження...
        </div>

        <form onsubmit="addComment(event, '${escapeHTML(item.id)}')">
          <textarea
            name="comment"
            placeholder="Написати коментар..."
            required
          ></textarea>

          <button type="submit">Надіслати</button>
        </form>
      </section>
    </article>
  `).join('');

  for (const item of data) {
    await loadComments(item.id);
  }
}

/* ІМЕНА АВТОРІВ І КОМЕНТАРІ */

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
    console.error('Помилка завантаження коментарів:', error);
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Коментарів поки немає.</p>';
    return;
  }

  // Отримуємо профілі авторів старих коментарів.
  const userIds = [
    ...new Set(
      data.map(comment => comment.user_id).filter(Boolean)
    )
  ];

  let profilesById = {};

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await db
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    if (!profilesError && profiles) {
      profilesById = Object.fromEntries(
        profiles.map(profile => [
          profile.id,
          profile.full_name
        ])
      );
    } else if (profilesError) {
      console.warn(
        'Не вдалося отримати імена профілів:',
        profilesError
      );
    }
  }

  box.innerHTML = data.map(comment => {
    const profileName = profilesById[comment.user_id];
    const savedName = comment.author_name || '';

    const authorName =
      profileName?.trim() ||
      (
        savedName && !savedName.includes('@')
          ? savedName
          : ''
      ) ||
      'Учасник';

    return `
      <div class="comment">
        <strong>${escapeHTML(authorName)}</strong>

        <p>
          ${escapeHTML(
            comment.content || comment.comment || ''
          )}
        </p>

        <time>${formatDate(comment.created_at)}</time>
      </div>
    `;
  }).join('');
}

async function addComment(event, newsId) {
  event.preventDefault();

  if (!currentUser || !currentProfile) {
    return notify('Увійди в акаунт, щоб коментувати.');
  }

  const form = event.currentTarget;
  const content = form.elements.comment.value.trim();

  if (!content) return;

  // Ім'я беремо з профілю, ніколи не підставляємо email.
  const authorName =
    currentProfile.full_name?.trim() ||
    currentUser.user_metadata?.full_name?.trim() ||
    'Учасник';

  const { error } = await db
    .from('comments')
    .insert([{
      news_id: newsId,
      user_id: currentUser.id,
      author_name: authorName,
      content: content
    }]);

  if (error) {
    console.error('Помилка коментаря:', error);

    return notify(
      'Помилка коментаря: ' + error.message
    );
  }

  form.reset();

  await loadComments(newsId);
}

/* ДАТИ: ДВА НЕЗАЛЕЖНІ ТЕГИ */

function nextAnnualDate(item) {
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let next = new Date(
    now.getFullYear(),
    Number(item.date_month) - 1,
    Number(item.date_day)
  );

  if (next < today) {
    next = new Date(
      now.getFullYear() + 1,
      Number(item.date_month) - 1,
      Number(item.date_day)
    );
  }

  return next;
}

function getDateTypeLabel(type) {
  const labels = {
    birthday: 'Іменини',
    death: 'Смерть',
    other: 'Інше'
  };

  return labels[type] || 'Інше';
}

function getDateStatusLabel(status) {
  const labels = {
    holiday: 'Свято',
    grief: 'Траур',
    none: ''
  };

  return labels[status] || '';
}

async function loadDates() {
  const box = $('page-dates');

  if (!box) return;

  box.innerHTML = '<p>Завантаження дат...</p>';

  const { data, error } = await db
    .from('dates')
    .select('*');

  if (error) {
    box.textContent =
      'Помилка завантаження дат: ' + error.message;
    return;
  }

  const dates = (data || [])
    .filter(item => item.date_type !== 'event')
    .sort(
      (a, b) =>
        nextAnnualDate(a) - nextAnnualDate(b)
    );

  if (!dates.length) {
    box.innerHTML = '<p>Записів поки немає.</p>';
    return;
  }

  const visible = showingAllDates
    ? dates
    : dates.slice(0, 10);

  box.innerHTML = visible.map(item => {
    const date = [
      String(item.date_day).padStart(2, '0'),
      String(item.date_month).padStart(2, '0'),
      item.date_year || ''
    ].filter(Boolean).join('.');

    const type = item.date_type ||
      (item.is_death ? 'death' : 'birthday');

    const status = item.date_status || 'none';

    const statusClass =
      status === 'holiday'
        ? 'date-status-holiday'
        : status === 'grief'
          ? 'date-status-grief'
          : '';

    const statusLabel = getDateStatusLabel(status);

    return `
      <article class="date-card ${statusClass}">
        <div class="date-card-top">
          <div class="date-tags">
            <span class="date-type date-type-${escapeHTML(type)}">
              ${getDateTypeLabel(type)}
            </span>

            ${
              statusLabel
                ? `<span class="date-status date-status-${escapeHTML(status)}">
                    ${statusLabel}
                  </span>`
                : ''
            }
          </div>

          <time>${escapeHTML(date)}</time>
        </div>

        <h3>${escapeHTML(item.person_name)}</h3>

        ${
          item.description
            ? `<p>${escapeHTML(item.description)}</p>`
            : ''
        }

        <small>
          Найближча дата:
          ${nextAnnualDate(item).toLocaleDateString('uk-UA')}
        </small>
      </article>
    `;
  }).join('');

  if (dates.length > 10) {
    box.innerHTML += `
      <button
        class="show-all-button"
        onclick="toggleAllDates()"
      >
        ${showingAllDates
          ? 'Показати менше'
          : 'Переглянути всі'}
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
  const box = $('page-events');

  if (!box) return;

  box.innerHTML = '<p>Завантаження подій...</p>';

  const { data, error } = await db
    .from('events')
    .select('*')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true });

  if (error) {
    box.textContent =
      'Помилка завантаження подій: ' + error.message;
    return;
  }

  if (!data?.length) {
    box.innerHTML = '<p>Найближчих подій поки немає.</p>';
    return;
  }

  const labels = {
    holiday: 'Свято',
    grief: 'Траур',
    other: 'Інше'
  };

  box.innerHTML = data.map(item => `
    <article class="event-card event-${escapeHTML(item.event_type || 'other')}">
      <span class="event-type">
        ${labels[item.event_type] || 'Інше'}
      </span>

      <h3>${escapeHTML(item.title)}</h3>

      <time>
        ${new Date(item.event_date).toLocaleString('uk-UA', {
          dateStyle: 'long',
          timeStyle: 'short'
        })}
      </time>

      ${
        item.description
          ? `<p>${escapeHTML(item.description)}</p>`
          : ''
      }
    </article>
  `).join('');
}

/* ЛІЧИЛЬНИКИ */

async function loadCountdown() {
  const guestBox = $('guest-countdown');
  const memberBox = $('member-countdown');
  const guestTitle = $('guest-event-title');
  const memberTitle = $('member-event-title');

  const { data, error } = await db
    .from('events')
    .select('title,event_date')
    .gte('event_date', new Date().toISOString())
    .order('event_date', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Помилка відліку:', error);

    if (guestBox) {
      guestBox.textContent = 'Не вдалося завантажити подію.';
    }

    if (memberBox) {
      memberBox.textContent = 'Не вдалося завантажити подію.';
    }

    return;
  }

  if (!data?.length) {
    if (guestBox) {
      guestBox.textContent = 'Найближчих подій поки немає.';
    }

    if (memberBox) {
      memberBox.textContent = 'Найближчих подій поки немає.';
    }

    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    return;
  }

  const event = data[0];
  const target = new Date(event.event_date).getTime();

  function update() {
    const distance = target - Date.now();

    if (distance <= 0) {
      if (guestBox) {
        guestBox.textContent = 'Подія вже почалася.';
      }

      if (memberBox) {
        memberBox.textContent = 'Подія вже почалася.';
      }

      clearInterval(countdownTimer);
      countdownTimer = null;

      loadCountdown();
      return;
    }

    const days = Math.floor(distance / 86400000);
    const hours = Math.floor(
      distance % 86400000 / 3600000
    );
    const minutes = Math.floor(
      distance % 3600000 / 60000
    );
    const seconds = Math.floor(
      distance % 60000 / 1000
    );

    const html = `
      <div class="countdown-values">
        <div>
          <strong>${days}</strong>
          <span>днів</span>
        </div>

        <div>
          <strong>${String(hours).padStart(2, '0')}</strong>
          <span>годин</span>
        </div>

        <div>
          <strong>${String(minutes).padStart(2, '0')}</strong>
          <span>хвилин</span>
        </div>

        <div>
          <strong>${String(seconds).padStart(2, '0')}</strong>
          <span>секунд</span>
        </div>
      </div>
    `;

    if (guestBox) guestBox.innerHTML = html;
    if (memberBox) memberBox.innerHTML = html;

    if (guestTitle) {
      guestTitle.textContent = event.title;
    }

    if (memberTitle) {
      memberTitle.textContent = event.title;
    }
  }

  if (countdownTimer) {
    clearInterval(countdownTimer);
  }

  update();

  countdownTimer = setInterval(update, 1000);
}

/* ФОРМАТУВАННЯ ДАТ */

function formatDate(value) {
  if (!value) return '';

  return new Date(value).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

/* ЗАПУСК */

document.addEventListener('DOMContentLoaded', async () => {
  const drawer = $('register-drawer');

  drawer?.addEventListener('click', event => {
    if (event.target === drawer) {
      closeRegister();
    }
  });

  await renderUserState();
});
