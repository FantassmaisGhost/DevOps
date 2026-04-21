// notificationService.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const SUPABASE_URL = "https://ixikhufrylaugpdxokwu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Send an email notification using Supabase Edge Function
 */
export async function sendEmailNotification(email, subject, htmlContent) {
  console.log("Attempting to send email to:", email);
  
  try {
    const response = await fetch("https://ixikhufrylaugpdxokwu.functions.supabase.co/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ 
        email, 
        subject, 
        html: htmlContent 
      })
    });

    console.log("Email response status:", response.status);
    const result = await response.json();
    console.log("Email API response:", result);
    
    if (!response.ok) {
      console.error("Email failed:", result.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

/**
 * Create an in-app notification in the database
 */
export async function createDatabaseNotification(userId, appointmentId, message, type = 'appointment') {
  try {
    const { error } = await sb
      .from("notifications")
      .insert([{
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

/**
 * Get all notifications for a specific user
 */
export async function getUserNotifications(userId) {
  try {
    const { data, error } = await sb
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

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

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

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

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

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

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
  try {
    const { error } = await sb
      .from("notifications")
      .delete()
      .eq("id", notificationId);

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

/**
 * Get unread count for a user
 */
export async function getUnreadCount(userId) {
  try {
    const { count, error } = await sb
      .from("notifications")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

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
