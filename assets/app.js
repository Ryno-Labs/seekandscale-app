(function(){
  'use strict';

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
          '<a class="pill" href="helpdesk.html">Get help</a>'+
          '<div class="whoami"><span class="nm">'+escapeHtml(member.full_name)+'</span>'+
          '<span class="bz">'+escapeHtml(business ? business.name : (member.headline || 'Member'))+'</span></div>'+
          '<a class="me-av" href="me.html">'+
            (member.profile_photo_url ? '<img src="'+escapeHtml(member.profile_photo_url)+'" alt="">' : escapeHtml(initials(member.full_name)))+
          '</a>'+
        '</div>';
    }

    var side = $('side');
    var tabs = $('tabs');
    if(side) side.innerHTML = '';
    if(tabs) tabs.innerHTML = '';

    NAV.forEach(function(n){
      var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+n.icon+'</svg>';
      if(side){
        side.insertAdjacentHTML('beforeend',
          '<a class="snav'+(n.id===active?' on':'')+'" href="'+n.href+'">'+svg+'<span>'+n.label+'</span></a>');
      }
      if(tabs){
        tabs.insertAdjacentHTML('beforeend',
          '<a class="tab'+(n.id===active?' on':'')+'" href="'+n.href+'"><span class="ic">'+svg+'</span><span class="lab">'+n.label+'</span></a>');
      }
    });

    if(side){
      side.insertAdjacentHTML('beforeend','<div class="side-support"><div class="side-support-label">Seek &amp; Scale</div><a class="side-help" href="helpdesk.html"><span class="help-copy">Need help getting something done?</span><span class="arrow">→</span></a></div>');
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

    var businessMap = {};
    (br.data || []).forEach(function(b){
      if(!businessMap[b.member_id] || b.is_primary) businessMap[b.member_id] = b;
    });

    var countMap = {}, mine = {};
    (vr.data || []).forEach(function(v){
      countMap[v.target_member_id] = (countMap[v.target_member_id] || 0) + 1;
      if(ctx && v.voucher_member_id === ctx.member.id) mine[v.target_member_id] = v.id;
    });

    return (mr.data || []).map(function(m){
      return {member:m,business:businessMap[m.id] || null,vouchCount:countMap[m.id] || 0,myVouchId:mine[m.id] || null};
    });
  }

  function memberCard(item){
    var m = item.member, b = item.business || {};
    var color = safeColor(b.brand_color);
    var does = b.what_they_do || m.bio || '';
    var helps = b.helps_with || '';
    var own = ctx && m.id === ctx.member.id;

    return '<article class="member-card" data-member-card="'+escapeHtml(m.id)+'">'+
      '<div class="band" style="background:'+color+'"></div>'+
      '<div class="inside">'+
        '<div class="member-top">'+
          avatar(m)+
          '<div class="member-id">'+
            '<div class="member-name">'+escapeHtml(m.full_name)+'</div>'+
            '<div class="member-biz">'+escapeHtml(businessLine(m,b))+'</div>'+
            '<div class="member-tags">'+
              (b.trade?'<span class="chip">'+escapeHtml(b.trade)+'</span>':'')+
              (own?'<span class="chip yellow">You</span>':'')+
            '</div>'+
          '</div>'+
        '</div>'+
        ((does || helps) ? '<div class="member-summary">'+
          (does?'<div class="qa-label">What they do</div><p class="qa-copy">'+escapeHtml(does)+'</p>':'')+
          (helps?'<div class="qa-label">How they can help</div><p class="qa-copy">'+escapeHtml(helps)+'</p>':'')+
        '</div>' : '')+
        '<div class="member-actions">'+
          (!own?'<button class="vouch'+(item.myVouchId?' on':'')+'" type="button" data-vouch-target="'+escapeHtml(m.id)+'">'+
            (item.myVouchId?'Vouched':'Vouch')+' · <span>'+item.vouchCount+'</span></button>':'<span class="tiny">'+item.vouchCount+' vouches</span>')+
          '<a class="act" style="margin-left:auto" href="shop.html?id='+encodeURIComponent(m.id)+'">View member</a>'+
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
    socialHref:socialHref,
    shareMember:shareMember,
    toast:toast,
    pageError:pageError,
    registerServiceWorker:registerServiceWorker
  };
})();