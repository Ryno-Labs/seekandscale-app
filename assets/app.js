/* Seek & Scale shared member-app logic. Live data is Supabase-backed. */

var SS = { user:null, profile:null, zones:[], businesses:[], vouches:[] };

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function money(n){ return '$'+Math.round(Number(n)||0).toLocaleString('en-US'); }
function qs(name){ return new URLSearchParams(location.search).get(name); }
function initials(name){
  var p=String(name||'?').trim().split(/\s+/).filter(Boolean); return (p[0]?p[0][0]:'?')+(p[1]?p[1][0]:'');
}
function fmtDate(v){ return v?new Date(v).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''; }
function fmtTime(v){
  if(!v) return '';
  var d=new Date(v), mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
  if(mins<1) return 'just now'; if(mins<60) return mins+' min ago';
  if(mins<1440) return Math.floor(mins/60)+' hr ago'; if(mins<10080) return Math.floor(mins/1440)+' day'+(mins>=2880?'s':'')+' ago';
  return fmtDate(v);
}
function siteRoot(){
  var p=location.pathname; var i=p.lastIndexOf('/'); return location.origin+p.slice(0,i+1);
}
function configMessage(host){
  if(configReady()) return false;
  if(host) host.innerHTML='<div class="card flat"><b>Connect Supabase first.</b><p class="tiny">Open assets/config.js and paste your Project URL and anon key.</p></div>';
  return true;
}
function showPageError(host,msg){
  if(typeof host==='string') host=document.getElementById(host);
  if(host) host.innerHTML='<div class="card flat"><p class="tiny" style="margin:0">'+esc(msg||'Something went wrong.')+'</p></div>';
}

async function getMyProfile(){
  var u=(await sb.auth.getUser()).data.user;
  if(!u) return null;
  SS.user=u;
  var r=await sb.from('profiles').select('*').eq('id',u.id).single();
  if(r.error) throw r.error;
  SS.profile=r.data; return r.data;
}

async function requireMember(active){
  initSupabase();
  if(!configReady()){ document.body.innerHTML='<main><div class="card flat"><b>Supabase is not connected.</b><p class="tiny">Finish GO-LIVE.md Part 2.</p></div></main>'; throw new Error('config'); }
  var s=await sb.auth.getSession();
  if(!s.data.session){
    sessionStorage.setItem('ss_after_login',location.href);
    location.replace('index.html?message=signin'); throw new Error('signin');
  }
  var p=await getMyProfile();
  if(!p){ location.replace('index.html?message=profile'); throw new Error('profile'); }
  if(p.status==='pending'){
    sessionStorage.setItem('ss_after_login',location.href);
    location.replace('index.html?message=invite'); throw new Error('pending');
  }
  if(p.status!=='active'){
    await sb.auth.signOut(); location.replace('index.html?message=suspended'); throw new Error('suspended');
  }
  if(p.billing_status==='past_due'||p.billing_status==='canceled'){
    await sb.auth.signOut(); location.replace('index.html?message=billing'); throw new Error('billing');
  }
  chrome(active); return p;
}

var NAV=[
 {id:'home',href:'home.html',lab:'Home',ic:'<path d="M4 9.5 12 4l8 5.5V20H4z"/><path d="M9.5 20v-6h5v6"/>'},
 {id:'directory',href:'directory.html',lab:'Directory',ic:'<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>'},
 {id:'forum',href:'forum.html',lab:'Forum',ic:'<path d="M20.5 12.5c0 3.6-3.8 6.5-8.5 6.5-1 0-2-.13-2.9-.37L4 20.5l1.5-3.4A6.6 6.6 0 0 1 3.5 12.5C3.5 8.9 7.3 6 12 6s8.5 2.9 8.5 6.5z"/>'},
 {id:'help',href:'helpdesk.html',lab:'Help Desk',ic:'<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.2v.02"/>'},
 {id:'me',href:'me.html',lab:'Me',ic:'<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/>'}
];
function chrome(active){
  if(document.body.classList.contains('in-app')) return;
  document.body.classList.add('in-app');
  var p=SS.profile||{}, name=p.full_name||p.email||'Member', biz=p.business_name||'Seek & Scale member';
  var head='<header class="top"><a class="logo" href="home.html">seek<i>+</i><br>scale.</a>'+ 
    '<div class="top-right"><div class="whoami"><span class="nm">'+esc(name)+'</span><span class="bz">'+esc(biz)+'</span></div>'+ 
    '<a class="me-av" href="me.html" aria-label="My account">'+esc(initials(name).toUpperCase())+'</a></div></header>';
  document.body.insertAdjacentHTML('afterbegin',head);
  var side=document.getElementById('side'),tabs='';
  NAV.forEach(function(n){
    var svg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+n.ic+'</svg>';
    tabs+='<a class="tab'+(n.id===active?' on':'')+'" href="'+n.href+'"><span class="ic">'+svg+'</span><span class="lab">'+n.lab+'</span></a>';
    if(side) side.insertAdjacentHTML('beforeend','<a class="snav'+(n.id===active?' on':'')+'" href="'+n.href+'">'+svg+n.lab+'</a>');
  });
  document.body.insertAdjacentHTML('beforeend','<nav class="tabs">'+tabs+'</nav>');
}

async function loadZones(){
  var r=await sb.from('zones').select('*').order('name'); if(r.error) throw r.error; SS.zones=r.data||[]; return SS.zones;
}
async function loadBusinesses(){
  var b=await sb.from('businesses').select('*,zones(name)').order('created_at',{ascending:false});
  if(b.error) throw b.error;
  var v=await sb.from('vouches').select('business_id,member_id'); if(v.error) throw v.error;
  SS.vouches=v.data||[];
  var counts={},mine={};
  SS.vouches.forEach(function(x){counts[x.business_id]=(counts[x.business_id]||0)+1;if(SS.user&&x.member_id===SS.user.id)mine[x.business_id]=true;});
  SS.businesses=(b.data||[]).map(function(x){x.vouch_count=counts[x.id]||0;x.vouched=!!mine[x.id];return x;});
  return SS.businesses;
}
function businessTown(b){ return b.town || (b.zones&&b.zones.name) || ''; }
function businessCard(b,opts){
  opts=opts||{}; var color=b.accent_color||'#111111',mark=initials(b.name).toUpperCase();
  var h='<div class="shop" data-card="'+esc(b.id)+'"><div class="band" style="background:'+esc(color)+'"></div><div class="in">'+
    '<div class="hd"><div class="mark" style="background:'+esc(color)+'">'+esc(mark)+'</div><div style="flex:1">'+
    '<h3>'+esc(b.name)+'</h3><div class="own">'+esc([b.owner_name,businessTown(b)].filter(Boolean).join(' · '))+'</div><div style="margin-top:9px;display:flex;gap:6px;flex-wrap:wrap">'+
    '<span class="chip verif">Verified</span>'+(b.category?'<span class="chip">'+esc(b.category)+'</span>':'')+(opts.isNew?'<span class="chip new">New</span>':'')+'</div></div></div>';
  if(opts.full){
    h+='<div class="qa"><div class="q">What they do</div><p class="a">'+esc(b.description||'')+'</p><div class="q">How they can help you</div><p class="a">'+esc(b.helps_with||'')+'</p>'+(b.years_in?'<div class="q">How long</div><p class="a">'+esc(b.years_in)+'</p>':'')+'</div>';
    var reach=[]; if(b.contact_phone)reach.push(esc(b.contact_phone)); if(b.contact_email)reach.push(esc(b.contact_email)); if(b.website)reach.push(esc(b.website));
    h+='<div class="qa"><div class="q">Reach them</div><p class="a">'+(reach.join('<br>')||'Contact details not listed.')+'</p></div>';
  }
  h+='<div class="ft"><button class="vouch'+(b.vouched?' on':'')+'" data-vouch="'+esc(b.id)+'"><span class="n">'+b.vouch_count+'</span> '+(b.vouched?'vouched':'vouch')+'</button>';
  if(opts.full){
    var href=b.contact_email?'mailto:'+encodeURIComponent(b.contact_email):(b.contact_phone?'tel:'+String(b.contact_phone).replace(/[^+\d]/g,''):'#');
    h+='<a class="act soft" style="margin-left:auto" href="'+href+'">Message</a>';
  }else h+='<a class="act soft" style="margin-left:auto" href="shop.html?id='+encodeURIComponent(b.id)+'">Their page</a>';
  return h+'</div></div></div>';
}
async function toggleVouch(id){
  var b=SS.businesses.find(function(x){return x.id===id;}); if(!b) return;
  if(b.vouched){
    var d=await sb.from('vouches').delete().eq('business_id',id).eq('member_id',SS.user.id); if(d.error) throw d.error;
    b.vouched=false;b.vouch_count=Math.max(0,b.vouch_count-1);
  }else{
    var i=await sb.from('vouches').insert({business_id:id,member_id:SS.user.id}); if(i.error) throw i.error;
    b.vouched=true;b.vouch_count++;
  }
}
document.addEventListener('click',function(e){
  var v=e.target.closest('[data-vouch]'); if(!v)return;
  v.disabled=true; toggleVouch(v.dataset.vouch).then(function(){if(window.onVouchChange)window.onVouchChange();}).catch(function(err){alert(err.message);}).finally(function(){v.disabled=false;});
});

async function loadPosts(categories,limit){
  var q=sb.from('posts').select('*').order('created_at',{ascending:false});
  if(categories&&categories.length) q=q.in('category',categories); if(limit) q=q.limit(limit);
  var r=await q; if(r.error) throw r.error; return r.data||[];
}
async function createMemberPost(body,category){
  var r=await sb.rpc('create_member_post',{p_body:body,p_category:category}); if(r.error) throw r.error; return r.data;
}
async function submitHelpRequest(type,subject,body){
  var r=await sb.rpc('submit_help_request',{p_request_type:type,p_subject:subject,p_body:body}); if(r.error) throw r.error; return r.data;
}
async function updateMyProfile(fields){
  var r=await sb.rpc('update_my_profile',{
    p_full_name:fields.full_name||null,p_business_name:fields.business_name||null,p_trade:fields.trade||null,
    p_town:fields.town||null,p_zone_id:fields.zone_id||null
  }); if(r.error) throw r.error; await getMyProfile(); return SS.profile;
}
async function signOut(){ await sb.auth.signOut(); location.replace('index.html'); }

function configuredLink(map,key){ var u=map&&map[key]; return u&&/^https?:\/\//i.test(u)?u:''; }
function requestKit(key,name,isMember){
  var link=configuredLink(isMember?KIT_MEMBER_LINKS:KIT_PUBLIC_LINKS,key); if(link){location.href=link;return true;} return false;
}
function registerSW(){
  if('serviceWorker' in navigator) window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
registerSW();
