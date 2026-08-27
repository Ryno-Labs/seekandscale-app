/* ============================================================================
   SEEK & SCALE — admin dashboard
   Vanilla JS. No build step. Every query goes through Supabase with RLS on,
   so this file can only do what the signed-in user's role allows.
   ============================================================================ */

initSupabase();

var ME = null;          // my profile row
var ZONES = [];
var MEMBERS = [];
var CACHE = {};         // last loaded rows per section

/* ---------------------------------------------------------------- helpers */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function money(c){ return c==null?'':'$'+(c/100).toLocaleString('en-US',{minimumFractionDigits:2}); }
function when(t){ return t? new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''; }

var toastT;
function toast(msg, bad){
  var el=$('toast'); el.textContent=msg; el.className='on'+(bad?' bad':'');
  clearTimeout(toastT); toastT=setTimeout(function(){ el.className=''; }, 2600);
}

/* ================================================================= AUTH === */
async function boot(){
  var cfg = SUPABASE_URL.indexOf('YOUR-PROJECT-REF')>-1;
  if(cfg){ $('gateMsg').innerHTML='<b>Set your keys first.</b><br>Open assets/config.js and paste your Supabase URL and anon key.'; return; }

  var s = await sb.auth.getSession();
  if(s.data.session) return afterLogin();

  sb.auth.onAuthStateChange(function(_e, sess){ if(sess) afterLogin(); });
}

async function afterLogin(){
  var u = (await sb.auth.getUser()).data.user;
  if(!u) return;

  var r = await sb.from('profiles').select('*').eq('id', u.id).single();
  if(r.error || !r.data){ return denied('No profile found for that account.'); }
  if(r.data.role !== 'admin'){ return denied('That account is not an admin.'); }

  ME = r.data;
  $('gate').hidden = true;
  $('app').hidden = false;
  document.body.classList.add('in-app');
  $('meName').textContent = ME.full_name || ME.email;
  $('today').textContent = new Date().toLocaleDateString('en-US',
    {weekday:'long', month:'long', day:'numeric'});

  var z = await sb.from('zones').select('*').order('name');
  ZONES = z.data || [];
  var mm = await sb.from('profiles').select('id,full_name,email,business_name').eq('status','active').order('full_name');
  MEMBERS = mm.data || [];

  buildNav();
  await Promise.all([loadStats(), loadPending()]);
}

async function denied(msg){
  await sb.auth.signOut();
  $('gateMsg').textContent = msg;
  $('gate').hidden = false;
  $('app').hidden = true;
}

$('signIn').onclick = async function(){
  $('gateMsg').textContent='Checking&hellip;';
  var r = await sb.auth.signInWithPassword({ email:$('em').value.trim(), password:$('pw').value });
  if(r.error) $('gateMsg').textContent = r.error.message;
};
$('pw').addEventListener('keydown', function(e){ if(e.key==='Enter') $('signIn').click(); });

$('magic').onclick = async function(){
  var email=$('em').value.trim();
  if(!email) return $('gateMsg').textContent='Put your email in first.';
  var r = await sb.auth.signInWithOtp({ email:email,
    options:{ emailRedirectTo: location.href } });
  $('gateMsg').textContent = r.error ? r.error.message : 'Sent. Check your email.';
};

$('signOut').onclick = async function(){ await sb.auth.signOut(); location.reload(); };

/* ============================================================ RESOURCES === */
/* One config drives list + form + save for each content table.               */

var RESOURCES = {
  businesses:{
    title:'Directory', blurb:'Member shops. These show in the app directory.',
    table:'businesses', order:'name', asc:true,
    search:['name','category','description','contact_email'],
    label:function(r){ return r.name; },
    sub:function(r){ return [r.category, r.town||zoneName(r.zone_id), r.contact_phone]
      .filter(Boolean).join(' · '); },
    fields:[
      {k:'name',       l:'Business name', t:'text', req:true},
      {k:'owner_name', l:'Owner / contact name', t:'text'},
      {k:'owner_id', l:'Linked member account', t:'member'},
      {k:'category',   l:'Trade / category', t:'text'},
      {k:'description',l:'What they do', t:'area'},
      {k:'helps_with', l:'How they can help you', t:'area'},
      {k:'years_in',   l:'How long', t:'text'},
      {k:'contact_phone',l:'Phone', t:'text'},
      {k:'contact_email',l:'Email', t:'text'},
      {k:'website',    l:'Website', t:'text'},
      {k:'address',    l:'Address', t:'text'},
      {k:'town',       l:'Town', t:'text'},
      {k:'zone_id',    l:'Zone', t:'zone'},
      {k:'accent_color',l:'Brand color', t:'color'},
      {k:'logo_url',   l:'Logo', t:'image'},
      {k:'status',     l:'Status', t:'select', opts:['draft','published']}
    ]
  },
  posts:{
    title:'Posts & Resources', blurb:'Forum posts, articles, and help desk resources.',
    table:'posts', order:'created_at', asc:false,
    search:['title','body','category'],
    label:function(r){ return r.title; },
    sub:function(r){ return [r.category, when(r.created_at)].filter(Boolean).join(' · '); },
    fields:[
      {k:'title',    l:'Title', t:'text', req:true},
      {k:'author_name', l:'Author name', t:'text'},
      {k:'business_name', l:'Business name', t:'text'},
      {k:'town', l:'Town', t:'text'},
      {k:'category', l:'Category', t:'select',
        opts:['thought','request','giveaway','shoutout','resource','article','news']},
      {k:'body',     l:'Body', t:'area'},
      {k:'image_url',l:'Image', t:'image'},
      {k:'status',   l:'Status', t:'select', opts:['draft','published']}
    ]
  },
  events:{
    title:'Events', blurb:'Coffee mornings, meetups, anything on the calendar.',
    table:'events', order:'starts_at', asc:true,
    search:['title','location','description'],
    label:function(r){ return r.title; },
    sub:function(r){ return [r.starts_at? new Date(r.starts_at).toLocaleString('en-US',
      {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'No date',
      r.location].filter(Boolean).join(' · '); },
    fields:[
      {k:'title',      l:'Title', t:'text', req:true},
      {k:'starts_at',  l:'Starts', t:'datetime'},
      {k:'location',   l:'Location', t:'text'},
      {k:'description',l:'Description', t:'area'},
      {k:'zone_id',    l:'Zone', t:'zone'},
      {k:'image_url',  l:'Image', t:'image'},
      {k:'status',     l:'Status', t:'select', opts:['draft','published']}
    ]
  },
  listings:{
    title:'Free & For Sale', blurb:'Tools, trucks, and jobs members are passing on.',
    table:'listings', order:'created_at', asc:false,
    search:['title','description'],
    label:function(r){ return r.title; },
    sub:function(r){ return [r.is_free?'Free':money(r.price_cents), r.status,
      when(r.created_at)].filter(Boolean).join(' · '); },
    fields:[
      {k:'title',      l:'Title', t:'text', req:true},
      {k:'description',l:'Description', t:'area'},
      {k:'price_cents',l:'Price in cents (2500 = $25)', t:'number'},
      {k:'is_free',    l:'Free', t:'bool'},
      {k:'image_url',  l:'Photo', t:'image'},
      {k:'status',     l:'Status', t:'select', opts:['draft','published','sold']}
    ]
  }
};

function zoneName(id){ for(var i=0;i<ZONES.length;i++) if(ZONES[i].id===id) return ZONES[i].name; return ''; }

/* ---------------------------------------------------------------- nav */
var NAVI = [
  ['overview','Overview'], ['businesses','Directory'], ['posts','Posts'],
  ['events','Events'], ['listings','Marketplace'], ['help','Help Desk'], ['members','Members'],
  ['invites','Invites'], ['payments','Payments']
];

function buildNav(){
  $('side').innerHTML = NAVI.map(function(n){
    return '<button class="snav'+(n[0]==='overview'?' on':'')+'" data-sec="'+n[0]+'">'+n[1]+'</button>';
  }).join('');
  // mobile: the sidebar is hidden by CSS, so give a scrolling chip row instead
  var chips = '<div class="filters" style="margin-bottom:4px">'+NAVI.map(function(n){
    return '<button class="fchip'+(n[0]==='overview'?' on':'')+'" data-sec="'+n[0]+'">'+n[1]+'</button>';
  }).join('')+'</div>';
  $('banner').insertAdjacentHTML('beforebegin', chips);
}

document.addEventListener('click', function(e){
  var b = e.target.closest('[data-sec]');
  if(b) show(b.dataset.sec);
});

async function show(sec){
  document.querySelectorAll('.sect').forEach(function(s){ s.classList.toggle('on', s.id==='s-'+sec); });
  document.querySelectorAll('[data-sec]').forEach(function(b){ b.classList.toggle('on', b.dataset.sec===sec); });
  window.scrollTo(0,0);
  if(RESOURCES[sec]) return renderResource(sec);
  if(sec==='help')     return loadHelp();
  if(sec==='members')  return loadMembers();
  if(sec==='invites')  return loadInvites();
  if(sec==='payments') return loadPayments();
  if(sec==='overview'){ loadStats(); loadPending(); }
}

/* ------------------------------------------------------- generic list UI */
function renderResource(key){
  var C = RESOURCES[key], host = $('s-'+key);
  if(!host.dataset.built){
    host.innerHTML =
      '<h1>'+C.title+'</h1><p class="sub">'+C.blurb+'</p>'+
      '<button class="btn" data-new="'+key+'" style="margin-bottom:16px">Add new</button>'+
      '<div class="toolbar"><input class="search" data-sr="'+key+'" placeholder="Search&hellip;">'+
      '<select class="sel" data-sf="'+key+'"><option value="">All</option>'+
      '<option value="published">Published</option><option value="draft">Draft</option>'+
      '<option value="deleted">Deleted</option></select></div>'+
      '<div class="card" id="list-'+key+'"></div>';
    host.dataset.built = '1';
    host.querySelector('[data-sr]').addEventListener('input', function(){ loadList(key); });
    host.querySelector('[data-sf]').addEventListener('change', function(){ loadList(key); });
  }
  loadList(key);
}

async function loadList(key){
  var C = RESOURCES[key];
  var host = $('s-'+key);
  var q = host.querySelector('[data-sr]').value.trim();
  var f = host.querySelector('[data-sf]').value;
  var box = $('list-'+key);
  box.innerHTML = '<p class="tiny" style="padding:8px 0">Loading&hellip;</p>';

  var sel = sb.from(C.table).select('*').order(C.order, {ascending:C.asc, nullsFirst:false}).limit(200);
  if(f==='deleted') sel = sel.not('deleted_at','is',null);
  else {
    sel = sel.is('deleted_at', null);
    if(f) sel = sel.eq('status', f);
  }
  if(q) sel = sel.or(C.search.map(function(c){ return c+'.ilike.%'+q.replace(/[%,]/g,'')+'%'; }).join(','));

  var r = await sel;
  if(r.error){ box.innerHTML='<p class="tiny">'+esc(r.error.message)+'</p>'; return; }
  CACHE[key] = r.data;

  if(!r.data.length){ box.innerHTML='<p class="tiny" style="padding:8px 0">Nothing here yet.</p>'; return; }

  box.innerHTML = r.data.map(function(row){
    var img = row.logo_url || row.image_url;
    var thumb = img ? '<img class="thumb" src="'+esc(img)+'" alt="">'
      : '<div class="thumb" style="background:'+(row.accent_color||'#E8E8E8')+
        ';color:#fff">'+esc((C.label(row)||'?').slice(0,2).toUpperCase())+'</div>';
    return '<div class="row">'+thumb+
      '<div class="rd"><div class="rt">'+esc(C.label(row))+'</div>'+
      '<div class="rs">'+esc(C.sub(row))+'</div>'+
      '<div class="ra">'+
        '<span class="chip'+(row.status==='published'?' verif':'')+'">'+esc(row.status||'')+'</span>'+
        (row.deleted_at?'<span class="chip">deleted</span>':'')+
      '</div></div>'+
      '<button class="mini" data-edit="'+key+'" data-id="'+row.id+'">Edit</button></div>';
  }).join('');
}

/* ------------------------------------------------------------ edit drawer */
var EDIT = { key:null, row:null };

document.addEventListener('click', function(e){
  var n = e.target.closest('[data-new]');
  if(n){ openDrawer(n.dataset.new, null); return; }
  var ed = e.target.closest('[data-edit]');
  if(ed){
    var key = ed.dataset.edit;
    var row = (CACHE[key]||[]).filter(function(r){ return r.id===ed.dataset.id; })[0];
    openDrawer(key, row);
  }
});

function openDrawer(key, row){
  var C = RESOURCES[key];
  EDIT = { key:key, row:row };
  $('dTitle').textContent = row ? 'Edit' : 'New ' + C.title.replace(/s$/,'').toLowerCase();
  $('dDelete').style.display = row ? '' : 'none';
  $('dDelete').textContent = (row && row.deleted_at) ? 'Restore' : 'Delete';

  $('dBody').innerHTML = C.fields.map(function(f){
    var v = row ? row[f.k] : '';
    if(v==null) v='';
    var input;
    if(f.t==='area')       input='<textarea id="f_'+f.k+'">'+esc(v)+'</textarea>';
    else if(f.t==='select')input='<select id="f_'+f.k+'">'+f.opts.map(function(o){
        return '<option'+(o===v?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>';
    else if(f.t==='zone')  input='<select id="f_'+f.k+'"><option value="">&mdash;</option>'+
        ZONES.map(function(z){ return '<option value="'+z.id+'"'+(z.id===v?' selected':'')+'>'+esc(z.name)+'</option>'; }).join('')+'</select>';
    else if(f.t==='member') input='<select id="f_'+f.k+'"><option value="">&mdash;</option>'+
        MEMBERS.map(function(m){ var lab=[m.full_name,m.business_name,m.email].filter(Boolean).join(' · '); return '<option value="'+m.id+'"'+(m.id===v?' selected':'')+'>'+esc(lab)+'</option>'; }).join('')+'</select>';
    else if(f.t==='bool')  input='<select id="f_'+f.k+'"><option value="false"'+(!v?' selected':'')+'>No</option>'+
        '<option value="true"'+(v?' selected':'')+'>Yes</option></select>';
    else if(f.t==='image') input='<input type="file" id="f_'+f.k+'" accept="image/*">'+
        (v?'<img class="preview" src="'+esc(v)+'" alt="">':'')+
        '<input type="hidden" id="h_'+f.k+'" value="'+esc(v)+'">';
    else if(f.t==='datetime') input='<input type="datetime-local" id="f_'+f.k+'" value="'+
        (v? new Date(v).toISOString().slice(0,16) : '')+'">';
    else if(f.t==='color') input='<input type="text" id="f_'+f.k+'" value="'+esc(v||'#111111')+'" placeholder="#111111">';
    else if(f.t==='number')input='<input type="number" id="f_'+f.k+'" value="'+esc(v)+'">';
    else                   input='<input type="text" id="f_'+f.k+'" value="'+esc(v)+'">';
    return '<div class="field"><label for="f_'+f.k+'">'+f.l+(f.req?' *':'')+'</label>'+input+'</div>';
  }).join('');

  drawer(true);
}

function drawer(on){
  $('drawer').classList.toggle('on', on);
  $('scrim').classList.toggle('on', on);
}
$('dClose').onclick = function(){ drawer(false); };
$('scrim').onclick  = function(){ drawer(false); };

$('dSave').onclick = async function(){
  var C = RESOURCES[EDIT.key], patch = {};
  for(var i=0;i<C.fields.length;i++){
    var f = C.fields[i], el = $('f_'+f.k);
    if(f.t==='image'){
      var url = $('h_'+f.k).value;
      if(el.files && el.files[0]){
        this.textContent='Uploading&hellip;'; this.disabled=true;
        url = await uploadImage(el.files[0]);
        this.textContent='Save'; this.disabled=false;
        if(url===null) return;
      }
      patch[f.k] = url || null;
    }
    else if(f.t==='bool')     patch[f.k] = el.value==='true';
    else if(f.t==='number')   patch[f.k] = el.value===''? null : parseInt(el.value,10);
    else if(f.t==='datetime') patch[f.k] = el.value? new Date(el.value).toISOString() : null;
    else                      patch[f.k] = el.value.trim()===''? null : el.value.trim();

    if(f.req && !patch[f.k]) return toast(f.l+' is required.', true);
  }

  var r = EDIT.row
    ? await sb.from(C.table).update(patch).eq('id', EDIT.row.id)
    : await sb.from(C.table).insert(patch);

  if(r.error) return toast(r.error.message, true);
  toast('Saved.');
  drawer(false);
  loadList(EDIT.key);
  loadStats();
};

$('dDelete').onclick = async function(){
  var C = RESOURCES[EDIT.key];
  var restoring = !!EDIT.row.deleted_at;
  if(!restoring && !confirm('Delete "'+C.label(EDIT.row)+'"? You can restore it from the Deleted filter.')) return;
  var r = await sb.from(C.table)
    .update({ deleted_at: restoring ? null : new Date().toISOString() })
    .eq('id', EDIT.row.id);
  if(r.error) return toast(r.error.message, true);
  toast(restoring ? 'Restored.' : 'Deleted.');
  drawer(false);
  loadList(EDIT.key);
};

/* -------------------------------------------------------------- uploads */
async function uploadImage(file){
  if(file.size > 5*1024*1024){ toast('That image is over 5MB.', true); return null; }
  var ext  = (file.name.split('.').pop()||'jpg').toLowerCase();
  var path = Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
  var up = await sb.storage.from('media').upload(path, file, {cacheControl:'31536000', upsert:false});
  if(up.error){ toast(up.error.message, true); return null; }
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/* ================================================================ STATS === */
async function loadStats(){
  async function n(table, build){
    var q = sb.from(table).select('*', {count:'exact', head:true});
    if(build) q = build(q);
    var r = await q; return r.count || 0;
  }
  var vals = await Promise.all([
    n('profiles', function(q){ return q.eq('status','active'); }),
    n('profiles', function(q){ return q.eq('status','pending'); }),
    n('businesses', function(q){ return q.is('deleted_at',null).eq('status','published'); }),
    n('payments'),
    n('invites', function(q){ return q.eq('revoked',false); }),
    n('posts', function(q){ return q.eq('status','draft').is('deleted_at',null); }),
    n('help_requests', function(q){ return q.eq('status','new'); })
  ]);
  var cards = [
    ['Active members', vals[0], vals[1]>0],
    ['Waiting to be let in', vals[1], vals[1]>0],
    ['Shops in directory', vals[2], false],
    ['Payments', vals[3], false],
    ['Live invites', vals[4], false],
    ['Drafts', vals[5], false],
    ['New help requests', vals[6], vals[6]>0]
  ];
  $('stats').innerHTML = cards.map(function(c){
    return '<div class="stat'+(c[2]?' hot':'')+'"><div class="n">'+c[1]+'</div><div class="l">'+c[0]+'</div></div>';
  }).join('');
}

async function loadPending(){
  var r = await sb.from('profiles').select('*').eq('status','pending')
            .order('created_at',{ascending:false}).limit(20);
  var box = $('pendingBox');
  if(r.error) return box.innerHTML='<p class="tiny">'+esc(r.error.message)+'</p>';
  if(!r.data.length) return box.innerHTML='<p class="tiny" style="padding:6px 0">Nobody waiting. All clear.</p>';
  box.innerHTML = r.data.map(memberRow).join('');
}


/* ================================================================ HELP === */
$('helpSearch').addEventListener('input', loadHelp);
$('helpStatus').addEventListener('change', loadHelp);

async function loadHelp(){
  var q=$('helpSearch').value.trim(), st=$('helpStatus').value;
  var sel=sb.from('help_requests').select('*').order('created_at',{ascending:false}).limit(300);
  if(st) sel=sel.eq('status',st);
  if(q) sel=sel.or(['requester_name','requester_email','business_name','subject','body']
    .map(function(c){return c+'.ilike.%'+q.replace(/[%,]/g,'')+'%';}).join(','));
  var r=await sel;
  if(r.error) return $('helpList').innerHTML='<p class="tiny">'+esc(r.error.message)+'</p>';
  if(!r.data.length) return $('helpList').innerHTML='<p class="tiny">No help requests match that.</p>';
  $('helpList').innerHTML='<div class="card">'+r.data.map(function(x){
    return '<div class="row"><div class="rd"><div class="rt">'+esc(x.subject||'Help Desk request')+'</div>'+ 
      '<div class="rs">'+esc([x.requester_name,x.business_name,x.requester_email,when(x.created_at)].filter(Boolean).join(' · '))+'</div>'+ 
      '<div style="margin-top:9px;font-size:14px;white-space:pre-wrap">'+esc(x.body)+'</div>'+ 
      '<div class="ra"><span class="chip'+(x.status==='new'?' new':'')+'">'+esc(x.status)+'</span>'+ 
      '<button class="mini" data-help-status="working" data-id="'+x.id+'">Working</button>'+ 
      '<button class="mini dark" data-help-status="done" data-id="'+x.id+'">Done</button>'+ 
      '<button class="mini" data-help-status="closed" data-id="'+x.id+'">Close</button></div></div></div>';
  }).join('')+'</div>';
}

document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-help-status]'); if(!b)return;
  var r=await sb.from('help_requests').update({status:b.dataset.helpStatus,updated_at:new Date().toISOString()}).eq('id',b.dataset.id);
  if(r.error)return toast(r.error.message,true); toast('Help request updated.'); loadHelp(); loadStats();
});

/* ============================================================== MEMBERS === */
$('memberSearch').addEventListener('input', loadMembers);
$('memberStatus').addEventListener('change', loadMembers);

function memberRow(m){
  return '<div class="row">'+
    '<div class="thumb" style="background:var(--jet)">'+
      esc((m.full_name||m.email||'?').slice(0,2).toUpperCase())+'</div>'+
    '<div class="rd"><div class="rt">'+esc(m.full_name||m.email||'&mdash;')+'</div>'+
    '<div class="rs">'+esc([m.business_name, m.trade, m.town||zoneName(m.zone_id), m.email]
      .filter(Boolean).join(' · '))+'</div>'+
    '<div class="ra">'+
      '<span class="chip'+(m.status==='active'?' verif':'')+'">'+esc(m.status)+'</span>'+
      '<span class="chip">billing: '+esc(m.billing_status||'not_required')+'</span>'+ 
      (m.role==='admin'?'<span class="chip new">admin</span>':'')+
      (m.status!=='active'?'<button class="mini dark" data-mem="active" data-id="'+m.id+'">Let them in</button>':'')+
      (m.status==='active'?'<button class="mini warn" data-mem="suspended" data-id="'+m.id+'">Suspend</button>':'')+
      ((m.billing_status==='past_due'||m.billing_status==='canceled')?'<button class="mini" data-bill="not_required" data-id="'+m.id+'">Make comp</button>':'')+
      (m.role!=='admin'?'<button class="mini" data-role="admin" data-id="'+m.id+'">Make admin</button>'
                       :'<button class="mini" data-role="member" data-id="'+m.id+'">Remove admin</button>')+
    '</div></div></div>';
}

async function loadMembers(){
  var q = $('memberSearch').value.trim(), st = $('memberStatus').value;
  var sel = sb.from('profiles').select('*').order('created_at',{ascending:false}).limit(300);
  if(st) sel = sel.eq('status', st);
  if(q) sel = sel.or(['full_name','email','business_name','trade','town']
        .map(function(c){ return c+'.ilike.%'+q.replace(/[%,]/g,'')+'%'; }).join(','));
  var r = await sel;
  $('memberList').innerHTML = r.error ? '<p class="tiny">'+esc(r.error.message)+'</p>'
    : (r.data.length ? '<div class="card">'+r.data.map(memberRow).join('')+'</div>'
                     : '<p class="tiny">No members match that.</p>');
}

document.addEventListener('click', async function(e){
  var m = e.target.closest('[data-mem]');
  if(m){
    var r = await sb.from('profiles').update({status:m.dataset.mem}).eq('id', m.dataset.id);
    if(r.error) return toast(r.error.message, true);
    toast(m.dataset.mem==='active' ? 'They\u2019re in.' : 'Suspended.');
    loadMembers(); loadPending(); loadStats(); return;
  }
  var bi = e.target.closest('[data-bill]');
  if(bi){
    var br = await sb.from('profiles').update({billing_status:bi.dataset.bill}).eq('id', bi.dataset.id);
    if(br.error) return toast(br.error.message, true);
    toast('Billing override saved.'); loadMembers(); return;
  }
  var ro = e.target.closest('[data-role]');
  if(ro){
    if(ro.dataset.id===ME.id && ro.dataset.role==='member')
      return toast('You can\u2019t remove your own admin.', true);
    if(!confirm(ro.dataset.role==='admin'
      ? 'Make this person an admin? They\u2019ll be able to do everything you can.'
      : 'Remove admin from this person?')) return;
    var up = {role:ro.dataset.role};
    if(ro.dataset.role==='admin') up.status='active';
    var r2 = await sb.from('profiles').update(up).eq('id', ro.dataset.id);
    if(r2.error) return toast(r2.error.message, true);
    toast('Done.'); loadMembers();
  }
});

/* ============================================================== INVITES === */
$('mkInvite').onclick = async function(){
  this.disabled = true;
  var exp = $('ivExp').value ? new Date($('ivExp').value+'T23:59:59').toISOString() : null;
  var r = await sb.rpc('create_invite', {
    p_label:      $('ivLabel').value.trim() || null,
    p_email:      $('ivEmail').value.trim() || null,
    p_max_uses:   parseInt($('ivUses').value,10)  || 1,
    p_expires_at: exp,
    p_count:      Math.min(parseInt($('ivCount').value,10) || 1, 50)
  });
  this.disabled = false;
  if(r.error) return toast(r.error.message, true);
  toast(r.data.length + (r.data.length===1?' invite made.':' invites made.'));
  $('ivLabel').value=''; $('ivEmail').value='';
  loadInvites(); loadStats();
};

$('inviteSearch').addEventListener('input', loadInvites);
$('inviteState').addEventListener('change', loadInvites);

function inviteState(v){
  if(v.revoked) return 'revoked';
  if(v.expires_at && new Date(v.expires_at) < new Date()) return 'expired';
  if(v.used_count >= v.max_uses) return 'used';
  return 'live';
}

async function loadInvites(){
  var q = $('inviteSearch').value.trim(), st = $('inviteState').value;
  var sel = sb.from('invites').select('*').order('created_at',{ascending:false}).limit(300);
  if(q) sel = sel.or('code.ilike.%'+q.replace(/[%,]/g,'')+'%,label.ilike.%'+q.replace(/[%,]/g,'')+'%');
  var r = await sel;
  if(r.error) return $('inviteList').innerHTML='<p class="tiny">'+esc(r.error.message)+'</p>';

  var rows = r.data.filter(function(v){
    if(!st) return true;
    var s = inviteState(v);
    return st==='live' ? s==='live' : st==='used' ? (s==='used'||s==='expired') : s==='revoked';
  });

  if(!rows.length) return $('inviteList').innerHTML='<p class="tiny">No invites match that.</p>';

  var base = location.origin + location.pathname.replace(/admin\/.*$/, '') + 'signup.html?invite=';
  $('inviteList').innerHTML = '<div class="card">'+rows.map(function(v){
    var s = inviteState(v);
    return '<div class="row"><div class="rd">'+
      '<div class="rt code">'+esc(v.code)+'</div>'+
      '<div class="rs">'+esc([v.label, v.email, v.used_count+' of '+v.max_uses+' used',
        v.expires_at?('expires '+when(v.expires_at)):'no expiry'].filter(Boolean).join(' · '))+'</div>'+
      '<div class="ra">'+
        '<span class="chip'+(s==='live'?' verif':'')+'">'+s+'</span>'+
        '<button class="mini dark" data-copy="'+esc(base+v.code)+'">Copy link</button>'+
        (v.revoked
          ? '<button class="mini" data-rev="0" data-id="'+v.id+'">Turn back on</button>'
          : '<button class="mini warn" data-rev="1" data-id="'+v.id+'">Turn off</button>')+
      '</div></div></div>';
  }).join('')+'</div>';
}

document.addEventListener('click', async function(e){
  var c = e.target.closest('[data-copy]');
  if(c){
    var t = c.dataset.copy;
    try{ await navigator.clipboard.writeText(t); toast('Link copied.'); }
    catch(err){ prompt('Copy this link:', t); }
    return;
  }
  var rv = e.target.closest('[data-rev]');
  if(rv){
    var r = await sb.from('invites').update({revoked: rv.dataset.rev==='1'}).eq('id', rv.dataset.id);
    if(r.error) return toast(r.error.message, true);
    toast('Updated.'); loadInvites();
  }
});

/* ============================================================= PAYMENTS === */
$('paySearch').addEventListener('input', loadPayments);

async function loadPayments(){
  var q = $('paySearch').value.trim();
  var sel = sb.from('payments').select('*, invites(code,used_count,max_uses)')
              .order('created_at',{ascending:false}).limit(300);
  if(q) sel = sel.ilike('email','%'+q.replace(/[%,]/g,'')+'%');
  var r = await sel;
  if(r.error) return $('payList').innerHTML='<p class="tiny">'+esc(r.error.message)+'</p>';
  if(!r.data.length) return $('payList').innerHTML=
    '<p class="tiny">No payments yet. They show up here as soon as Stripe tells us.</p>';

  $('payList').innerHTML = '<div class="card">'+r.data.map(function(p){
    var inv = p.invites;
    return '<div class="row"><div class="rd">'+
      '<div class="rt">'+esc(p.email||'&mdash;')+'</div>'+
      '<div class="rs">'+esc([money(p.amount_cents), p.status, when(p.created_at)]
        .filter(Boolean).join(' · '))+'</div>'+
      '<div class="ra">'+(inv
        ? '<span class="chip verif code">'+esc(inv.code)+'</span>'+
          '<span class="chip">'+inv.used_count+'/'+inv.max_uses+' used</span>'
        : '<span class="chip">no invite yet</span>')+
      '</div></div></div>';
  }).join('')+'</div>';
}

boot();
