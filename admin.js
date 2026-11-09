const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'index.html'; return; }
    
    const { data: profile } = await supabase.from('profiles').select('status').eq('id', user.id).single();
    if (profile.status !== 'admin') {
        alert("Доступ заборонено. Ви не адмін.");
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    loadUsers();
    loadNews();
    loadDates();
    loadEvents();
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
    const { data: pending } = await supabase.from('profiles').select('*').eq('status', 'pending');
    const { data: approved } = await supabase.from('profiles').select('*').eq('status', 'approved');

    const pList = document.getElementById('pending-users-list');
    pList.innerHTML = pending.length ? '' : '<p>Немає нових заявок.</p>';
    pending.forEach(u => {
        pList.innerHTML += `
            <div class="list-item">
                <div class="info"><strong>${u.email}</strong></div>
                <div>
                    <input type="text" id="greet-${u.id}" placeholder="Привітання..." style="width: 150px; display:inline-block;">
                    <button onclick="approveUser('${u.id}')">Схвалити</button>
                    <button class="secondary" style="color:red;" onclick="deleteUser('${u.id}')">Відхилити</button>
                </div>
            </div>`;
    });

    const aList = document.getElementById('approved-users-list');
    aList.innerHTML = approved.length ? '' : '<p>Немає схвалених друзів.</p>';
    approved.forEach(u => {
        aList.innerHTML += `
            <div class="list-item">
                <div class="info"><strong>${u.email}</strong> <br><small style="color:#4CAF50;">Привітання: ${u.greeting || 'Не задано'}</small></div>
                <div>
                    <input type="text" id="edit-greet-${u.id}" placeholder="${u.greeting || 'Нове привітання'}" style="width: 150px; display:inline-block;">
                    <button onclick="updateGreeting('${u.id}')">Змінити</button>
                    <button class="secondary" style="color:red;" onclick="deleteUser('${u.id}')">Видалити</button>
                </div>
            </div>`;
    });
}

async function approveUser(id) {
    const greet = document.getElementById(`greet-${id}`).value;
    await supabase.from('profiles').update({ status: 'approved', greeting: greet }).eq('id', id);
    loadUsers();
}

async function updateGreeting(id) {
    const greet = document.getElementById(`edit-greet-${id}`).value;
    await supabase.from('profiles').update({ greeting: greet }).eq('id', id);
    loadUsers();
}

async function deleteUser(id) {
    if(confirm("Видалити цього користувача назавжди?")) {
        await supabase.from('profiles').delete().eq('id', id);
        loadUsers();
    }
}

async function loadNews() {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('news-list');
    list.innerHTML = '';
    data.forEach(n => {
        list.innerHTML += `
            <div class="list-item">
                <div class="info"><strong>${n.title}</strong> ${n.is_pinned ? '📌' : ''}<br><small>${n.content.substring(0, 50)}...</small></div>
                <div><button class="secondary" onclick="deleteNews(${n.id})">Видалити</button></div>
            </div>`;
    });
}

async function addNews() {
    const title = document.getElementById('news-title').value;
    const content = document.getElementById('news-content').value;
    const is_pinned = document.getElementById('news-pinned').checked;
    if(!title || !content) return alert("Заповніть всі поля!");
    if (is_pinned) await supabase.from('news').update({ is_pinned: false }).neq('id', 0);
    await supabase.from('news').insert([{ title, content, is_pinned }]);
    document.getElementById('news-title').value = '';
    document.getElementById('news-content').value = '';
    document.getElementById('news-pinned').checked = false;
    loadNews();
}

async function deleteNews(id) {
    if(confirm("Видалити новину?")) {
        await supabase.from('news').delete().eq('id', id);
        loadNews();
    }
}

async function loadDates() {
    const { data } = await supabase.from('dates').select('*').order('date_month', { ascending: true }).order('date_day', { ascending: true });
    const list = document.getElementById('dates-list');
    list.innerHTML = '';
    data.forEach(d => {
        const isTraur = d.is_death ? 'death' : '';
        const label = d.is_death ? '🖤 Траур' : '🎂 Свято';
        list.innerHTML += `
            <div class="list-item ${isTraur}">
                <div class="info"><strong>${d.person_name}</strong> <br><small>${d.date_day}.${d.date_month}${d.date_year ? '.' + d.date_year : ''} — ${label}</small></div>
                <div><button class="secondary" onclick="deleteDate(${d.id})">Видалити</button></div>
            </div>`;
    });
}

async function addDate() {
    const name = document.getElementById('date-name').value;
    const day = parseInt(document.getElementById('date-day').value);
    const month = parseInt(document.getElementById('date-month').value);
    const year = parseInt(document.getElementById('date-year').value) || null;
    const is_death = document.getElementById('date-death').checked;
    if(!name || !day || !month) return alert("Заповніть ім'я, день та місяць!");
    await supabase.from('dates').insert([{ person_name: name, date_day: day, date_month: month, date_year: year, is_death }]);
    document.getElementById('date-name').value = '';
    document.getElementById('date-day').value = '';
    document.getElementById('date-month').value = '';
    document.getElementById('date-year').value = '';
    document.getElementById('date-death').checked = false;
    loadDates();
}

async function deleteDate(id) {
    if(confirm("Видалити цю дату?")) {
        await supabase.from('dates').delete().eq('id', id);
        loadDates();
    }
}

async function loadEvents() {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    const list = document.getElementById('events-list');
    list.innerHTML = '';
    data.forEach(e => {
        const dateObj = new Date(e.event_date);
        list.innerHTML += `
            <div class="list-item">
                <div class="info"><strong>${e.title}</strong><br><small>${dateObj.toLocaleString('uk-UA')} — ${e.description || ''}</small></div>
                <div><button class="secondary" onclick="deleteEvent(${e.id})">Видалити</button></div>
            </div>`;
    });
}

async function addEvent() {
    const title = document.getElementById('event-title').value;
    const date = document.getElementById('event-date').value;
    const desc = document.getElementById('event-desc').value;
    if(!title || !date) return alert("Заповніть назву та дату!");
    await supabase.from('events').insert([{ title, event_date: new Date(date).toISOString(), description: desc }]);
    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-desc').value = '';
    loadEvents();
}

async function deleteEvent(id) {
    if(confirm("Видалити подію?")) {
        await supabase.from('events').delete().eq('id', id);
        loadEvents();
    }
}

checkAdmin();
