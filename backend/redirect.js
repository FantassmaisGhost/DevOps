import { supabase } from '../backend/supabase.js';

console.log('=== REDIRECT.JS LOADED ===');
console.log('Full URL:', window.location.href);
console.log('Hash:', window.location.hash);
console.log('Search:', window.location.search);

// Check immediate session
const { data: { session: immediateSession } } = await supabase.auth.getSession();
console.log('Immediate session:', immediateSession ? 'EXISTS' : 'NULL');

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  console.log('Session in event:', session ? 'EXISTS' : 'NULL');
  if (session) {
    console.log('User email:', session.user.email);
  }
});

setTimeout(() => {
  console.log('=== 3 SECOND CHECK ===');
  supabase.auth.getSession().then(({ data: { session } }) => {
    console.log('Session after 3s:', session ? 'EXISTS' : 'NULL');
  });
}, 3000);