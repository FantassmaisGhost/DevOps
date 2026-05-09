// notificationService.js
import { supabase, supabaseAnonKey } from './supabase.js';

export class NotificationService {
  static async sendEmailNotification(email, subject, htmlContent) {
    console.log("Attempting to send email to:", email);
    try {
      const response = await fetch("https://ixikhufrylaugpdxokwu.functions.supabase.co/send-email-brevo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ email, subject, html: htmlContent })
      });
      if (!response.ok) return false;
      return true;
    } catch (error) {
      console.error("Error sending email:", error);
      return false;
    }
  }

  static async createDatabaseNotification(userId, appointmentId, message, type = 'appointment') {
    try {
      const { error } = await supabase.from("notifications").insert([{
        user_id: userId,
        appointment_id: appointmentId,
        message: message,
        type: type,
        is_read: false
      }]);
      if (error) {
        console.error("Error creating notification:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error in createDatabaseNotification:", error);
      return false;
    }
  }

  static async getUserNotifications(userId) {
    try {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) {
        console.error("Error loading notifications:", error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error("Error in getUserNotifications:", error);
      return [];
    }
  }

  static async markNotificationAsRead(notificationId) {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
      if (error) {
        console.error("Error marking notification as read:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error in markNotificationAsRead:", error);
      return false;
    }
  }

  static async markAllNotificationsAsRead(userId) {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
      if (error) {
        console.error("Error marking all notifications as read:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error in markAllNotificationsAsRead:", error);
      return false;
    }
  }

  static async deleteNotification(notificationId) {
    try {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
      if (error) {
        console.error("Error deleting notification:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error in deleteNotification:", error);
      return false;
    }
  }

  static async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase.from("notifications").select("*", { count: 'exact', head: true }).eq("user_id", userId).eq("is_read", false);
      if (error) {
        console.error("Error getting unread count:", error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.error("Error in getUnreadCount:", error);
      return 0;
    }
  }
}

// ===== Named exports for backward compatibility =====
export const sendEmailNotification = NotificationService.sendEmailNotification;
export const createDatabaseNotification = NotificationService.createDatabaseNotification;
export const getUserNotifications = NotificationService.getUserNotifications;
export const markNotificationAsRead = NotificationService.markNotificationAsRead;
export const markAllNotificationsAsRead = NotificationService.markAllNotificationsAsRead;
export const deleteNotification = NotificationService.deleteNotification;
export const getUnreadCount = NotificationService.getUnreadCount;