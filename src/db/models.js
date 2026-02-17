import mongoose from "mongoose";

/* ─────────────────────────────────────────────
   ProfileUpdate – tracks every income-change request
   ───────────────────────────────────────────── */
const profileUpdateSchema = new mongoose.Schema(
  {
    telegramUserId: { type: Number, required: true, index: true },
    telegramChatId: { type: Number, required: true },

    // Extracted by GPT-4o
    newIncome: { type: Number, required: true },

    // Audit trail
    previousIncome: { type: Number, default: null },
    actualIncome: { type: Number, default: null }, // value after Simpan

    status: {
      type: String,
      enum: [
        "PENDING",        // awaiting Playwright execution
        "SCREENSHOT_SENT", // screenshot sent to user for confirmation
        "CONFIRMED",       // user pressed Confirm
        "CANCELLED",       // user pressed Cancel
        "SUCCESS",         // Simpan completed
        "FAILED",          // something went wrong
      ],
      default: "PENDING",
    },

    screenshotBase64: { type: String, default: null },
    errorMessage: { type: String, default: null },

    // Inline-keyboard message id (so we can edit it later)
    confirmationMsgId: { type: Number, default: null },
  },
  { timestamps: true }
);

export const ProfileUpdate = mongoose.model(
  "ProfileUpdate",
  profileUpdateSchema,
  "profile_updates" // explicit collection name
);

/* ─────────────────────────────────────────────
   AuditLog – immutable log of every field change
   ───────────────────────────────────────────── */
const auditLogSchema = new mongoose.Schema(
  {
    profileUpdateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfileUpdate",
      required: true,
    },
    telegramUserId: { type: Number, required: true },
    field: { type: String, default: "Pendapatan" },
    beforeValue: { type: mongoose.Schema.Types.Mixed },
    afterValue: { type: mongoose.Schema.Types.Mixed },
    status: { type: String }, // mirrors final status
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model("AuditLog", auditLogSchema, "audit_logs");
