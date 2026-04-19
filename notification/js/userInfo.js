
import supabase from "./supabase.js";

async function loadUser() {
  const { data: { user } } = await supabase.auth.getUser();

  document.getElementById("welcome").innerText =
    `Welcome, ${user.email}`;
}

loadUser();


/*
import supabase from "./supabase.js";

async function loadUser() {
  const { data: { user } } = await supabase.auth.getUser();

  const username = user.user_metadata?.username || "User";

  document.getElementById("welcome").innerText =
    `Welcome, ${username}`;
}

loadUser();
*/