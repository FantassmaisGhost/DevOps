import supabaseClient from "./supabase.js";

const urlParams = new URLSearchParams(window.location.search);
const appointmentId = urlParams.get("id");

console.log("Appointment ID:", appointmentId);

async function loadAppointment() {
    if (!appointmentId) {
        alert("No appointment ID in URL");
        return;
    }

    const { data, error } = await supabaseClient
        .from("appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();

    console.log("Data:", data);
    console.log("Error:", error);

    if (error) {
        alert("Error loading appointment");
        return;
    }

    if (!data) {
        alert("No appointment found");
        return;
    }

    const dateObj = new Date(data.appointment_time);

    document.getElementById("date").textContent =
        dateObj.toLocaleDateString();

    document.getElementById("time").textContent =
        dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    document.getElementById("clinic").textContent = data.ClinicID;
    document.getElementById("reason").textContent = data.reason;
}

loadAppointment();

document.getElementById("cancelBtn").addEventListener("click", async () => {
    const confirmDelete = confirm("Are you sure you want to cancel this appointment?");

    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from("appointments")
        .delete()
        .eq("id", appointmentId);

    if (error) {
        console.error(error);
        alert("Failed to cancel appointment");
        return;
    }

    alert("Appointment cancelled successfully");

    // Redirect after deletion
    window.location.href = "index.html"; // or homepage
});