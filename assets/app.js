(function(){
  'use strict';

  var LEGAL_VERSION='2026-08-30-v1';

  var client = null;
  var ctx = null;

  var NAV = [
    {id:'home',href:'home.html',label:'Home',icon:'<path d="M4 9.5 12 4l8 5.5V20H4z"/><path d="M9.5 20v-6h5v6"/>'},
    {id:'members',href:'directory.html',label:'Members',icon:'<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3.5 19c.5-3.4 2.6-5.2 5.5-5.2s5 1.8 5.5 5.2"/><path d="M14 14.4c2.9-.6 5.5 1.1 6.2 4.6"/>'},
    {id:'opportunities',href:'opportunities.html',label:'Opportunities',icon:'<path d="M4 7h16v12H4z"/><path d="M9 7V5h6v2"/><path d="M4 11h16"/>'},
    {id:'resources',href:'resources.html',label:'Resources',icon:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/>'},
    {id:'me',href:'me.html',label:'Me',icon:'<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-4 3.7-6 7.5-6s6.7 2 7.5 6"/>'}
  ];

  function $(id){ return document.getElementById(id); }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function initials(name){
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return 'SS';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length-1][0] : '')).toUpperCase();
  }

  function safeColor(value){
    return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#111111';
  }

  function fmtDate(value){
    if(!value) return '';
    var d = new Date(value);
    if(isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:d.getFullYear()!==new Date().getFullYear()?'numeric':undefined});
  }

  function fmtTime(value){
    if(!value) return '';
    var d = new Date(value);
    if(isNaN(d.getTime())) return '';
    var now = new Date();
    var diff = Math.max(0, now.getTime() - d.getTime());
    var mins = Math.floor(diff/60000);
    if(mins < 1) return 'now';
    if(mins < 60) return mins + 'm';
    var hrs = Math.floor(mins/60);
    if(hrs < 24) return hrs + 'h';
    var days = Math.floor(hrs/24);
    if(days < 7) return days + 'd';
    return fmtDate(value);
  }

  function getClient(){
    if(client) return client;
    if(typeof initSupabase !== 'function') throw new Error('App connection did not load.');
    client = initSupabase();
    if(!client) throw new Error('App connection did not start.');
    return client;
  }

  function avatar(member, cls){
    cls = cls || 'avatar';
    if(member && member.profile_photo_url){
      return '<div class="'+cls+'"><img src="'+escapeHtml(member.profile_photo_url)+'" alt=""></div>';
    }
    return '<div class="'+cls+'">'+escapeHtml(initials(member && member.full_name))+'</div>';
  }

  function businessLine(member,business){
    var bits = [];
    if(business && business.name) bits.push(business.name);
    if(business && business.city) bits.push(business.city);
    if(!bits.length && member && member.headline) bits.push(member.headline);
    return bits.join(' · ');
  }

  function shell(active){
    document.body.classList.add('in-app');
    var member = ctx.member;
    var business = ctx.business;

    if($('top')){
      $('top').innerHTML =
        '<a class="logo" href="home.html">seek<i>+</i><br>scale.</a>'+
        '<div class="top-right">'+
          '<a class="top-notify" href="notifications.html" aria-label="Notifications">'+
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>'+
            '<span class="notification-badge notification-count-signal" hidden></span>'+
          '</a>'+
          '<a class="pill" href="helpdesk.html">Get help</a>'+
          '<a class="me-av" href="me.html" aria-label="My profile">'+
            (member.profile_photo_url ? '<img src="'+escapeHtml(member.profile_photo_url)+'" alt="">' : escapeHtml(initials(member.full_name)))+
          '</a>'+
        '</div>';
    }

    var side = $('side');
    var tabs = $('tabs');
    if(side) side.innerHTML = '';
    if(tabs) tabs.innerHTML = '';

    var meIcon = NAV.filter(function(n){return n.id==='me';})[0].icon;
    var helpIcon = '<path d="M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4Z"/><path d="M9.7 9.2a2.45 2.45 0 0 1 4.7.9c0 1.8-2.4 2-2.4 3.5"/><path d="M12 16.8h.01"/>';

    if(side){
      side.insertAdjacentHTML('beforeend',
        '<div class="side-inner">'+
          '<a class="side-brand stacked" href="home.html" aria-label="Seek and Scale home"><span>seek<i>+</i></span><span>scale.</span></a>'+
          '<nav class="side-nav" aria-label="Main navigation"></nav>'+
          '<div class="side-spacer"></div>'+
          '<div class="side-bottom"></div>'+
        '</div>');
    }

    NAV.forEach(function(n){
      var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+n.icon+'</svg>';

      if(side && n.id !== 'me'){
        var nav = side.querySelector('.side-nav');
        nav.insertAdjacentHTML('beforeend',
          '<a class="snav'+(n.id===active?' on':'')+'" href="'+n.href+'">'+svg+'<span>'+n.label+'</span>'+
            (n.id==='members'?'<span class="nav-number member-count-signal" hidden></span>':'')+
          '</a>');
      }

      if(tabs){
        tabs.insertAdjacentHTML('beforeend',
          '<a class="tab'+(n.id===active?' on':'')+'" href="'+n.href+'"><span class="ic">'+svg+'</span><span class="lab">'+n.label+'</span></a>');
      }
    });

    if(side){
      var bottom = side.querySelector('.side-bottom');
      var helpSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+helpIcon+'</svg>';
      var meSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+meIcon+'</svg>';

      var notifySvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';

      bottom.insertAdjacentHTML('beforeend',
        '<a class="snav'+(active==='notifications'?' on':'')+'" href="notifications.html">'+notifySvg+'<span>Notifications</span><span class="notification-badge notification-count-signal" hidden></span></a>'+
        '<a class="snav" href="helpdesk.html">'+helpSvg+'<span>Get help</span></a>'+
        '<a class="snav'+(active==='me'?' on':'')+'" href="me.html">'+meSvg+'<span>Profile</span></a>');
    }
  }

  async function requireMember(active){
    var sb = getClient();
    var sessionResult = await sb.auth.getSession();
    if(sessionResult.error) throw sessionResult.error;

    var session = sessionResult.data && sessionResult.data.session;
    if(!session){
      location.replace('index.html');
      throw new Error('signin');
    }

    var mr = await sb.from('members').select('*').eq('auth_user_id',session.user.id).maybeSingle();
    if(mr.error) throw mr.error;
    if(!mr.data || mr.data.status !== 'active'){
      await sb.auth.signOut();
      location.replace('index.html?state=inactive');
      throw new Error('inactive');
    }

    if(!mr.data.legal_accepted_at || mr.data.legal_version !== LEGAL_VERSION){
      location.replace('legal-consent.html');
      throw new Error('legal');
    }

    if(mr.data.role !== 'admin' && mr.data.onboarding_complete === false){
      location.replace('onboarding.html');
      throw new Error('signin');
    }

    var br = await sb.from('businesses')
      .select('*')
      .eq('member_id',mr.data.id)
      .eq('status','active')
      .order('is_primary',{ascending:false})
      .order('created_at',{ascending:true})
      .limit(1);

    if(br.error) throw br.error;

    ctx = {
      client: sb,
      session: session,
      user: session.user,
      member: mr.data,
      business: br.data && br.data[0] ? br.data[0] : null
    };

    window.SS.ctx = ctx;
    shell(active);
    await refreshShellSignals();
    registerServiceWorker();
    return ctx;
  }

  async function signOut(){
    try{ await getClient().auth.signOut(); }catch(e){}
    location.replace('index.html');
  }

  async function getMemberMaps(memberIds){
    var ids = Array.from(new Set((memberIds || []).filter(Boolean)));
    var memberMap = {}, businessMap = {};
    if(!ids.length) return {members:memberMap,businesses:businessMap};

    var mr = await getClient().from('members')
      .select('id,full_name,headline,bio,looking_for,phone,instagram_url,linkedin_url,profile_photo_url,show_email,show_phone,show_socials,email')
      .in('id',ids)
      .eq('status','active');

    if(mr.error) throw mr.error;
    (mr.data || []).forEach(function(m){ memberMap[m.id] = m; });

    var br = await getClient().from('businesses')
      .select('*')
      .in('member_id',ids)
      .eq('status','active')
      .order('is_primary',{ascending:false});

    if(br.error) throw br.error;
    (br.data || []).forEach(function(b){
      if(!businessMap[b.member_id] || b.is_primary) businessMap[b.member_id] = b;
    });

    return {members:memberMap,businesses:businessMap};
  }

  async function loadPosts(categories, limit){
    var q = getClient().from('posts')
      .select('*')
      .eq('status','published')
      .is('deleted_at',null)
      .order('is_pinned',{ascending:false})
      .order('created_at',{ascending:false})
      .limit(limit || 50);

    if(categories && categories.length) q = q.in('category',categories);

    var pr = await q;
    if(pr.error) throw pr.error;

    var posts = pr.data || [];
    var maps = await getMemberMaps(posts.map(function(p){return p.author_member_id;}));

    posts.forEach(function(p){
      p.author = maps.members[p.author_member_id] || null;
      p.business = maps.businesses[p.author_member_id] || null;
    });
    return posts;
  }

  async function loadReplies(postIds){
    var ids = Array.from(new Set((postIds || []).filter(Boolean)));
    if(!ids.length) return [];

    var rr = await getClient().from('post_replies')
      .select('*')
      .in('post_id',ids)
      .is('deleted_at',null)
      .order('created_at',{ascending:true});

    if(rr.error) throw rr.error;

    var replies = rr.data || [];
    var maps = await getMemberMaps(replies.map(function(r){return r.author_member_id;}));
    replies.forEach(function(r){
      r.author = maps.members[r.author_member_id] || null;
      r.business = maps.businesses[r.author_member_id] || null;
    });
    return replies;
  }

  async function loadMembers(){
    var mr = await getClient().from('members')
      .select('*')
      .eq('status','active')
      .order('full_name',{ascending:true});
    if(mr.error) throw mr.error;

    var br = await getClient().from('businesses')
      .select('*')
      .eq('status','active')
      .order('is_primary',{ascending:false});
    if(br.error) throw br.error;

    var vr = await getClient().from('vouches').select('id,voucher_member_id,target_member_id');
    if(vr.error) throw vr.error;

    var sr = await getClient().from('saved_items').select('item_id').eq('item_type','member');
    if(sr.error) throw sr.error;

    var businessMap = {};
    (br.data || []).forEach(function(b){
      if(!businessMap[b.member_id] || b.is_primary) businessMap[b.member_id] = b;
    });

    var countMap = {}, mine = {}, saved = {};
    (vr.data || []).forEach(function(v){
      countMap[v.target_member_id] = (countMap[v.target_member_id] || 0) + 1;
      if(ctx && v.voucher_member_id === ctx.member.id) mine[v.target_member_id] = v.id;
    });
    (sr.data || []).forEach(function(s){ saved[s.item_id]=true; });

    return (mr.data || []).map(function(m){
      return {
        member:m,
        business:businessMap[m.id] || null,
        vouchCount:countMap[m.id] || 0,
        myVouchId:mine[m.id] || null,
        isSaved:!!saved[m.id]
      };
    });
  }

  function memberCard(item){
    var m = item.member, b = item.business || {};
    var helps = b.helps_with || '';
    var does = b.what_they_do || m.bio || '';
    var own = ctx && m.id === ctx.member.id;
    var trust = item.vouchCount >= 3
      ? '<span class="member-trust">Vouched for by '+item.vouchCount+' members</span>'
      : '';

    return '<article class="member-card" data-member-card="'+escapeHtml(m.id)+'">'+
      '<div class="inside">'+
        '<div class="member-top">'+
          avatar(m,'member-avatar')+
          '<div class="member-id">'+
            '<div class="member-name">'+escapeHtml(m.full_name)+'</div>'+ 
            '<div class="member-biz">'+escapeHtml(b.name || m.headline || '')+'</div>'+ 
            '<div class="member-subline">'+escapeHtml([b.trade,b.city].filter(Boolean).join(' · '))+'</div>'+ 
          '</div>'+ 
          (own?'<span class="chip yellow">You</span>':'')+
        '</div>'+ 
        (helps?'<div class="member-help"><span>Can help with</span><p>'+escapeHtml(helps)+'</p></div>':
          (does?'<div class="member-help"><span>What they do</span><p>'+escapeHtml(does)+'</p></div>':''))+
        '<div class="member-actions">'+
          trust+
          (!own?'<button class="act quiet" type="button" data-save-item="member" data-save-id="'+escapeHtml(m.id)+'">'+(item.isSaved?'Saved':'Save')+'</button>':'')+
          (!own?'<button class="vouch'+(item.myVouchId?' on':'')+'" type="button" data-vouch-target="'+escapeHtml(m.id)+'">'+(item.myVouchId?'Vouched':'Vouch')+'</button>':'')+
          '<a class="act member-view" href="shop.html?id='+encodeURIComponent(m.id)+'">View profile</a>'+ 
        '</div>'+ 
      '</div>'+ 
    '</article>';
  }

  async function toggleVouch(targetMemberId){
    if(!ctx) throw new Error('Not signed in.');
    if(targetMemberId === ctx.member.id) throw new Error('You cannot vouch for yourself.');

    var existing = await getClient().from('vouches')
      .select('id')
      .eq('voucher_member_id',ctx.member.id)
      .eq('target_member_id',targetMemberId)
      .maybeSingle();

    if(existing.error) throw existing.error;

    if(existing.data){
      var del = await getClient().from('vouches').delete().eq('id',existing.data.id);
      if(del.error) throw del.error;
      return false;
    }

    var ins = await getClient().from('vouches').insert({
      voucher_member_id:ctx.member.id,
      target_member_id:targetMemberId
    });
    if(ins.error) throw ins.error;
    return true;
  }

  async function getMember(memberId){
    var mr = await getClient().from('members').select('*').eq('id',memberId).eq('status','active').maybeSingle();
    if(mr.error) throw mr.error;
    if(!mr.data) return null;

    var br = await getClient().from('businesses').select('*').eq('member_id',memberId).eq('status','active')
      .order('is_primary',{ascending:false}).limit(1);
    if(br.error) throw br.error;

    var vr = await getClient().from('vouches').select('id,voucher_member_id,target_member_id').eq('target_member_id',memberId);
    if(vr.error) throw vr.error;

    var my = null;
    (vr.data || []).forEach(function(v){ if(ctx && v.voucher_member_id === ctx.member.id) my = v.id; });

    return {member:mr.data,business:br.data && br.data[0] ? br.data[0] : null,vouchCount:(vr.data || []).length,myVouchId:my};
  }

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .replace(/&/g,' and ')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function looseMatch(a,b){
    var aa=norm(a),bb=norm(b);
    if(!aa || !bb) return false;
    if(aa===bb || aa.indexOf(bb)!==-1 || bb.indexOf(aa)!==-1) return true;

    var at=aa.split(' ').filter(function(x){return x.length>2;});
    var bt=bb.split(' ').filter(function(x){return x.length>2;});
    return at.some(function(x){return bt.indexOf(x)!==-1;});
  }

  function opportunityMatchScore(opportunity,business){
    if(!opportunity || !business) return 0;
    var score=0;
    if(looseMatch(opportunity.trade_needed,business.trade)) score+=2;
    if(looseMatch(opportunity.city,business.city)) score+=1;
    return score;
  }

  async function loadOpportunities(statuses,limit){
    var q=getClient().from('opportunities')
      .select('*')
      .order('created_at',{ascending:false})
      .limit(limit || 100);

    if(statuses && statuses.length) q=q.in('status',statuses);

    var r=await q;
    if(r.error) throw r.error;

    var rows=r.data || [];
    var ids=[];
    rows.forEach(function(o){
      if(o.poster_member_id)ids.push(o.poster_member_id);
      if(o.claimed_by_member_id)ids.push(o.claimed_by_member_id);
    });

    var maps=await getMemberMaps(ids);
    rows.forEach(function(o){
      o.poster=maps.members[o.poster_member_id] || null;
      o.posterBusiness=maps.businesses[o.poster_member_id] || null;
      o.claimer=maps.members[o.claimed_by_member_id] || null;
      o.claimerBusiness=maps.businesses[o.claimed_by_member_id] || null;
    });
    return rows;
  }

  function opportunityOutcomeLabel(value){
    var labels={
      work_connected:'Work connected',
      referral_made:'Referral made',
      hire_made:'Hire made',
      connection_made:'Connection made',
      no_outcome:'No outcome',
      cancelled:'Cancelled',
      other:'Other'
    };
    return labels[value] || '';
  }

  async function loadSavedSet(){
    var r=await getClient().from('saved_items').select('item_type,item_id');
    if(r.error) throw r.error;
    var set=new Set();
    (r.data||[]).forEach(function(x){ set.add(x.item_type+':'+x.item_id); });
    return set;
  }

  async function toggleSave(itemType,itemId){
    var r=await getClient().rpc('toggle_saved_item',{p_item_type:itemType,p_item_id:itemId});
    if(r.error) throw r.error;
    return !!(r.data && r.data.saved);
  }

  function cleanUrl(value){
    var v=String(value||'').trim();
    if(!v)return '';
    if(!/^https?:\/\//i.test(v))v='https://'+v;
    try{
      var u=new URL(v);
      if(u.protocol!=='http:'&&u.protocol!=='https:')return '';
      return u.href;
    }catch(e){return '';}
  }

  function linkHost(value){
    try{return new URL(cleanUrl(value)).hostname.replace(/^www\./,'');}
    catch(e){return String(value||'');}
  }

  async function uploadCommunityFile(file){
    if(!ctx)throw new Error('Not signed in.');
    if(!file)throw new Error('Choose a file.');
    var kind='';
    if(file.type==='application/pdf')kind='pdf';
    if(['image/jpeg','image/png','image/webp'].indexOf(file.type)!==-1)kind='image';
    if(!kind)throw new Error('Use a PDF, JPG, PNG or WebP file.');
    var max=kind==='pdf'?15*1024*1024:8*1024*1024;
    if(file.size>max)throw new Error(kind==='pdf'?'PDF must be 15 MB or smaller.':'Image must be 8 MB or smaller.');
    var safe=String(file.name||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-100);
    var path=ctx.user.id+'/posts/'+Date.now()+'-'+safe;
    var up=await getClient().storage.from('community-files').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
    if(up.error)throw up.error;
    return {path:path,name:file.name||safe,kind:kind};
  }

  async function resolveCommunityFile(path){
    if(!path)return '';
    if(/^https?:\/\//i.test(path))return path;
    var r=await getClient().storage.from('community-files').createSignedUrl(path,60*60);
    if(r.error)throw r.error;
    return r.data && r.data.signedUrl ? r.data.signedUrl : '';
  }

  async function loadMemberMatches(){
    var r=await getClient().from('member_matches')
      .select('*')
      .eq('member_id',ctx.member.id)
      .eq('status','suggested')
      .order('created_at',{ascending:false})
      .limit(5);
    if(r.error)throw r.error;
    var rows=r.data||[];
    var maps=await getMemberMaps(rows.map(function(x){return x.matched_member_id;}));
    rows.forEach(function(x){
      x.member=maps.members[x.matched_member_id]||null;
      x.business=maps.businesses[x.matched_member_id]||null;
    });
    return rows;
  }

  async function loadRecommendations(){
    var r=await getClient().from('recommendations')
      .select('*')
      .eq('status','active')
      .order('created_at',{ascending:false})
      .limit(300);
    if(r.error)throw r.error;
    var rows=r.data||[];
    var maps=await getMemberMaps(rows.map(function(x){return x.recommended_by_member_id;}));
    rows.forEach(function(x){x.recommender=maps.members[x.recommended_by_member_id]||null;});
    return rows;
  }

  function opportunityTypeLabel(value){
    return ({work:'Work',referral:'Referral',hiring:'Hiring',talent:'Talent available',need:'Need / request'})[value] || 'Opportunity';
  }


  async function countActiveMembers(){
    var r=await getClient().from('members')
      .select('id',{count:'exact',head:true})
      .eq('status','active')
      .eq('onboarding_complete',true);
    if(r.error)throw r.error;
    return r.count || 0;
  }

  async function countUnreadNotifications(){
    var r=await getClient().from('notifications')
      .select('id',{count:'exact',head:true})
      .eq('member_id',ctx.member.id)
      .is('read_at',null);
    if(r.error){
      if(String(r.error.message||'').toLowerCase().indexOf('notifications')!==-1)return 0;
      throw r.error;
    }
    return r.count || 0;
  }

  async function refreshShellSignals(){
    if(!ctx)return;
    try{
      var values=await Promise.all([countActiveMembers(),countUnreadNotifications()]);
      document.querySelectorAll('.member-count-signal').forEach(function(el){
        el.textContent=values[0];
        el.hidden=false;
      });
      document.querySelectorAll('.notification-count-signal').forEach(function(el){
        el.textContent=values[1] > 99 ? '99+' : String(values[1]);
        el.hidden=values[1]===0;
      });
    }catch(e){
      // Shell counts are helpful, but they should never stop the app from loading.
    }
  }

  async function loadMentionableMembers(){
    var mr=await getClient().from('members')
      .select('id,full_name,profile_photo_url,headline')
      .eq('status','active')
      .eq('onboarding_complete',true)
      .order('full_name',{ascending:true});

    if(mr.error)throw mr.error;

    var rows=mr.data||[];
    var maps=await getMemberMaps(rows.map(function(m){return m.id;}));

    return rows.map(function(m){
      return {
        id:m.id,
        full_name:m.full_name,
        profile_photo_url:m.profile_photo_url,
        headline:m.headline,
        business:maps.businesses[m.id]||null
      };
    });
  }

  function mentionRanges(text,members){
    var source=String(text||'');
    var lower=source.toLowerCase();
    var ranges=[];
    var sorted=(members||[]).filter(function(m){return m&&m.id&&m.full_name;}).slice()
      .sort(function(a,b){return b.full_name.length-a.full_name.length;});

    function boundaryBefore(ch){
      return !ch || /[\s(\[{"']/i.test(ch);
    }
    function boundaryAfter(ch){
      return !ch || /[\s.,!?;:)\]}"']/i.test(ch);
    }
    function overlaps(start,end){
      return ranges.some(function(r){return start<r.end && end>r.start;});
    }

    sorted.forEach(function(m){
      var token='@'+String(m.full_name).trim();
      var needle=token.toLowerCase();
      var at=0;

      while(needle.length>1 && (at=lower.indexOf(needle,at))!==-1){
        var end=at+needle.length;
        var before=at>0?source.charAt(at-1):'';
        var after=end<source.length?source.charAt(end):'';

        if(boundaryBefore(before)&&boundaryAfter(after)&&!overlaps(at,end)){
          ranges.push({start:at,end:end,member:m,text:source.slice(at,end)});
        }
        at=end;
      }
    });

    return ranges.sort(function(a,b){return a.start-b.start;});
  }

  function findMentionIds(text,members){
    var seen={};
    return mentionRanges(text,members).map(function(r){return r.member.id;})
      .filter(function(id){
        if(seen[id])return false;
        seen[id]=true;
        return true;
      });
  }

  function renderMentions(text,members){
    var source=String(text||'');
    var ranges=mentionRanges(source,members);
    if(!ranges.length)return escapeHtml(source);

    var html='',cursor=0;
    ranges.forEach(function(r){
      html+=escapeHtml(source.slice(cursor,r.start));
      html+='<a class="mention-link" href="shop.html?id='+encodeURIComponent(r.member.id)+'">'+escapeHtml(r.text)+'</a>';
      cursor=r.end;
    });
    html+=escapeHtml(source.slice(cursor));
    return html;
  }

  function initMentionAutocomplete(members){
    var list=(members||[]).filter(function(m){
      return m && m.id && m.full_name && (!ctx || m.id!==ctx.member.id);
    });

    var old=document.getElementById('mentionAutocomplete');
    if(old)old.remove();

    var menu=document.createElement('div');
    menu.id='mentionAutocomplete';
    menu.className='mention-menu';
    menu.hidden=true;
    document.body.appendChild(menu);

    var target=null,atIndex=-1,currentHits=[];

    function hide(){
      menu.hidden=true;
      menu.innerHTML='';
      target=null;
      atIndex=-1;
      currentHits=[];
    }

    function position(el){
      var r=el.getBoundingClientRect();
      var width=Math.min(340,Math.max(240,r.width));
      menu.style.width=width+'px';
      menu.style.left=Math.max(8,Math.min(window.innerWidth-width-8,r.left))+'px';
      menu.style.top=Math.min(window.innerHeight-250,r.bottom+6)+'px';
    }

    function currentQuery(el){
      if(typeof el.selectionStart!=='number')return null;
      var before=el.value.slice(0,el.selectionStart);
      var at=before.lastIndexOf('@');
      if(at<0)return null;
      if(at>0 && !/[\s(\[{"']/.test(before.charAt(at-1)))return null;

      var q=before.slice(at+1);
      if(q.length>45 || /[\n,;:!?]/.test(q))return null;
      return {at:at,q:q};
    }

    function show(el){
      var info=currentQuery(el);
      if(!info){hide();return;}

      var q=norm(info.q);
      var hits=list.filter(function(m){
        if(!q)return true;
        var b=m.business||{};
        return norm(m.full_name).indexOf(q)!==-1 ||
          norm(b.name).indexOf(q)!==-1 ||
          norm(b.trade).indexOf(q)!==-1;
      }).slice(0,6);

      if(!hits.length){hide();return;}

      target=el;
      atIndex=info.at;
      currentHits=hits;
      menu.innerHTML=hits.map(function(m){
        var b=m.business||{};
        var line=[b.name,b.trade,b.city].filter(Boolean).join(' · ');
        return '<button class="mention-option" type="button" data-mention-member="'+escapeHtml(m.id)+'">'+
          avatar(m,'mention-avatar')+
          '<span><strong>'+escapeHtml(m.full_name)+'</strong><small>'+escapeHtml(line||m.headline||'Member')+'</small></span>'+
        '</button>';
      }).join('');
      position(el);
      menu.hidden=false;
    }

    document.addEventListener('input',function(e){
      if(e.target && e.target.matches('[data-mention-input]'))show(e.target);
    });

    document.addEventListener('click',function(e){
      var option=e.target.closest('[data-mention-member]');
      if(option && target){
        var member=currentHits.filter(function(m){return m.id===option.dataset.mentionMember;})[0];
        if(!member)return;

        var caret=target.selectionStart;
        var before=target.value.slice(0,atIndex);
        var after=target.value.slice(caret);
        var insert='@'+member.full_name+' ';
        target.value=before+insert+after;
        var next=before.length+insert.length;
        target.focus();
        target.setSelectionRange(next,next);
        target.dispatchEvent(new Event('input',{bubbles:true}));
        hide();
        e.preventDefault();
        return;
      }

      if(!e.target.closest('.mention-menu') && !(e.target && e.target.matches('[data-mention-input]'))){
        hide();
      }
    });

    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&!menu.hidden)hide();
    });

    window.addEventListener('resize',hide);
    window.addEventListener('scroll',hide,true);
  }

  async function notifyMentions(text,postId,replyId,members){
    var ids=findMentionIds(text,members);
    if(!ids.length)return 0;

    var r=await getClient().rpc('notify_mentions',{
      p_member_ids:ids,
      p_post_id:postId||null,
      p_reply_id:replyId||null
    });
    if(r.error)throw r.error;

    return r.data && r.data.created ? r.data.created : 0;
  }

  async function loadNotifications(limit){
    var r=await getClient().from('notifications')
      .select('*')
      .eq('member_id',ctx.member.id)
      .order('created_at',{ascending:false})
      .limit(limit||100);

    if(r.error)throw r.error;

    var rows=r.data||[];
    var maps=await getMemberMaps(rows.map(function(x){return x.actor_member_id;}));
    rows.forEach(function(x){
      x.actor=maps.members[x.actor_member_id]||null;
      x.actorBusiness=maps.businesses[x.actor_member_id]||null;
    });
    return rows;
  }

  async function markAllNotificationsRead(){
    var r=await getClient().rpc('mark_all_notifications_read');
    if(r.error)throw r.error;
    await refreshShellSignals();
    return r.data||0;
  }

  function socialHref(value){
    var v = String(value || '').trim();
    if(!v) return '';
    if(/^https?:\/\//i.test(v)) return v;
    return 'https://' + v.replace(/^@/,'');
  }

  async function shareMember(item){
    var m = item.member, b = item.business || {};
    var parts = [m.full_name];
    if(b.name) parts.push(b.name);
    if(b.trade || b.city) parts.push([b.trade,b.city].filter(Boolean).join(' · '));
    if(b.website) parts.push(b.website);
    var text = parts.join('\n');
    var url = location.origin + '/shop.html?id=' + encodeURIComponent(m.id);

    if(navigator.share){
      await navigator.share({title:m.full_name,text:text,url:url});
      return;
    }
    if(navigator.clipboard){
      await navigator.clipboard.writeText(text + '\n' + url);
      toast('Member info copied.');
      return;
    }
    window.prompt('Copy this member info:', text + '\n' + url);
  }

  function toast(text){
    var old = document.querySelector('.toast');
    if(old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function(){ if(el.parentNode) el.remove(); },2200);
  }

  function pageError(targetId, text){
    var el = $(targetId);
    if(el) el.innerHTML = '<div class="card"><div class="empty">'+escapeHtml(text || 'Something went wrong.')+'</div></div>';
  }

  function registerServiceWorker(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    }
  }

  window.SS = {
    get client(){ return getClient(); },
    get ctx(){ return ctx; },
    set ctx(v){ ctx=v; },
    $:$,
    esc:escapeHtml,
    initials:initials,
    safeColor:safeColor,
    fmtDate:fmtDate,
    fmtTime:fmtTime,
    avatar:avatar,
    businessLine:businessLine,
    requireMember:requireMember,
    signOut:signOut,
    loadPosts:loadPosts,
    loadReplies:loadReplies,
    loadMembers:loadMembers,
    memberCard:memberCard,
    toggleVouch:toggleVouch,
    getMember:getMember,
    norm:norm,
    looseMatch:looseMatch,
    opportunityMatchScore:opportunityMatchScore,
    loadOpportunities:loadOpportunities,
    opportunityOutcomeLabel:opportunityOutcomeLabel,
    opportunityTypeLabel:opportunityTypeLabel,
    loadSavedSet:loadSavedSet,
    toggleSave:toggleSave,
    cleanUrl:cleanUrl,
    linkHost:linkHost,
    uploadCommunityFile:uploadCommunityFile,
    resolveCommunityFile:resolveCommunityFile,
    loadMemberMatches:loadMemberMatches,
    loadRecommendations:loadRecommendations,
    countActiveMembers:countActiveMembers,
    countUnreadNotifications:countUnreadNotifications,
    refreshShellSignals:refreshShellSignals,
    loadMentionableMembers:loadMentionableMembers,
    findMentionIds:findMentionIds,
    renderMentions:renderMentions,
    initMentionAutocomplete:initMentionAutocomplete,
    notifyMentions:notifyMentions,
    loadNotifications:loadNotifications,
    markAllNotificationsRead:markAllNotificationsRead,
    socialHref:socialHref,
    shareMember:shareMember,
    toast:toast,
    pageError:pageError,
    registerServiceWorker:registerServiceWorker
  };
})();