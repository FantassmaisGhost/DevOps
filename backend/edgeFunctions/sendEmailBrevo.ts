//BEFORE YOU DO ANYTHING...

//Please change the file name to index.ts and add it to the edge functions in supabase.

//I just named it as sendEmailBrevo.ts for github distinguishing purposes.


//----------------------------------------------------------------------------------------------------

// this is the path so you know where to put this edge function:
// supabase/functions/send-email-brevo/index.ts

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, subject, html } = await req.json();

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: "2672572@students.wits.ac.za", // this is just the email account that is verifies by brevo (my student email. dont email me. im a busy guy😂)
          name: "SA HealthMap", //we can always change this later, i wasnt sure yet what we would decide to call it.
        },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});