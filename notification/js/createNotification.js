import supabase from "./supabase.js";

export async function createNotification(userId, appointmentId, message) {

  const { error } = await supabase
    .from("notifications")
    .insert([
      {
        user_id: userId,
        appointment_id: appointmentId,
        message: message,
        is_read: false
      }
    ]);

  if (error) console.error(error);
}