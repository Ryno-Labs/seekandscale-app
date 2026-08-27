/* Static offer/catalog copy. Live members, posts and vouches come from Supabase. */

var SVC = [
  {t:'You did the job. They still haven\'t paid.',
   said:'"I did the job. I still haven\'t been paid."', owed:true,
   kitKey:'get_paid', kit:'Get Paid Kit', hrs:10, fixN:'Get Paid', fixP:1400, fixT:'target: 3 weeks',
   li:['List every unpaid invoice oldest first','Use a clear follow-up cadence','Make the awkward phone call','Put a deposit rule and terms on future quotes'],
   note:'Everything can go out under your business name, email and phone.'},
  {t:'You have 4 reviews. The other guy has 80.',
   said:'"People look me up, see nothing, and call somebody else."',
   kitKey:'review', kit:'Review Kit', hrs:12, fixN:'Review Sprint', fixP:1500, fixT:'target: 30 days',
   li:['Pull your recent customer list','Write the ask in your voice','Follow up with the quiet ones','Keep the system when the sprint is over']},
  {t:'Your website is embarrassing you.',
   said:'"It\'s old and it is costing me trust."',
   kitKey:'website', kit:'Website Leak Check', hrs:20, fixN:'Website Fix', fixP:2500, fixT:'target: 3 weeks',
   li:['Score the pages that matter','Rewrite the words so they sound human','Fix the highest-impact problems','Make sure the site works on a phone']}
];

var KITS = [
  {key:'get_paid', name:'Get Paid Kit', desc:'Every message, in order, to go collect what you are owed'},
  {key:'review', name:'Review Kit', desc:'The ask, the follow-up, and who to send it to'},
  {key:'website', name:'Website Leak Check', desc:'Score your own site and find the leaks'},
  {key:'pricing', name:'Price Rebuild Kit', desc:'Find out what you should actually be charging'},
  {key:'first_hire', name:'First Hire Kit', desc:'Job post, interview questions, and the first 90 days'},
  {key:'missed_call', name:'Missed Call Kit', desc:'Build a simple system so missed calls get followed up'}
];

var FORUM_TYPES = {thought:'Thought', request:'Request', giveaway:'Giveaway', shoutout:'Shout-out'};
var FORUM_ORDER = ['thought','request','giveaway','shoutout'];
