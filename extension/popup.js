/* eslint-env browser, webextensions */

const $ = (sel) => document.querySelector(sel);

// Persist settings
const KEYS = ["supabaseUrl", "supabaseKey", "telegramUserId"];

document.addEventListener("DOMContentLoaded", () => {
  // Restore saved values
  chrome.storage.local.get(KEYS, (items) => {
    for (const k of KEYS) {
      if (items[k]) $(` #${k}`).value = items[k];
    }
  });
});

$("#syncBtn").addEventListener("click", async () => {
  const status = $("#status");
  status.textContent = "⏳ Reading cookies…";

  const supabaseUrl = $("#supabaseUrl").value.trim();
  const supabaseKey = $("#supabaseKey").value.trim();
  const telegramUserId = Number($("#telegramUserId").value.trim());

  if (!supabaseUrl || !supabaseKey || !telegramUserId) {
    status.textContent = "❌ Please fill in all fields.";
    return;
  }

  // Save settings for next time
  chrome.storage.local.set({ supabaseUrl, supabaseKey, telegramUserId });

  try {
    // 1. Read all cookies for idme.moe.gov.my
    const cookies = await chrome.cookies.getAll({ domain: "idme.moe.gov.my" });

    if (!cookies.length) {
      status.textContent = "❌ No idMe cookies found. Are you logged in?";
      return;
    }

    // Convert to Playwright-compatible format
    const playwrightCookies = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite === "unspecified" ? "Lax" : c.sameSite,
      expires: c.expirationDate ? Math.floor(c.expirationDate) : -1,
    }));

    // 2. Deactivate previous sessions for this user
    status.textContent = "⏳ Deactivating old sessions…";
    await supabaseRpc(supabaseUrl, supabaseKey, "PATCH", "/rest/v1/sessions", {
      filter: `telegram_user_id=eq.${telegramUserId}&is_active=eq.true`,
      body: { is_active: false },
    });

    // 3. Insert new session row
    status.textContent = "⏳ Uploading cookies…";
    await supabaseFetch(supabaseUrl, supabaseKey, "POST", "/rest/v1/sessions", {
      telegram_user_id: telegramUserId,
      cookies: playwrightCookies,
      is_active: true,
    });

    status.textContent = `✅ Synced ${playwrightCookies.length} cookies!`;
  } catch (err) {
    status.textContent = `❌ ${err.message}`;
    console.error(err);
  }
});

/* ── tiny Supabase REST helpers ─────────────────────────── */

async function supabaseFetch(url, key, method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status}`);
  return res;
}

async function supabaseRpc(url, key, method, path, { filter, body }) {
  const res = await fetch(`${url}${path}?${filter}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  // 404 / no rows is fine
  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase ${method} ${path}: ${res.status}`);
  }
  return res;
}
