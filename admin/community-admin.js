/* ============================================================
   SEEK & SCALE — COMMUNITY V1 ADMIN
   ============================================================ */

var supabaseClient = null;
var currentAdmin = null;
var memberCache = [];


/* ============================================================
   HELPERS
   ============================================================ */

function $(id) {
  return document.getElementById(id);
}

function safe(value) {
  return value == null ? '' : String(value);
}

function initials(name) {
  return safe(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(function (part) {
      return part.charAt(0).toUpperCase();
    })
    .join('') || '?';
}

function escapeHtml(value) {
  return safe(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showMessage(message, isError) {
  var el = $('memberMessage');

  if (!el) return;

  el.textContent = message || '';
  el.style.color = isError ? '#b42318' : '#6b6b6b';
}


/* ============================================================
   SUPABASE
   ============================================================ */

function startSupabase() {

  if (typeof initSupabase === 'function') {
    supabaseClient = initSupabase();
  }

  if (!supabaseClient && typeof sb !== 'undefined' && sb) {
    supabaseClient = sb;
  }

  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
  }

  if (!supabaseClient) {
    throw new Error('Supabase could not be initialized.');
  }
}


/* ============================================================
   BOOT
   ============================================================ */

async function boot() {

  try {

    startSupabase();

    var sessionResult =
      await supabaseClient.auth.getSession();

    var session =
      sessionResult.data &&
      sessionResult.data.session;

    if (!session) {
      showLogin();
      return;
    }

    await openAdmin(session.user);

  } catch (error) {

    console.error(error);

    showLogin();

    $('loginError').textContent =
      error.message || 'Unable to start Admin.';
  }
}


/* ============================================================
   LOGIN
   ============================================================ */

function showLogin() {
  $('loginView').classList.remove('hidden');
  $('adminView').classList.add('hidden');
}

function showAdmin() {
  $('loginView').classList.add('hidden');
  $('adminView').classList.remove('hidden');
}


$('loginForm').addEventListener(
  'submit',
  async function (event) {

    event.preventDefault();

    $('loginError').textContent = '';

    var email =
      $('loginEmail').value.trim();

    var password =
      $('loginPassword').value;

    if (!email || !password) {
      $('loginError').textContent =
        'Enter your email and password.';
      return;
    }

    var result =
      await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (result.error) {
      $('loginError').textContent =
        result.error.message;
      return;
    }

    await openAdmin(result.data.user);
  }
);


$('signOutBtn').addEventListener(
  'click',
  async function () {

    await supabaseClient.auth.signOut();

    currentAdmin = null;

    showLogin();
  }
);


/* ============================================================
   ADMIN CHECK
   ============================================================ */

async function openAdmin(user) {

  var result =
    await supabaseClient
      .from('members')
      .select(
        'id, full_name, email, role, status'
      )
      .eq('auth_user_id', user.id)
      .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  var member = result.data;

  if (
    !member ||
    member.role !== 'admin' ||
    member.status !== 'active'
  ) {

    await supabaseClient.auth.signOut();

    showLogin();

    $('loginError').textContent =
      'This account does not have Admin access.';

    return;
  }

  currentAdmin = member;

  $('adminName').textContent =
    member.full_name || 'Admin';

  showAdmin();

  await loadDashboard();
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function showView(name) {

  document
    .querySelectorAll('.admin-page')
    .forEach(function (page) {
      page.classList.add('hidden');
    });

  document
    .querySelectorAll('.nav-btn')
    .forEach(function (button) {
      button.classList.remove('active');
    });

  var target =
    $('view-' + name);

  if (target) {
    target.classList.remove('hidden');
  }

  var nav =
    document.querySelector(
      '.nav-btn[data-view="' + name + '"]'
    );

  if (nav) {
    nav.classList.add('active');
  }

  if (name === 'dashboard') {
    loadDashboard();
  }

  if (name === 'members') {
    loadMembers();
  }

  if (name === 'help') {
    loadHelpRequests();
  }

  if (name === 'invites') {
    loadInvites();
  }
}


document
  .querySelectorAll('.nav-btn')
  .forEach(function (button) {

    button.addEventListener(
      'click',
      function () {
        showView(button.dataset.view);
      }
    );
  });


/* ============================================================
   DASHBOARD
   ============================================================ */

async function countRows(table, filterFn) {

  var query =
    supabaseClient
      .from(table)
      .select('*', {
        count: 'exact',
        head: true
      });

  if (filterFn) {
    query = filterFn(query);
  }

  var result = await query;

  if (result.error) {
    console.error(result.error);
    return 0;
  }

  return result.count || 0;
}


async function loadDashboard() {

  var counts = await Promise.all([

    countRows(
      'members',
      function (q) {
        return q.eq('status', 'active');
      }
    ),

    countRows('posts'),

    countRows(
      'help_requests',
      function (q) {
        return q.not(
          'status',
          'in',
          '("done","closed")'
        );
      }
    )

  ]);

  $('statMembers').textContent = counts[0];
  $('statPosts').textContent = counts[1];
  $('statHelp').textContent = counts[2];
}


/* ============================================================
   LOAD MEMBERS
   ============================================================ */

async function loadMembers() {

  $('memberList').innerHTML =
    '<p class="muted">Loading members...</p>';

  var result =
    await supabaseClient
      .from('members')
      .select(
        `
          *,
          businesses (
            id,
            name,
            trade,
            city,
            what_they_do,
            helps_with,
            contact_email,
            contact_phone,
            website,
            logo_url,
            banner_url,
            brand_color,
            is_primary,
            status
          )
        `
      )
      .order('created_at', {
        ascending: false
      });

  if (result.error) {

    console.error(result.error);

    $('memberList').innerHTML =
      '<p class="error">' +
      escapeHtml(result.error.message) +
      '</p>';

    return;
  }

  memberCache = result.data || [];

  renderMembers();
}


function primaryBusiness(member) {

  var businesses =
    member.businesses || [];

  for (var i = 0; i < businesses.length; i++) {

    if (businesses[i].is_primary) {
      return businesses[i];
    }
  }

  return businesses[0] || null;
}


function renderMembers() {

  var search =
    $('memberSearch')
      .value
      .trim()
      .toLowerCase();

  var members =
    memberCache.filter(function (member) {

      var business =
        primaryBusiness(member);

      var haystack = [
        member.full_name,
        member.email,
        member.headline,
        business && business.name,
        business && business.trade,
        business && business.city
      ]
        .join(' ')
        .toLowerCase();

      return !search ||
        haystack.indexOf(search) !== -1;
    });

  if (!members.length) {

    $('memberList').innerHTML =
      '<p class="muted" style="padding:18px 0">' +
      'No members found.' +
      '</p>';

    return;
  }

  $('memberList').innerHTML =
    members.map(function (member) {

      var business =
        primaryBusiness(member);

      var businessName =
        business && business.name
          ? business.name
          : 'No business added';

      var meta = [
        business && business.trade,
        business && business.city,
        member.status
      ]
        .filter(Boolean)
        .join(' · ');

      var avatar;

      if (member.profile_photo_url) {

        avatar =
          '<img class="avatar" src="' +
          escapeHtml(member.profile_photo_url) +
          '" alt="">';

      } else {

        avatar =
          '<div class="avatar" ' +
          'style="display:grid;place-items:center;font-weight:800">' +
          escapeHtml(initials(member.full_name)) +
          '</div>';
      }

      return (
        '<div class="member-row">' +

          avatar +

          '<div class="member-main">' +

            '<div class="member-name">' +
              escapeHtml(member.full_name) +
            '</div>' +

            '<div class="member-meta">' +
              escapeHtml(businessName) +
            '</div>' +

            '<div class="member-meta">' +
              escapeHtml(meta) +
            '</div>' +

          '</div>' +

          '<button ' +
            'class="btn secondary edit-member-btn" ' +
            'data-member-id="' +
            escapeHtml(member.id) +
            '">' +
            'Edit' +
          '</button>' +

        '</div>'
      );

    }).join('');
}


$('memberSearch').addEventListener(
  'input',
  renderMembers
);


/* ============================================================
   MEMBER EDITOR
   ============================================================ */

function clearMemberForm() {

  $('memberId').value = '';

  $('memberFullName').value = '';
  $('memberEmail').value = '';
  $('memberHeadline').value = '';
  $('memberBio').value = '';
  $('memberLookingFor').value = '';
  $('memberPhone').value = '';
  $('memberInstagram').value = '';
  $('memberLinkedIn').value = '';

  $('businessName').value = '';
  $('businessTrade').value = '';
  $('businessCity').value = '';
  $('businessColor').value = '#111111';
  $('businessWhatTheyDo').value = '';
  $('businessHelpsWith').value = '';
  $('businessPhone').value = '';
  $('businessEmail').value = '';
  $('businessWebsite').value = '';

  $('profilePhotoUrl').value = '';
  $('businessLogoUrl').value = '';
  $('businessBannerUrl').value = '';

  $('profilePhotoFile').value = '';
  $('businessLogoFile').value = '';
  $('businessBannerFile').value = '';

  $('createInviteBtn').disabled = true;

  showMessage('');
}


function openNewMember() {

  clearMemberForm();

  $('memberEditorTitle').textContent =
    'Add member';

  showView('member-editor');
}


function openExistingMember(id) {

  var member =
    memberCache.find(function (item) {
      return item.id === id;
    });

  if (!member) return;

  clearMemberForm();

  var business =
    primaryBusiness(member);

  $('memberId').value =
    member.id;

  $('memberFullName').value =
    safe(member.full_name);

  $('memberEmail').value =
    safe(member.email);

  $('memberHeadline').value =
    safe(member.headline);

  $('memberBio').value =
    safe(member.bio);

  $('memberLookingFor').value =
    safe(member.looking_for);

  $('memberPhone').value =
    safe(member.phone);

  $('memberInstagram').value =
    safe(member.instagram_url);

  $('memberLinkedIn').value =
    safe(member.linkedin_url);

  $('profilePhotoUrl').value =
    safe(member.profile_photo_url);


  if (business) {

    $('businessName').value =
      safe(business.name);

    $('businessTrade').value =
      safe(business.trade);

    $('businessCity').value =
      safe(business.city);

    $('businessWhatTheyDo').value =
      safe(business.what_they_do);

    $('businessHelpsWith').value =
      safe(business.helps_with);

    $('businessPhone').value =
      safe(business.contact_phone);

    $('businessEmail').value =
      safe(business.contact_email);

    $('businessWebsite').value =
      safe(business.website);

    $('businessLogoUrl').value =
      safe(business.logo_url);

    $('businessBannerUrl').value =
      safe(business.banner_url);

    $('businessColor').value =
      safe(business.brand_color) ||
      '#111111';
  }

  $('memberEditorTitle').textContent =
    'Edit ' + safe(member.full_name);

  $('createInviteBtn').disabled =
    member.status === 'active';

  showView('member-editor');
}


$('newMemberBtn').addEventListener(
  'click',
  openNewMember
);


$('backToMembersBtn').addEventListener(
  'click',
  function () {
    showView('members');
  }
);


document.addEventListener(
  'click',
  function (event) {

    var button =
      event.target.closest(
        '.edit-member-btn'
      );

    if (!button) return;

    openExistingMember(
      button.dataset.memberId
    );
  }
);


/* ============================================================
   IMAGE UPLOADS
   ============================================================ */

function fileExtension(file) {

  var name =
    file.name || '';

  var parts =
    name.split('.');

  if (parts.length < 2) {
    return 'jpg';
  }

  return parts
    .pop()
    .toLowerCase();
}


async function uploadMemberImage(
  file,
  memberId,
  type
) {

  if (!file) return null;

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      'Images must be smaller than 5 MB.'
    );
  }

  var extension =
    fileExtension(file);

  var path =
    'members/' +
    memberId +
    '/' +
    type +
    '-' +
    Date.now() +
    '.' +
    extension;

  var upload =
    await supabaseClient
      .storage
      .from('member-media')
      .upload(
        path,
        file,
        {
          cacheControl: '3600',
          upsert: false
        }
      );

  if (upload.error) {
    throw upload.error;
  }

  var publicResult =
    supabaseClient
      .storage
      .from('member-media')
      .getPublicUrl(path);

  return publicResult.data.publicUrl;
}


/* ============================================================
   FORM DATA
   ============================================================ */

function memberPayload() {

  return {

    p_full_name:
      $('memberFullName').value.trim(),

    p_email:
      $('memberEmail').value.trim(),

    p_headline:
      $('memberHeadline').value.trim(),

    p_bio:
      $('memberBio').value.trim(),

    p_looking_for:
      $('memberLookingFor').value.trim(),

    p_phone:
      $('memberPhone').value.trim(),

    p_instagram_url:
      $('memberInstagram').value.trim(),

    p_linkedin_url:
      $('memberLinkedIn').value.trim(),

    p_profile_photo_url:
      $('profilePhotoUrl').value.trim(),

    p_business_name:
      $('businessName').value.trim(),

    p_trade:
      $('businessTrade').value.trim(),

    p_city:
      $('businessCity').value.trim(),

    p_what_they_do:
      $('businessWhatTheyDo').value.trim(),

    p_helps_with:
      $('businessHelpsWith').value.trim(),

    p_business_phone:
      $('businessPhone').value.trim(),

    p_business_email:
      $('businessEmail').value.trim(),

    p_website:
      $('businessWebsite').value.trim(),

    p_logo_url:
      $('businessLogoUrl').value.trim(),

    p_banner_url:
      $('businessBannerUrl').value.trim(),

    p_brand_color:
      $('businessColor').value.trim() ||
      '#111111'
  };
}


/* ============================================================
   SAVE MEMBER
   ============================================================ */

$('saveMemberBtn').addEventListener(
  'click',
  async function () {

    var button =
      $('saveMemberBtn');

    var originalText =
      button.textContent;

    try {

      showMessage('');

      var payload =
        memberPayload();

      if (!payload.p_full_name) {
        throw new Error(
          'Full name is required.'
        );
      }

      button.disabled = true;
      button.textContent = 'Saving...';

      var memberId =
        $('memberId').value.trim();


      /* ------------------------------------------
         NEW MEMBER
         ------------------------------------------ */

      if (!memberId) {

        var createResult =
          await supabaseClient.rpc(
            'admin_create_member',
            payload
          );

        if (createResult.error) {
          throw createResult.error;
        }

        if (
          !createResult.data ||
          !createResult.data.member_id
        ) {
          throw new Error(
            'Member was not created.'
          );
        }

        memberId =
          createResult.data.member_id;

        $('memberId').value =
          memberId;
      }


      /* ------------------------------------------
         IMAGE UPLOADS
         ------------------------------------------ */

      var profileFile =
        $('profilePhotoFile').files[0];

      var logoFile =
        $('businessLogoFile').files[0];

      var bannerFile =
        $('businessBannerFile').files[0];


      if (profileFile) {

        payload.p_profile_photo_url =
          await uploadMemberImage(
            profileFile,
            memberId,
            'profile'
          );

        $('profilePhotoUrl').value =
          payload.p_profile_photo_url;
      }


      if (logoFile) {

        payload.p_logo_url =
          await uploadMemberImage(
            logoFile,
            memberId,
            'logo'
          );

        $('businessLogoUrl').value =
          payload.p_logo_url;
      }


      if (bannerFile) {

        payload.p_banner_url =
          await uploadMemberImage(
            bannerFile,
            memberId,
            'banner'
          );

        $('businessBannerUrl').value =
          payload.p_banner_url;
      }


      /* ------------------------------------------
         UPDATE FINAL DATA
         ------------------------------------------ */

      payload.p_member_id =
        memberId;

      var updateResult =
        await supabaseClient.rpc(
          'admin_update_member',
          payload
        );

      if (updateResult.error) {
        throw updateResult.error;
      }


      $('profilePhotoFile').value = '';
      $('businessLogoFile').value = '';
      $('businessBannerFile').value = '';

      $('createInviteBtn').disabled = false;

      showMessage(
        'Member saved successfully.'
      );

      await loadMembers();

      $('memberEditorTitle').textContent =
        'Edit ' +
        $('memberFullName').value.trim();

    } catch (error) {

      console.error(error);

      showMessage(
        error.message ||
        'Unable to save member.',
        true
      );

    } finally {

      button.disabled = false;
      button.textContent = originalText;
    }
  }
);


/* ============================================================
   CREATE INVITE
   ============================================================ */

$('createInviteBtn').addEventListener(
  'click',
  async function () {

    var memberId =
      $('memberId').value.trim();

    if (!memberId) {
      showMessage(
        'Save the member first.',
        true
      );
      return;
    }

    var button =
      $('createInviteBtn');

    button.disabled = true;

    var oldText =
      button.textContent;

    button.textContent =
      'Creating...';

    try {

      var result =
        await supabaseClient.rpc(
          'create_member_invite',
          {
            p_member_id: memberId
          }
        );

      if (result.error) {
        throw result.error;
      }

      var code =
        result.data;

      var link =
        location.origin +
        '/signup.html?invite=' +
        encodeURIComponent(code);

      try {

        await navigator.clipboard.writeText(
          link
        );

        showMessage(
          'Invite created and copied: ' +
          code
        );

      } catch (copyError) {

        showMessage(
          'Invite created: ' +
          link
        );
      }

      await loadMembers();

    } catch (error) {

      console.error(error);

      showMessage(
        error.message ||
        'Unable to create invite.',
        true
      );

      button.disabled = false;

    } finally {

      button.textContent =
        oldText;
    }
  }
);


/* ============================================================
   HELP REQUESTS
   ============================================================ */

async function loadHelpRequests() {

  $('helpList').innerHTML =
    '<p class="muted">Loading...</p>';

  var result =
    await supabaseClient
      .from('help_requests')
      .select(
        `
          *,
          members (
            full_name,
            email
          ),
          businesses (
            name
          )
        `
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      );

  if (result.error) {

    $('helpList').innerHTML =
      '<p class="error">' +
      escapeHtml(result.error.message) +
      '</p>';

    return;
  }

  var rows =
    result.data || [];

  if (!rows.length) {

    $('helpList').innerHTML =
      '<p class="muted">No requests yet.</p>';

    return;
  }

  $('helpList').innerHTML =
    rows.map(function (row) {

      var memberName =
        row.members &&
        row.members.full_name
          ? row.members.full_name
          : 'Member';

      return (
        '<div class="member-row">' +

          '<div class="member-main">' +

            '<div class="member-name">' +
              escapeHtml(memberName) +
            '</div>' +

            '<div class="member-meta">' +
              escapeHtml(row.status) +
            '</div>' +

            '<p style="margin:8px 0 0">' +
              escapeHtml(row.need) +
            '</p>' +

          '</div>' +

        '</div>'
      );

    }).join('');
}


/* ============================================================
   INVITES
   ============================================================ */

async function loadInvites() {

  $('inviteList').innerHTML =
    '<p class="muted">Loading...</p>';

  var result =
    await supabaseClient
      .from('invites')
      .select(
        `
          *,
          members (
            full_name,
            email
          )
        `
      )
      .order(
        'created_at',
        {
          ascending: false
        }
      );

  if (result.error) {

    $('inviteList').innerHTML =
      '<p class="error">' +
      escapeHtml(result.error.message) +
      '</p>';

    return;
  }

  var invites =
    result.data || [];

  if (!invites.length) {

    $('inviteList').innerHTML =
      '<p class="muted">No invites yet.</p>';

    return;
  }

  $('inviteList').innerHTML =
    invites.map(function (invite) {

      var memberName =
        invite.members &&
        invite.members.full_name
          ? invite.members.full_name
          : 'Member';

      var state =
        invite.revoked
          ? 'Revoked'
          : invite.redeemed_at
            ? 'Used'
            : 'Open';

      return (
        '<div class="member-row">' +

          '<div class="member-main">' +

            '<div class="member-name">' +
              escapeHtml(memberName) +
            '</div>' +

            '<div class="member-meta">' +
              escapeHtml(invite.code) +
              ' · ' +
              escapeHtml(state) +
            '</div>' +

          '</div>' +

        '</div>'
      );

    }).join('');
}


/* ============================================================
   START
   ============================================================ */

boot();
