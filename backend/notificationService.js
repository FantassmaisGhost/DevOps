// notificationService.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://ixikhufrylaugpdxokwu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4aWtodWZyeWxhdWdwZHhva3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTQ0NTIsImV4cCI6MjA5MTIzMDQ1Mn0.F7g_bNWAsxjWtkHihVNYPicghiKOisgHGV9-zaBjXvQ'

export const sb = createClient(supabaseUrl, supabaseKey)

/**
 * Send an email notification
 */
export async function sendEmailNotification(email, subject, htmlContent) {
  console.log("Sending email to:", email);

  try {
    const response = await fetch(
      "https://ixikhufrylaugpdxokwu.functions.supabase.co/send-email-brevo",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          subject,
          html: htmlContent
        })
      }
    );

    console.log("Status:", response.status);

    let result;
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    console.log("Response:", result);

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
 * Create DB notification
 */
export async function createDatabaseNotification(userId, appointmentId, message, type = 'appointment') {
  try {
    const { error } = await sb
      .from("notifications")
      .insert([{
        user_id: userId,
        appointment_id: appointmentId,
        message,
        type,
        is_read: false
      }]);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Get notifications
 */
export async function getUserNotifications(userId) {
  try {
    const { data, error } = await sb
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Mark one as read
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Mark all as read
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId) {
  try {
    const { error } = await sb
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.error(error);
      return false;
    }

    return true;

  } catch (error) {
    console.error(error);
    return false;
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(userId) {
  try {
    const { count, error } = await sb
      .from("notifications")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error(error);
      return 0;
    }

    return count || 0;

  } catch (error) {
    console.error(error);
    return 0;
  }
}