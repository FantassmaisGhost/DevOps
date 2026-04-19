/*
import supabase from "./supabase.js";

async function loadNotifications() {

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const container = document.getElementById("notifications");

  container.innerHTML = "";

  data.forEach(n => {

    const div = document.createElement("div");

    div.style.padding = "10px";
    div.style.marginBottom = "10px";
    div.style.background = "#eee";

    div.innerText = n.message;

    container.appendChild(div);

  });

}

loadNotifications();
*/

/*
import supabase from "./supabase.js";

async function loadNotifications() {

  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const container = document.getElementById("notifications");
  container.innerHTML = "";

  data.forEach(n => {
    const div = document.createElement("div");
    div.innerText = n.message;
    container.appendChild(div);
  });

}

loadNotifications();
*/

import supabase from "./supabase.js";

async function loadNotifications() {

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  const container = document.getElementById("notifications");
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p>No notifications yet</p>";
  }

  data.forEach(n => {
    const div = document.createElement("div");
    div.classList.add("notification");
    div.innerText = n.message;
    container.appendChild(div);
  });

}

loadNotifications();