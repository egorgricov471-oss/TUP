const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    const authSection = document.getElementById('auth-section');
    const pendingSection = document.getElementById('pending-section');
    const mainSection = document.getElementById('main-section');
    const guestSection = document.getElementById('guest-section');

    // Не показуємо форму входу, поки не перевірили збережену сесію.
    [authSection, pendingSection, mainSection, guestSection].forEach(el => {
        if (el) el.style.display = 'none';
    });

    if (typeof supabase === 'undefined') {
        console.error('Помилка: бібліотека Supabase не завантажилась!');
        if (authSection) authSection.style.display = 'block';
        return;
    }

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
        }
    });

    window.login = async function() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const message = document.getElementById('auth-message');

        message.style.color = 'yellow';
        message.textContent = 'Перевірка...';

        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
            message.style.color = 'red';
            message.textContent = 'Помилка: ' + error.message;
            return;
        }

        message.style.color = 'green';
        message.textContent = 'Успішний вхід!';
        await renderUserState(db);
    };

    window.register = async function() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const message = document.getElementById('auth-message');

        const { error } = await db.auth.signUp({ email, password });
        if (error) {
            message.style.color = 'red';
            message.textContent = error.message;
        } else {
            message.style.color = 'green';
            message.textContent = 'Успішно! Тепер зачекай на схвалення адміна.';
        }
    };

    window.logout = async function() {
        const { error } = await db.auth.signOut();
        if (error) {
            console.error('Помилка виходу:', error);
            alert('Не вдалося вийти: ' + error.message);
            return;
        }
        window.location.reload();
    };

    window.showLogin = function() {
        authSection.style.display = 'block';
        if (guestSection) guestSection.style.display = 'none';
    };

    window.showPage = async function(page) {
        const area = document.getElementById('content-area');
        if (!area) return;

        area.innerHTML = '<h2>Завантаження...</h2>';

        if (page === 'news') {
            const { data, error } = await db.from('news').select('*').order('created_at', { ascending: false });
            if (error) return showContentError(area, error);
            let html = '<h2>Новини</h2>';
            if (!data?.length) html += '<p>Новин поки немає.</p>';
            else data.forEach(n => html += `<div class="card"><h3>${escapeHtml(n.title)}</h3><p>${escapeHtml(n.content)}</p></div>`);
            area.innerHTML = html;
        } else if (page === 'dates') {
            const { data, error } = await db.from('dates').select('*').order('date_month', { ascending: true }).order('date_day', { ascending: true });
            if (error) return showContentError(area, error);
            let html = '<h2>Пам’ятні дати</h2>';
            if (!data?.length) html += '<p>Дат поки немає.</p>';
            else data.forEach(d => {
                const icon = d.is_death ? '🖤' : '🎂';
                html += `<div class="card date-card ${d.is_death ? 'traur' : ''}"><strong>${escapeHtml(d.person_name)}</strong><br><small>${d.date_day}.${d.date_month}${d.date_year ? '.' + d.date_year : ''} ${icon}</small></div>`;
            });
            area.innerHTML = html;
        } else if (page === 'events') {
            const { data, error } = await db.from('events').select('*').order('event_date', { ascending: true });
            if (error) return showContentError(area, error);
            let html = '<h2>Події</h2>';
            if (!data?.length) html += '<p>Подій поки немає.</p>';
            else data.forEach(e => {
                const dateObj = new Date(e.event_date);
                html += `<div class="card"><h3>${escapeHtml(e.title)}</h3><p>${dateObj.toLocaleString('uk-UA')}</p><p>${escapeHtml(e.description || '')}</p></div>`;
            });
            area.innerHTML = html;
        }
    };

    await renderUserState(db);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function showContentError(area, error) {
    console.error('Помилка завантаження сторінки:', error);
    area.innerHTML = '<p>Не вдалося завантажити вміст. Онови сторінку або спробуй пізніше.</p>';
}

async function renderUserState(db) {
    const authSection = document.getElementById('auth-section');
    const pendingSection = document.getElementById('pending-section');
    const mainSection = document.getElementById('main-section');
    const guestSection = document.getElementById('guest-section');

    [authSection, pendingSection, mainSection, guestSection].forEach(el => {
        if (el) el.style.display = 'none';
    });

    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError) {
        console.error('Не вдалося прочитати сесію:', sessionError);
        authSection.style.display = 'block';
        return;
    }

    const user = session?.user;
    if (!user) {
        authSection.style.display = 'block';
        return;
    }

    const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('status, greeting')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
        console.error('Не вдалося завантажити профіль:', profileError);
        authSection.style.display = 'block';
        document.getElementById('auth-message').textContent =
            'Не вдалося перевірити профіль. Спробуй оновити сторінку.';
        return;
    }

    if (!profile || profile.status === 'pending') {
        pendingSection.style.display = 'block';
        return;
    }

    if (profile.status === 'approved' || profile.status === 'admin') {
        mainSection.style.display = 'block';
        if (profile.status === 'admin') {
            document.getElementById('admin-btn').style.display = 'inline-block';
        } else {
            document.getElementById('admin-btn').style.display = 'none';
        }
        document.getElementById('greeting-text').textContent = profile.greeting || 'Привіт! 👋';
        await window.showPage('news');
        return;
    }

    authSection.style.display = 'block';
}
