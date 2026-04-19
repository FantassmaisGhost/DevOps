import supabase from "./supabase.js";

async function loadAppointments() {

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  const container = document.getElementById("appointments");
  container.innerHTML = "";

  data.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("appointment");

    div.innerHTML = `
      <span>${new Date(a.appointment_time).toLocaleString()}</span>
      <span class="badge ${a.status}">${a.status}</span>
    `;

    container.appendChild(div);
  });

}

loadAppointments();