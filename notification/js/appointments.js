import supabase from "./supabase.js";

async function loadAppointments() {

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("Appointments") // ✅ IMPORTANT
    .select("*")
    .eq("PatientID", user.id)
    .order("appointment_date", { ascending: false });

  if (error) return console.error(error);

  const container = document.getElementById("appointments");
  container.innerHTML = "";

  data.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("appointment");

    div.innerHTML = `
      <span>${a.appointment_date} ${a.appointment_time}</span>
      <span class="badge ${a.status}">${a.status}</span>
    `;

    container.appendChild(div);
  });

}

loadAppointments();
