const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

window.onload = async function() {
    if (typeof supabase === 'undefined') {
        console.error("Помилка: бібліотека Supabase не завантажилась!");
        return;
    }

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Функції для HTML
    window.login = async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        document.getElementById('auth-message').style.color = 'yellow';
        document.getElementById('auth-message').innerText = 'Перевірка...';

        const { data, error } = await db.auth.signInWithPassword({ email, password });
        
        if (error) {
            document.getElementById('auth-message').style.color = 'red';
            document.getElementById('auth-message').innerText = "Помилка: " + error.message;
        } else {
            document.getElementById('auth-message').style.color = 'green';
            document.getElementById('auth-message').innerText = 'Успішний вхід! Зачекайте...';
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    };

    window.register = async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await db.auth.signUp({ email, password });
        if (error) {
            document.getElementById('auth-message').style.color = 'red';
            document.getElementById('auth-message').innerText = error.message;
        } else {
            document.getElementById('auth-message').style.color = 'green';
            document.getElementById('auth-message').innerText = 'Успішно! Тепер зачекай на схвалення адміна.';
        }
    };

    window.logout = async function() {
        await db.auth.signOut();
        window.location.reload();
    };

    window.showLogin = function() {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('guest-section').style.display = 'none';
    };

    window.showPage = async function(page) {
        const area = document.getElementById('content-area');
        if (!area) return;

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
    };

    // Перевірка користувача при завантаженні
    try {
        const { data: { user } } = await db.auth.getUser();
        if (user) {
            const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
            if (profile) {
                document.getElementById('auth-section').style.display = 'none';
                if (profile.status === 'pending') {
                    document.getElementById('pending-section').style.display = 'block';
                } else if (profile.status === 'approved' || profile.status === 'admin') {
                    document.getElementById('main-section').style.display = 'block';
                    if (profile.status === 'admin') {
                        document.getElementById('admin-btn').style.display = 'inline-block';
                    }
                    if (profile.greeting) {
                        document.getElementById('greeting-text').innerText = profile.greeting;
                    }
                    // Завантажуємо новини за замовчуванням
                    window.showPage('news');
                }
            } else {
                document.getElementById('auth-section').style.display = 'none';
                document.getElementById('pending-section').style.display = 'block';
            }
        }
    } catch (e) {
        console.log("Користувач не залогінений або сталася помилка:", e);
    }
};
