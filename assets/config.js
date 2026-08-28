/* Seek & Scale public browser configuration.
   The Supabase anon key is safe to expose. Never put the service_role key here. */

var SUPABASE_URL      = 'https://namobzvysdqgwethbohb.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_cXNGKNsBnmMLQigi6eViHQ_Y_jOoKUe';

/* Optional membership checkout. If left as the placeholder, Join falls back to email. */
var STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/YOUR-LINK';

var SITE_CONTACT_EMAIL = 'ryan@seekandscale.com';
var SITE_CONTACT_PHONE = '(512) 931-1752';

/* Optional digital-product checkout links. Blank = route the request through Help Desk/email. */
var KIT_PUBLIC_LINKS = {
  get_paid: '', review: '', website: '', pricing: '', first_hire: '', missed_call: ''
};
var KIT_MEMBER_LINKS = {
  get_paid: '', review: '', website: '', pricing: '', first_hire: '', missed_call: ''
};

var sb = null;
function initSupabase(){
  if(!sb && window.supabase){
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
  }
  return sb;
}

function configReady(){
  return SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1 &&
         SUPABASE_ANON_KEY.indexOf('YOUR-ANON-KEY') === -1;
}
