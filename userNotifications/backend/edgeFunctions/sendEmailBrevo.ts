//BEFORE YOU DO ANYTHING...

//Please change the file name to index.ts and add it to the edge functions in supabase.

//I just named it as sendEmailBrevo.ts for github distinguishing purposes.

//----------------------------------------------------------------------------------------------------

// supabase/functions/send-email-brevo/index.ts

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");