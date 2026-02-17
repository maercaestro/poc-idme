import { Bot, InlineKeyboard, InputFile } from "grammy";
import config from "../config.js";
import { extractIncome } from "../services/intentExtractor.js";
import {
  fillIncomeForm,
  clickSimpan,
  closeBrowser,
} from "../services/playwrightDriver.js";
import { ProfileUpdate, AuditLog } from "../db/models.js";

const bot = new Bot(config.telegramToken);

/* ──────────────────────────────────────────────────────────
   In-memory map: pendingUpdateId → { page, context, browser }
   Keeps the browser alive while we wait for the HITL callback.
   ────────────────────────────────────────────────────────── */
const pendingSessions = new Map();

/* ──────────────────────────────────────────────────────────
   /start command
   ────────────────────────────────────────────────────────── */
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to the *idMe Income Updater* bot!\n\n" +
      "Send a message like:\n" +
      '• _"Set my income to 12000"_\n' +
      '• _"Tetapkan pendapatan saya kepada 5000"_\n\n' +
      "I will update the idMe portal for you after your confirmation.",
    { parse_mode: "Markdown" }
  );
});

/* ──────────────────────────────────────────────────────────
   /status – show the latest update for this user
   ────────────────────────────────────────────────────────── */
bot.command("status", async (ctx) => {
  const latest = await ProfileUpdate.findOne({
    telegramUserId: ctx.from.id,
  }).sort({ createdAt: -1 });

  if (!latest) return ctx.reply("No updates found.");
  await ctx.reply(
    `📄 *Latest update*\n` +
      `Income: RM ${latest.newIncome}\n` +
      `Status: \`${latest.status}\`\n` +
      `Created: ${latest.createdAt.toISOString()}`,
    { parse_mode: "Markdown" }
  );
});

/* ──────────────────────────────────────────────────────────
   Natural-language message handler
   ────────────────────────────────────────────────────────── */
bot.on("message:text", async (ctx) => {
  const userMsg = ctx.message.text;
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  // 1. Extract intent via GPT-4o
  await ctx.reply("🔍 Analysing your message…");
  const { intent, new_income } = await extractIncome(userMsg);

  if (intent !== "update_income" || new_income == null) {
    return ctx.reply(
      "Sorry, I couldn't extract an income value from your message. " +
        'Try something like: _"Set my income to 8000"_',
      { parse_mode: "Markdown" }
    );
  }

  // 2. Create PENDING record in MongoDB
  const record = await ProfileUpdate.create({
    telegramUserId: userId,
    telegramChatId: chatId,
    newIncome: new_income,
    status: "PENDING",
  });

  await ctx.reply(`💰 Got it — new income: *RM ${new_income}*\n⏳ Launching browser…`, {
    parse_mode: "Markdown",
  });

  // 3. Drive Playwright
  try {
    const { previousIncome, screenshotBase64, page, context, browser } =
      await fillIncomeForm({
        telegramUserId: userId,
        newIncome: new_income,
      });

    // Update record with previous income
    record.previousIncome = previousIncome;
    record.screenshotBase64 = screenshotBase64;
    record.status = "SCREENSHOT_SENT";
    await record.save();

    // 4. Send screenshot + HITL inline buttons
    const imgBuffer = Buffer.from(screenshotBase64, "base64");
    const keyboard = new InlineKeyboard()
      .text("🚀 Confirm Update", `confirm:${record._id}`)
      .text("❌ Cancel", `cancel:${record._id}`);

    const sentMsg = await ctx.replyWithPhoto(new InputFile(imgBuffer, "preview.png"), {
      caption:
        `📸 *Pre-save preview*\n` +
        `Previous income: RM ${previousIncome ?? "N/A"}\n` +
        `New income: RM ${new_income}\n\n` +
        `Please confirm or cancel.`,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    record.confirmationMsgId = sentMsg.message_id;
    await record.save();

    // Keep browser alive for callback
    pendingSessions.set(record._id.toString(), { page, context, browser });

    // Auto-cancel after 5 minutes to avoid dangling browsers
    setTimeout(async () => {
      if (pendingSessions.has(record._id.toString())) {
        pendingSessions.delete(record._id.toString());
        await closeBrowser(browser);
        if (record.status === "SCREENSHOT_SENT") {
          record.status = "CANCELLED";
          record.errorMessage = "Timed out waiting for confirmation.";
          await record.save();
        }
      }
    }, 5 * 60 * 1000);
  } catch (err) {
    record.status = "FAILED";
    record.errorMessage = err.message;
    await record.save();
    console.error("[bot] playwright error:", err);
    await ctx.reply(`❌ Failed: ${err.message}`);
  }
});

/* ──────────────────────────────────────────────────────────
   Callback query handler (HITL confirm / cancel)
   ────────────────────────────────────────────────────────── */
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data; // "confirm:<id>" or "cancel:<id>"
  const [action, recordId] = data.split(":");

  const record = await ProfileUpdate.findById(recordId);
  if (!record) return ctx.answerCallbackQuery("Record not found.");

  const session = pendingSessions.get(recordId);

  if (action === "confirm") {
    await ctx.answerCallbackQuery("Confirming…");

    if (!session) {
      record.status = "FAILED";
      record.errorMessage = "Browser session expired.";
      await record.save();
      return ctx.editMessageCaption({
        caption: "❌ Browser session expired. Please try again.",
      });
    }

    try {
      await clickSimpan(session.page);
      record.status = "SUCCESS";
      record.actualIncome = record.newIncome;
      await record.save();

      // Write audit log
      await AuditLog.create({
        profileUpdateId: record._id,
        telegramUserId: record.telegramUserId,
        field: "Pendapatan",
        beforeValue: record.previousIncome,
        afterValue: record.newIncome,
        status: "SUCCESS",
      });

      await ctx.editMessageCaption({
        caption:
          `✅ *Update successful!*\n` +
          `Income changed: RM ${record.previousIncome ?? "N/A"} → RM ${record.newIncome}`,
        parse_mode: "Markdown",
      });
    } catch (err) {
      record.status = "FAILED";
      record.errorMessage = err.message;
      await record.save();
      await ctx.editMessageCaption({ caption: `❌ Save failed: ${err.message}` });
    } finally {
      pendingSessions.delete(recordId);
      await closeBrowser(session.browser);
    }
  } else if (action === "cancel") {
    await ctx.answerCallbackQuery("Cancelled.");

    record.status = "CANCELLED";
    await record.save();

    // Write audit log for cancellation
    await AuditLog.create({
      profileUpdateId: record._id,
      telegramUserId: record.telegramUserId,
      field: "Pendapatan",
      beforeValue: record.previousIncome,
      afterValue: null,
      status: "CANCELLED",
    });

    await ctx.editMessageCaption({ caption: "❌ Update cancelled by user." });

    if (session) {
      pendingSessions.delete(recordId);
      await closeBrowser(session.browser);
    }
  }
});

/* ──────────────────────────────────────────────────────────
   Error handler
   ────────────────────────────────────────────────────────── */
bot.catch((err) => {
  console.error("[bot] unhandled error:", err);
});

export default bot;
