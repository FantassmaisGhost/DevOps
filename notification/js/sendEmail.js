export async function sendEmail(email, message) {

  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ";

  const res = await fetch("https://ixikhufrylaugpdxokwu.functions.supabase.co/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ email, message })
  });

  const data = await res.json();
  console.log("Email response:", data);
}

/*
export async function sendEmail(email, message) {

  const res = await fetch("https://eegqpjzoaslfkospimjy.functions.supabase.co/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, message })
  });

  const data = await res.json();
  console.log("Email response:", data);

}
*/

/*
import { SUPABASE_KEY } from "./supabase.js";
 
export async function sendEmail(email, message) {
 
  const res = await fetch("https://eegqpjzoaslfkospimjy.supabase.co/functions/v1/notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_KEY}`
    },
    body: JSON.stringify({ email, message })
  });
 
  const data = await res.json();
  console.log("Email response:", data);
 
}
  */