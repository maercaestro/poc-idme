import "dotenv/config";

const config = {
  // Telegram
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,

  // OpenAI
  openaiKey: process.env.OPENAI_API_KEY,

  // MongoDB
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/poc_idme",

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,

  // Playwright / idMe
  headless: process.env.HEADLESS !== "false",
  idmeBaseUrl: process.env.IDME_BASE_URL || "https://idme.moe.gov.my",
};

export default config;
