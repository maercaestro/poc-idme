import { connectMongo } from "./db/connect.js";
import bot from "./bot/telegramBot.js";

async function main() {
  console.log("──────────────────────────────────────");
  console.log("  poc-idme  ·  starting up …");
  console.log("──────────────────────────────────────");

  await connectMongo();

  bot.start({
    onStart: (me) =>
      console.log(`[telegram] bot @${me.username} is running.`),
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
