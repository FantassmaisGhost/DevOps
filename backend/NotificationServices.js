import { supabase } from './supabase.js';

class NotificationServices {
  static async sendEmailNotification(email, subject, htmlContent) {
    const response = await fetch("https://ixikhufrylaugpdxokwu.functions.supabase.co/send-email-brevo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email, subject, html: htmlContent })
    });
    return response.ok;
  }

  static async createDatabaseNotification(userId, appointmentId, message, type = 'appointment') {
    const { error } = await supabase.from("notifications").insert([{
      user_id: userId,
      appointment_id: appointmentId,
      message: message,
      type: type,
      is_read: false
    }]);
    return !error;
  }

  static async getUserNotifications(userId) {
    const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return data || [];
  }

  static async markNotificationAsRead(notificationId) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    return !error;
  }

  static async markAllNotificationsAsRead(userId) {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    return !error;
  }

  static async deleteNotification(notificationId) {
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
    return !error;
  }

  static async getUnreadCount(userId) {
    const { count, error } = await supabase.from("notifications").select("*", { count: 'exact', head: true }).eq("user_id", userId).eq("is_read", false);
    return count || 0;
  }
}