import { createClient } from "@supabase/supabase-js";
import config from "../config.js";

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

/**
 * Retrieve a valid idMe session-cookie set for the given Telegram user.
 *
 * The Chrome Extension helper inserts rows into the `sessions` table
 * with columns:
 *   telegram_user_id  – bigint
 *   cookies           – jsonb   (Playwright-compatible cookie array)
 *   created_at        – timestamptz
 *   is_active         – boolean
 *
 * Returns the cookies array or null.
 */
export async function getSessionCookies(telegramUserId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("cookies")
    .eq("telegram_user_id", telegramUserId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.warn("[supabase] no active session for user", telegramUserId, error.message);
    return null;
  }

  return data?.cookies ?? null;
}

/**
 * Mark a session as inactive (e.g. after cookies expire).
 */
export async function deactivateSession(telegramUserId) {
  await supabase
    .from("sessions")
    .update({ is_active: false })
    .eq("telegram_user_id", telegramUserId);
}

export { supabase };
