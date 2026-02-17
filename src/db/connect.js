import mongoose from "mongoose";
import config from "../config.js";

let connected = false;

export async function connectMongo() {
  if (connected) return;
  await mongoose.connect(config.mongoUri);
  connected = true;
  console.log("[mongo] connected →", config.mongoUri);
}
