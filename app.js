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


/* АВАТАР ПРОФІЛЮ */

function getAuthorName(profile, user = null) {
  return (
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    'Учасник'
  );
}

function renderProfileAvatar() {
  const image = $('profile-avatar-preview');
  const name = $('profile-name-preview');

  if (name) {
    name.textContent = getAuthorName(currentProfile, currentUser);
  }

  if (!image) return;

  if (currentProfile?.avatar_url) {
    image.src = currentProfile.avatar_url;
    image.style.display = 'block';
  } else {
    image.removeAttribute('src');
    image.style.display = 'none';
  }
}

async function uploadAvatar(file) {
  if (!currentUser) {
    throw new Error('Спочатку увійди в акаунт.');
  }

  if (!file) {
    throw new Error('Спочатку вибери зображення.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Можна завантажувати лише зображення.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Розмір зображення не повинен перевищувати 5 МБ.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
  const filePath = `${currentUser.id}/${Date.now()}.${safeExtension}`;

  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = db.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const avatarUrl = publicData.publicUrl;

  const { data: updatedProfile, error: updateError } = await db
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', currentUser.id)
    .select('*')
    .single();

  if (updateError) {
    throw updateError;
  }

  currentProfile = updatedProfile;
  renderProfileAvatar();

  return avatarUrl;
}

async function changeAvatar() {
  const input = $('profile-avatar');
  const file = input?.files?.[0];

  if (!file) {
    return notify('Спочатку вибери фото.');
  }

  try {
    await uploadAvatar(file);

    input.value = '';

    notify('Фото профілю успішно збережено.');

    await loadNews();
  } catch (error) {
    console.error('Помилка завантаження аватара:', error);
    notify('Не вдалося зберегти фото: ' + error.message);
  }
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

  const avatarInput = $('reg-avatar');

  if (avatarInput) {
    avatarInput.value = '';
  }

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

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

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

    loadDateCountdown();
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
  renderProfileAvatar();

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

    loadDateCountdown();
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

  // Таймер до найближчої дати з таблиці dates
  loadDateCountdown();
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

  const userIds = [
    ...new Set(
      data.map(comment => comment.user_id).filter(Boolean)
    )
  ];

  let profilesById = {};

  if (userIds.length) {
    const { data: profiles, error: profilesError } = await db
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    if (!profilesError && profiles) {
      profilesById = Object.fromEntries(
        profiles.map(profile => [profile.id, profile])
      );
    } else if (profilesError) {
      console.warn(
        'Не вдалося отримати профілі авторів:',
        profilesError
      );
    }
  }

  box.innerHTML = data.map(comment => {
    const profile = profilesById[comment.user_id];

    const authorName =
      profile?.full_name?.trim() ||
      (
        comment.author_name &&
        !comment.author_name.includes('@')
          ? comment.author_name
          : ''
      ) ||
      'Учасник';

    const avatar = profile?.avatar_url
      ? `
        <img
          class="comment-avatar"
          src="${escapeHTML(profile.avatar_url)}"
          alt=""
          loading="lazy"
        >
      `
      : `
        <div class="comment-avatar-placeholder">
          ${escapeHTML(authorName.charAt(0).toUpperCase())}
        </div>
      `;

    return `
      <div class="comment">
        ${avatar}

        <div class="comment-body">
          <strong>${escapeHTML(authorName)}</strong>

          <p>${escapeHTML(
            comment.content || comment.comment || ''
          )}</p>

          <time>${formatDate(comment.created_at)}</time>
        </div>
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

  const authorName = getAuthorName(currentProfile, currentUser);

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


/* ДАТИ */

function nextAnnualDate(item) {
  const day = Number(item.date_day);
  const month = Number(item.date_month);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  let year = now.getFullYear();

  // Перевіряємо найближче настання дати.
  // Для 29 лютого шукаємо наступний рік,
  // у якому ця дата справді існує.
  for (let i = 0; i <= 8; i++) {
    const candidate = new Date(year + i, month - 1, day);

    if (
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      continue;
    }

    if (candidate >= today) {
      return candidate;
    }
  }

  return null;
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
    .map(item => ({
      ...item,
      nextDate: nextAnnualDate(item)
    }))
    .filter(item => item.nextDate)
    .sort((a, b) => a.nextDate - b.nextDate);

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
          ${item.nextDate.toLocaleDateString('uk-UA')}
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


/* ТАЙМЕР ДО НАЙБЛИЖЧОЇ ДАТИ З ТАБЛИЦІ dates */

async function loadDateCountdown() {
  const guestBox = $('guest-countdown');
  const memberBox = $('member-countdown');
  const guestTitle = $('guest-event-title');
  const memberTitle = $('member-event-title');

  const countdownBoxes = [
    guestBox,
    memberBox
  ].filter(Boolean);

  const titleBoxes = [
    guestTitle,
    memberTitle
  ].filter(Boolean);

  // Прибираємо попередній таймер,
  // щоб не запускалося кілька інтервалів одночасно.
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  countdownBoxes.forEach(box => {
    box.textContent = 'Завантажуємо дати…';
  });

  titleBoxes.forEach(box => {
    box.textContent = '';
  });

  // Завантажуємо саме дати, а не події.
  const { data, error } = await db
    .from('dates')
    .select('person_name, date_day, date_month, date_year, is_death, date_type, date_status, description');

  if (error) {
    console.error('Помилка завантаження дат для таймера:', error);

    countdownBoxes.forEach(box => {
      box.textContent = 'Не вдалося завантажити дати.';
    });

    return;
  }

  // Знаходимо найближчу дату.
  const upcomingDates = (data || [])
    .filter(item => item.date_type !== 'event')
    .map(item => ({
      ...item,
      nextDate: nextAnnualDate(item)
    }))
    .filter(item => item.nextDate)
    .sort((a, b) => a.nextDate - b.nextDate);

  if (!upcomingDates.length) {
    countdownBoxes.forEach(box => {
      box.textContent = 'Дат поки немає.';
    });

    titleBoxes.forEach(box => {
      box.textContent = '';
    });

    return;
  }

  const nearestDate = upcomingDates[0];

  const dateLabel = [
    String(nearestDate.date_day).padStart(2, '0'),
    String(nearestDate.date_month).padStart(2, '0')
  ].join('.');

  const title = `${nearestDate.person_name} — ${dateLabel}`;

  titleBoxes.forEach(box => {
    box.textContent = title;
  });

  // Оновлюємо відлік щосекунди.
  function updateTimer() {
    const now = new Date();

    const difference =
      nearestDate.nextDate.getTime() - now.getTime();

    if (difference <= 0) {
      countdownBoxes.forEach(box => {
        box.innerHTML = `
          <div class="countdown-values">
            <div>
              <strong>0</strong>
              <span>днів</span>
            </div>
            <div>
              <strong>00</strong>
              <span>годин</span>
            </div>
            <div>
              <strong>00</strong>
              <span>хвилин</span>
            </div>
            <div>
              <strong>00</strong>
              <span>секунд</span>
            </div>
          </div>
        `;
      });

      clearInterval(countdownTimer);
      countdownTimer = null;

      return;
    }

    const days = Math.floor(difference / 86400000);

    const hours = Math.floor(
      (difference % 86400000) / 3600000
    );

    const minutes = Math.floor(
      (difference % 3600000) / 60000
    );

    const seconds = Math.floor(
      (difference % 60000) / 1000
    );

    const timerHTML = `
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

    countdownBoxes.forEach(box => {
      box.innerHTML = timerHTML;
    });
  }

  updateTimer();

  countdownTimer = setInterval(updateTimer, 1000);
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
