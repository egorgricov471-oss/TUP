const SUPABASE_URL = 'https://aieejqdwwqcccydkoref.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Pza6nTM9hpf9SNUUt8MYmw_7heik_hR';
let db, currentUser = null, countdownTimer = null, allDatesVisible = false;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage } });
  window.login = login; window.register = register; window.logout = logout;
  window.showLogin = showLogin; window.closeLogin = closeLogin;
  window.openRegister = openRegister; window.closeRegister = closeRegister; window.showPage = showPage;
  document.getElementById('register-drawer').addEventListener('click', e => { if (e.target.id === 'register-drawer') closeRegister(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeRegister(); closeLogin(); } });
  await renderUserState();
  await loadCountdown();
  countdownTimer = setInterval(tickCountdown, 1000);
}

function showLogin() { document.getElementById('auth-section').style.display = 'grid'; document.getElementById('guest-section').style.display = 'none'; }
function closeLogin() { document.getElementById('auth-section').style.display = 'none'; if (!currentUser) document.getElementById('guest-section').style.display = 'grid'; }
function openRegister() { const d = document.getElementById('register-drawer'); d.classList.add('open'); d.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeRegister() { const d = document.getElementById('register-drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
function setMessage(id, text, isError=false) { const el=document.getElementById(id); if(el){el.textContent=text;el.style.color=isError?'#e69a8d':'#c6d66b';} }

async function login() {
  const email=document.getElementById('email').value.trim(), password=document.getElementById('password').value;
  setMessage('auth-message','Перевіряємо дані…');
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error){setMessage('auth-message','Не вдалося увійти: '+error.message,true);return;}
  closeLogin(); await renderUserState();
}
async function register() {
  const email=document.getElementById('reg-email').value.trim(), password=document.getElementById('reg-password').value;
  if(!email||password.length<6){setMessage('register-message','Вкажи пошту та пароль від 6 символів.',true);return;}
  setMessage('register-message','Надсилаємо заявку…');
  const {data,error}=await db.auth.signUp({email,password});
  if(error){setMessage('register-message','Не вдалося зареєструватися: '+error.message,true);return;}
  if(data.session){closeRegister();await renderUserState();}
  else setMessage('register-message','Заявку створено. Якщо потрібно підтвердити пошту — перевір лист, а потім дочекайся схвалення адміністратора.');
}
async function logout(){const {error}=await db.auth.signOut();if(error){alert('Не вдалося вийти: '+error.message);return;}currentUser=null;location.reload();}

async function renderUserState(){
  ['auth-section','pending-section','main-section','guest-section'].forEach(id=>document.getElementById(id).style.display='none');
  const {data:{session},error}=await db.auth.getSession();
  if(error){console.error(error);document.getElementById('guest-section').style.display='grid';return;}
  currentUser=session?.user||null;
  if(!currentUser){document.getElementById('guest-section').style.display='grid';document.getElementById('login-open').style.display='';document.getElementById('header-register').style.display='';return;}
  const {data:profile,error:profileError}=await db.from('profiles').select('status,greeting').eq('id',currentUser.id).maybeSingle();
  if(profileError){console.error(profileError);document.getElementById('auth-section').style.display='grid';setMessage('auth-message','Не вдалося завантажити профіль. '+profileError.message,true);return;}
  if(!profile||profile.status==='pending'){document.getElementById('pending-section').style.display='grid';return;}
  if(!['approved','admin'].includes(profile.status)){document.getElementById('guest-section').style.display='grid';return;}
  document.getElementById('main-section').style.display='block';
  document.getElementById('login-open').style.display='none';document.getElementById('header-register').style.display='none';
  document.getElementById('admin-btn').style.display=profile.status==='admin'?'':'none';
  document.getElementById('greeting-text').textContent=profile.greeting||'Раді бачити тебе в ТУП';
  await showPage('news');
}

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatDateTime(value){return new Date(value).toLocaleString('uk-UA',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function nextAnnualDate(d, now=new Date()){
  const month=Number(d.date_month),day=Number(d.date_day);let year=now.getFullYear();
  let candidate=new Date(year,month-1,day,0,0,0,0);
  if(candidate<new Date(now.getFullYear(),now.getMonth(),now.getDate())) candidate=new Date(year+1,month-1,day,0,0,0,0);
  return candidate;
}
function dateType(d){return d.date_type||(d.is_death?'death':'birthday');}
function dateTypeLabel(t){return t==='death'?'День пам’яті':t==='event'?'Історична / пам’ятна подія':'День народження';}
function daysUntil(date){return Math.ceil((date-new Date())/86400000);}

async function showPage(page){
  const area=document.getElementById('content-area');if(!area)return;
  document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  area.innerHTML='<div class="empty-state">Завантажуємо…</div>';
  if(page==='news'){
    const {data,error}=await db.from('news').select('*').order('created_at',{ascending:false});if(error)return contentError(area,error);
    if(!data?.length){area.innerHTML='<div class="section-heading"><h2>Стрічка</h2></div><div class="empty-state">Поки що новин немає. Зазирни трохи згодом.</div>';return;}
    const posts=await Promise.all(data.map(async n=>{const {data:comments,error:ce}=await db.from('comments').select('id,user_id,content,created_at').eq('news_id',n.id).order('created_at',{ascending:true});return {n,comments:ce?[]:(comments||[]),commentError:ce};}));
    area.innerHTML='<div class="section-heading"><div><p class="eyebrow">ЩО ВІДБУВАЄТЬСЯ</p><h2>Стрічка спільноти</h2></div><p>Новини та розмови ТУП</p></div>'+posts.map(({n,comments,commentError})=>`<article class="post-card"><div class="post-meta">${n.is_pinned?'📌 ВАЖЛИВЕ · ':''}${formatDateTime(n.created_at)}</div><h3>${escapeHtml(n.title)}</h3><div class="post-body">${escapeHtml(n.content)}</div><div class="comment-area"><h4>ОБГОВОРЕННЯ · ${comments.length}</h4>${commentError?'<p class="muted">Не вдалося завантажити коментарі.</p>':comments.map(c=>`<div class="comment"><small>${c.user_id===currentUser.id?'Ти':'Учасник'} · ${formatDateTime(c.created_at)}</small><p>${escapeHtml(c.content)}</p></div>`).join('')||'<p class="muted">Поки немає коментарів. Почни розмову.</p>'}<form class="comment-form" onsubmit="submitComment(event,${n.id})"><input name="comment" maxlength="1500" placeholder="Написати коментар…" required><button type="submit">Надіслати</button></form></div></article>`).join('');
  }else if(page==='dates'){
    const {data,error}=await db.from('dates').select('*');if(error)return contentError(area,error);
    const now=new Date();const sorted=(data||[]).map(d=>({...d,nextDate:nextAnnualDate(d,now)})).sort((a,b)=>a.nextDate-b.nextDate);
    area.innerHTML='<div class="section-heading"><div><p class="eyebrow">ПАМ’ЯТЬ І ТРАДИЦІЯ</p><h2>Пам’ятні дати</h2></div><p>Найближчі — першими</p></div>';
    if(!sorted.length){area.innerHTML+='<div class="empty-state">Пам’ятних дат поки не додано.</div>';return;}
    const visible=allDatesVisible?sorted:sorted.slice(0,10);
    area.innerHTML+=`<div class="date-list">${visible.map(d=>{const t=dateType(d),days=daysUntil(d.nextDate),cls=t==='death'?'death':'';return `<article class="date-card ${cls}"><div class="date-mark">${String(d.date_day).padStart(2,'0')}.${String(d.date_month).padStart(2,'0')}</div><div class="date-info"><strong>${escapeHtml(d.person_name)}</strong><small>${dateTypeLabel(t)} · ${d.date_year?`Рік: ${d.date_year}`:'щороку'}</small>${d.description?`<div class="date-desc">${escapeHtml(d.description)}</div>`:''}</div><div class="date-distance">${days===0?'Сьогодні':days===1?'Завтра':`За ${days} дн.`}</div></article>`;}).join('')}</div>${sorted.length>10?`<button class="view-all" onclick="toggleAllDates()">${allDatesVisible?'Згорнути список':'Переглянути всі · '+sorted.length}</button>`:''}`;
  }else if(page==='events'){
    const {data,error}=await db.from('events').select('*').order('event_date',{ascending:true});if(error)return contentError(area,error);
    const future=(data||[]).filter(e=>new Date(e.event_date)>=new Date());
    area.innerHTML='<div class="section-heading"><div><p class="eyebrow">ЗУСТРІЧІ ТА ПЛАНИ</p><h2>Події</h2></div><p>Будь у курсі</p></div>'+(future.length?future.map(e=>`<article class="event-card"><div class="post-meta">${formatDateTime(e.event_date)}</div><h3>${escapeHtml(e.title)}</h3><div class="post-body">${escapeHtml(e.description||'')}</div></article>`).join(''):'<div class="empty-state">Запланованих подій поки немає.</div>');
  }
}
window.toggleAllDates=()=>{allDatesVisible=!allDatesVisible;showPage('dates');};
window.submitComment=async(event,newsId)=>{event.preventDefault();const form=event.currentTarget;const input=form.elements.comment;const content=input.value.trim();if(!content)return;const {error}=await db.from('comments').insert([{news_id:newsId,user_id:currentUser.id,content}]);if(error){alert('Не вдалося додати коментар: '+error.message);return;}await showPage('news');};
function contentError(area,error){console.error(error);area.innerHTML=`<div class="empty-state">Не вдалося завантажити дані: ${escapeHtml(error.message)}</div>`;}

let nextEventAt=null,nextEventName='';
async function loadCountdown(){const {data,error}=await db.from('events').select('title,event_date').gte('event_date',new Date().toISOString()).order('event_date',{ascending:true}).limit(1);if(error){console.warn('Countdown:',error.message);paintCountdown('guest-countdown','member-countdown','Не вдалося завантажити таймер','');return;}nextEventAt=data?.[0]?.event_date?new Date(data[0].event_date):null;nextEventName=data?.[0]?.title||'';tickCountdown();}
function tickCountdown(){const guest=document.getElementById('guest-countdown'),member=document.getElementById('member-countdown');if(!guest||!member)return;if(!nextEventAt){paintCountdown('guest-countdown','member-countdown','Подію ще не заплановано','');return;}let ms=nextEventAt-Date.now();if(ms<=0){paintCountdown('guest-countdown','member-countdown','Подія вже почалася',nextEventName);return;}const day=Math.floor(ms/86400000);ms%=86400000;const h=Math.floor(ms/3600000);ms%=3600000;const m=Math.floor(ms/60000);const s=Math.floor((ms%60000)/1000);const value=`${day}д ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;paintCountdown('guest-countdown','member-countdown',value,nextEventName);}
function paintCountdown(a,b,value,title){document.getElementById(a).textContent=value;document.getElementById(b).textContent=value;document.getElementById(a.replace('countdown','event-title')).textContent=title;document.getElementById(b.replace('countdown','event-title')).textContent=title;}
