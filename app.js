const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

async function checkUser() {
    try {
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
                    if (greetingElem && profile.greeting) greetingElem.innerText = profile.greeting;
                    if (profile.status === 'admin') {
                        const adminBtn = document.getElementById('admin-btn');
                        if (adminBtn) adminBtn.style.display = 'inline-block';
                    }
                    showPage('news');
                }
            }
        } else {
            showSection('guest');
            loadGuestNews();
        }
    } catch (e) {
        console.error("Помилка при перевірці користувача:", e);
    }
}

function showSection(id) {
    const sections = ['auth-section', 'pending-section', 'guest-section', 'main-section'];
    sections.forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.style.display = 'none'; // Перевіряємо, чи існує елемент
    });
    const activeEl = document.getElementById(id);
    if (activeEl) activeEl.style.display = 'block';
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
    try {
        const { data, error } = await db.from('news').select('*').eq('is_pinned', true).limit(1);
        const titleEl = document.getElementById('guest-news-title');
        const contentEl = document.getElementById('guest-news-content');
        
        // Якщо є дані і масив не порожній
        if (data && data.length > 0) {
            if (titleEl) titleEl.innerText = data[0].title;
            if (contentEl) contentEl.innerText = data[0].content;
        } else {
            if (titleEl) titleEl.innerText = "Ласкаво просимо!";
            if (contentEl) contentEl.innerText = "Щоб побачити більше, потрібно увійти в систему.";
        }
    } catch (e) { console.log("Помилка завантаження новин:", e); }
}

async function showPage(page) {
    const area = document.getElementById('content-area');
    if (!area) return; // Якщо ми не на головній сторінці, нічого не робимо

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
