const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';

// Чекаємо, поки завантажиться сторінка і бібліотека
window.onload = async function() {
    if (typeof supabase === 'undefined') {
        console.error("Помилка: бібліотека Supabase не завантажилась!");
        return;
    }

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Робимо функції глобальними для HTML
    window.login = async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) document.getElementById('auth-message').innerText = error.message;
        else window.location.reload();
    };

    window.register = async function() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await db.auth.signUp({ email, password });
        if (error) document.getElementById('auth-message').innerText = error.message;
        else {
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

    // Перевірка користувача
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
                }
            }
        }
    } catch (e) {
        console.log("Користувач не залогінений");
    }
};
