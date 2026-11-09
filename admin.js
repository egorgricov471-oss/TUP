const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
    }
});

let currentUser = null;

async function checkAdmin() {
    const { data: { user }, error: authError } = await db.auth.getUser();

    if (authError || !user) {
        window.location.replace('index.html');
        return;
    }

    const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('Не вдалося перевірити профіль:', profileError);
        alert('Не вдалося перевірити права доступу. Спробуй оновити сторінку.');
        window.location.replace('index.html');
        return;
    }

    if (profile.status !== 'admin') {
        alert('Доступ заборонено. Ви не адміністратор.');
        window.location.replace('index.html');
        return;
    }

    currentUser = user;
    await Promise.all([loadUsers(), loadNews(), loadDates(), loadEvents()]);
}

function showRequestError(action, error) {
    console.error(`${action}:`, error);
    const message = error?.message || 'Невідома помилка';
    alert(`${action}. Деталі: ${message}`);
}

function switchTab(tab) {
    ['users', 'news', 'dates', 'events'].forEach(t => {
        document.getElementById(`section-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('active');
        document.getElementById(`tab-${t}`).classList.add('inactive');
    });
    document.getElementById(`section-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.remove('inactive');
}

async function loadUsers() {
    const pList = document.getElementById('pending-users-list');
    const aList = document.getElementById('approved-users-list');

    const [{ data: pending, error: pendingError }, { data: approved, error: approvedError }] = await Promise.all([
        db.from('profiles').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
        db.from('profiles').select('*').eq('status', 'approved').order('created_at', { ascending: true })
    ]);

    if (pendingError || approvedError) {
        showRequestError('Не вдалося завантажити користувачів', pendingError || approvedError);
        return;
    }

    pList.innerHTML = '';
    if (!pending?.length) {
        pList.innerHTML = '<p>Немає нових заявок.</p>';
    } else {
        pending.forEach(u => {
            const item = document.createElement('div');
            item.className = 'list-item';

            const info = document.createElement('div');
            info.className = 'info';
            const email = document.createElement('strong');
            email.textContent = u.email || '(без email)';
            info.appendChild(email);

            const actions = document.createElement('div');
            const greetingInput = document.createElement('input');
            greetingInput.type = 'text';
            greetingInput.id = `greet-${u.id}`;
            greetingInput.placeholder = 'Привітання...';
            greetingInput.style.cssText = 'width: 150px; display:inline-block;';
            const approveButton = document.createElement('button');
            approveButton.textContent = 'Схвалити';
            approveButton.addEventListener('click', () => approveUser(u.id));
            const rejectButton = document.createElement('button');
            rejectButton.className = 'secondary';
            rejectButton.style.color = 'red';
            rejectButton.textContent = 'Відхилити';
            rejectButton.addEventListener('click', () => deleteUser(u.id));

            actions.append(greetingInput, approveButton, rejectButton);
            item.append(info, actions);
            pList.appendChild(item);
        });
    }

    aList.innerHTML = '';
    if (!approved?.length) {
        aList.innerHTML = '<p>Немає схвалених друзів.</p>';
    } else {
        approved.forEach(u => {
            const item = document.createElement('div');
            item.className = 'list-item';

            const info = document.createElement('div');
            info.className = 'info';
            const email = document.createElement('strong');
            email.textContent = u.email || '(без email)';
            const greeting = document.createElement('small');
            greeting.style.color = '#4CAF50';
            greeting.textContent = `Привітання: ${u.greeting || 'Не задано'}`;
            info.append(email, document.createElement('br'), greeting);

            const actions = document.createElement('div');
            const greetingInput = document.createElement('input');
            greetingInput.type = 'text';
            greetingInput.id = `edit-greet-${u.id}`;
            greetingInput.placeholder = u.greeting || 'Нове привітання';
            greetingInput.style.cssText = 'width: 150px; display:inline-block;';
            const updateButton = document.createElement('button');
            updateButton.textContent = 'Змінити';
            updateButton.addEventListener('click', () => updateGreeting(u.id));
            const deleteButton = document.createElement('button');
            deleteButton.className = 'secondary';
            deleteButton.style.color = 'red';
            deleteButton.textContent = 'Видалити';
            deleteButton.addEventListener('click', () => deleteUser(u.id));

            actions.append(greetingInput, updateButton, deleteButton);
            item.append(info, actions);
            aList.appendChild(item);
        });
    }
}

async function approveUser(id) {
    const input = document.getElementById(`greet-${id}`);
    const greet = input ? input.value.trim() : '';

    const { error } = await db
        .from('profiles')
        .update({ status: 'approved', greeting: greet })
        .eq('id', id);

    if (error) {
        showRequestError('Не вдалося схвалити користувача', error);
        return;
    }

    alert('Користувача схвалено.');
    await loadUsers();
}

async function updateGreeting(id) {
    const input = document.getElementById(`edit-greet-${id}`);
    const greet = input ? input.value.trim() : '';

    const { error } = await db
        .from('profiles')
        .update({ greeting: greet })
        .eq('id', id);

    if (error) {
        showRequestError('Не вдалося змінити привітання', error);
        return;
    }

    await loadUsers();
}

async function deleteUser(id) {
    if (!confirm('Видалити профіль цього користувача? Його обліковий запис Auth при цьому не видаляється.')) return;

    const { error } = await db.from('profiles').delete().eq('id', id);
    if (error) {
        showRequestError('Не вдалося видалити профіль', error);
        return;
    }
    await loadUsers();
}

async function loadNews() {
    const { data, error } = await db.from('news').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('news-list');
    if (error) return showRequestError('Не вдалося завантажити новини', error);

    list.innerHTML = '';
    (data || []).forEach(n => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const info = document.createElement('div');
        info.className = 'info';
        const title = document.createElement('strong');
        title.textContent = `${n.title}${n.is_pinned ? ' 📌' : ''}`;
        const excerpt = document.createElement('small');
        excerpt.textContent = (n.content || '').substring(0, 50) + '...';
        info.append(title, document.createElement('br'), excerpt);
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Видалити';
        button.addEventListener('click', () => deleteNews(n.id));
        item.append(info, button);
        list.appendChild(item);
    });
}

async function addNews() {
    const title = document.getElementById('news-title').value.trim();
    const content = document.getElementById('news-content').value.trim();
    const is_pinned = document.getElementById('news-pinned').checked;
    if (!title || !content) return alert('Заповніть всі поля!');

    if (is_pinned) {
        const { error: unpinError } = await db.from('news').update({ is_pinned: false }).neq('id', 0);
        if (unpinError) return showRequestError('Не вдалося оновити закріплені новини', unpinError);
    }

    const { error } = await db.from('news').insert([{ title, content, is_pinned }]);
    if (error) return showRequestError('Не вдалося додати новину', error);

    document.getElementById('news-title').value = '';
    document.getElementById('news-content').value = '';
    document.getElementById('news-pinned').checked = false;
    await loadNews();
}

async function deleteNews(id) {
    if (!confirm('Видалити новину?')) return;
    const { error } = await db.from('news').delete().eq('id', id);
    if (error) return showRequestError('Не вдалося видалити новину', error);
    await loadNews();
}

async function loadDates() {
    const { data, error } = await db.from('dates').select('*');
    const list = document.getElementById('dates-list');
    if (error) return showRequestError('Не вдалося завантажити дати', error);
    const now = new Date();
    const upcoming = (data || []).map(d => {
        let next = new Date(now.getFullYear(), Number(d.date_month) - 1, Number(d.date_day));
        if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, Number(d.date_month) - 1, Number(d.date_day));
        return { ...d, next };
    }).sort((a, b) => a.next - b.next);
    list.innerHTML = '';
    upcoming.forEach(d => {
        const item = document.createElement('div');
        const type = d.date_type || (d.is_death ? 'death' : 'birthday');
        item.className = `list-item ${type === 'death' ? 'death' : ''}`;
        const info = document.createElement('div'); info.className = 'info';
        const name = document.createElement('strong'); name.textContent = d.person_name;
        const detail = document.createElement('small');
        const label = type === 'death' ? 'День пам’яті' : type === 'event' ? 'Пам’ятна подія' : 'День народження / іменини';
        detail.textContent = `${d.date_day}.${d.date_month}${d.date_year ? '.' + d.date_year : ''} — ${label}${d.description ? ' · ' + d.description : ''}`;
        info.append(name, document.createElement('br'), detail);
        const button = document.createElement('button'); button.className = 'secondary'; button.textContent = 'Видалити'; button.addEventListener('click', () => deleteDate(d.id));
        item.append(info, button); list.appendChild(item);
    });
}

async function addDate() {
    const name = document.getElementById('date-name').value.trim();
    const day = parseInt(document.getElementById('date-day').value, 10);
    const month = parseInt(document.getElementById('date-month').value, 10);
    const year = parseInt(document.getElementById('date-year').value, 10) || null;
    const date_type = document.getElementById('date-type').value;
    const description = document.getElementById('date-description').value.trim();
    const is_death = date_type === 'death';
    const check = new Date(2024, month - 1, day);
    if (!name || !day || !month) return alert("Заповніть назву, день та місяць!");
    if (day < 1 || day > 31 || month < 1 || month > 12 || check.getDate() !== day || check.getMonth() !== month - 1) return alert('Перевірте день та місяць.');
    const { error } = await db.from('dates').insert([{ person_name: name, date_day: day, date_month: month, date_year: year, is_death, date_type, description }]);
    if (error) return showRequestError('Не вдалося додати дату', error);
    ['date-name','date-day','date-month','date-year','date-description'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('date-type').value = 'birthday';
    await loadDates();
}

async function deleteDate(id) {
    if (!confirm('Видалити цю дату?')) return;
    const { error } = await db.from('dates').delete().eq('id', id);
    if (error) return showRequestError('Не вдалося видалити дату', error);
    await loadDates();
}

async function loadEvents() {
    const { data, error } = await db.from('events').select('*').order('event_date', { ascending: true });
    const list = document.getElementById('events-list');
    if (error) return showRequestError('Не вдалося завантажити події', error);

    list.innerHTML = '';
    (data || []).forEach(e => {
        const item = document.createElement('div');
        item.className = 'list-item';
        const info = document.createElement('div');
        info.className = 'info';
        const title = document.createElement('strong');
        title.textContent = e.title;
        const detail = document.createElement('small');
        detail.textContent = `${new Date(e.event_date).toLocaleString('uk-UA')} — ${e.description || ''}`;
        info.append(title, document.createElement('br'), detail);
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Видалити';
        button.addEventListener('click', () => deleteEvent(e.id));
        item.append(info, button);
        list.appendChild(item);
    });
}

async function addEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const desc = document.getElementById('event-desc').value.trim();
    if (!title || !date) return alert('Заповніть назву та дату!');

    const { error } = await db.from('events').insert([{ title, event_date: new Date(date).toISOString(), description: desc }]);
    if (error) return showRequestError('Не вдалося створити подію', error);

    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-desc').value = '';
    await loadEvents();
}

async function deleteEvent(id) {
    if (!confirm('Видалити подію?')) return;
    const { error } = await db.from('events').delete().eq('id', id);
    if (error) return showRequestError('Не вдалося видалити подію', error);
    await loadEvents();
}

checkAdmin();
