const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

// ЗМІНИЛИ НАЗВУ НА db, щоб не було конфлікту
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

async function checkUser() {
    const { data: { user } } = await db.auth.getUser();
    if (user) {
        currentUser = user;
        const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
        
        if (profile) {
            if (profile.status === 'pending') {
                showSection('pending');
            } else if (profile.status === 'approved' || profile.status === 'admin') {
                showSection('main');
                const greetingElem = document.getElementById('greeting-text');
                if (profile.greeting) greetingElem.innerText = profile.greeting;
                if (profile.status === 'admin') document.getElementById('admin-btn').style.display = 'inline-block';
                showPage('news');
            }
        }
    } else {
        showSection('guest');
        loadGuestNews();
    }
}

function showSection(id) {
    ['auth-section', 'pending-section', 'guest-section', 'main-section'].forEach(sec => {
        document.getElementById(sec).style.display = 'none';
    });
    document.getElementById(id).style.display = 'block';
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) document.getElementById('auth-message').innerText = error.message;
    else window.location.reload();
}

async function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await db.auth.signUp({ email, password });
    if (error) document.getElementById('auth-message').innerText = error.message;
    else {
        document.getElementById('auth-message').style.color = 'green';
        document.getElementById('auth-message').innerText = 'Успішно! Тепер зачекай на схвалення адміна.';
    }
}

async function logout() {
    await db.auth.signOut();
    window.location.reload();
}

function showLogin() { showSection('auth-section'); }

async function loadGuestNews() {
    const { data } = await db.from('news').select('*').eq('is_pinned', true).single();
    if (data) {
        document.getElementById('guest-news-title').innerText = data.title;
        document.getElementById('guest-news-content').innerText = data.content;
    } else {
        document.getElementById('guest-news-title').innerText = "Ласкаво просимо!";
        document.getElementById('guest-news-content').innerText = "Щоб побачити більше, потрібно увійти в систему.";
    }
}

async function showPage(page) {
    const area = document.getElementById('content-area');
    if (page === 'news') {
        area.innerHTML = '<h2>Новини</h2><p>Завантаження...</p>';
        const { data } = await db.from('news').select('*').order('created_at', { ascending: false });
        let html = '<h2>Новини</h2>';
        if (!data || data.length === 0) html += '<p>Новин поки немає.</p>';
        else data.forEach(n => html += `<div class="card"><h3>${n.title}</h3><p>${n.content}</p></div>`);
        area.innerHTML = html;
    } else if (page === 'dates') {
        area.innerHTML = '<h2>Пам\'ятні дати</h2><p>Завантаження...</p>';
        const { data } = await db.from('dates').select('*').order('date_month', { ascending: true }).order('date_day', { ascending: true });
        let html = '<h2>Пам\'ятні дати</h2>';
        if (!data || data.length === 0) html += '<p>Дат поки немає.</p>';
        else data.forEach(d => {
            const isTraur = d.is_death ? 'traur' : '';
            const icon = d.is_death ? '🖤' : '🎂';
            html += `<div class="card date-card ${isTraur}"><strong>${d.person_name}</strong><br><small>${d.date_day}.${d.date_month}${d.date_year ? '.' + d.date_year : ''} ${icon}</small></div>`;
        });
        area.innerHTML = html;
    } else if (page === 'events') {
        area.innerHTML = '<h2>Події</h2><p>Завантаження...</p>';
        const { data } = await db.from('events').select('*').order('event_date', { ascending: true });
        let html = '<h2>Події</h2>';
        if (!data || data.length === 0) html += '<p>Подій поки немає.</p>';
        else data.forEach(e => {
            const dateObj = new Date(e.event_date);
            html += `<div class="card"><h3>${e.title}</h3><p>${dateObj.toLocaleString('uk-UA')}</p><p>${e.description || ''}</p></div>`;
        });
        area.innerHTML = html;
    }
}

checkUser();
