import mongoose from "mongoose";
import User from "../models/user.model.js";

const flashCardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    cards: [
        {
            vocabulary: {
                type: String,
                required: true,
            },
            meaning: {
                type: String,
                required: true,
            },
        }
    ],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: User,
        required: true,
    }
}, { timestamps: true });

// ==================== INDEXES ====================
// Text index cho tìm kiếm full-text trên name
flashCardSchema.index({ name: 'text' });

// Compound index cho user + createdAt (dùng cho pagination)
flashCardSchema.index({ user: 1, createdAt: -1 });

// Index cho user để query nhanh
flashCardSchema.index({ user: 1 });

// Compound index cho search của người khác
flashCardSchema.index({ user: 1, name: 1 });

const FlashCard = mongoose.model("FlashCard", flashCardSchema);
export default FlashCard;