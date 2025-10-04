import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FlashCard from '../models/flash-card.model.js';
import User from '../models/user.model.js';

dotenv.config();

/**
 * Clear all flashcards for user hphuc
 */
async function clearFlashcards() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find user "hphuc"
        const username = 'hphuc';
        const user = await User.findOne({ username: new RegExp(username, 'i') });

        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log(`✅ Found user: ${user.username} (${user._id})`);

        // Count existing flashcards
        const existingCount = await FlashCard.countDocuments({ user: user._id });
        console.log(`📊 Current flashcards: ${existingCount}`);

        if (existingCount === 0) {
            console.log('ℹ️  No flashcards to delete');
            return;
        }

        // Ask for confirmation
        console.log(`\n⚠️  WARNING: This will delete ${existingCount} flashcards!`);
        console.log('🗑️  Deleting flashcards...');

        // Delete all flashcards for this user
        const result = await FlashCard.deleteMany({ user: user._id });

        console.log(`\n✅ Successfully deleted ${result.deletedCount} flashcards`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 TOTAL FLASHCARDS: 0`);
        console.log(`🗑️  Deleted: ${result.deletedCount}`);
        console.log(`📈 Previous: ${existingCount} → Current: 0`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the script
clearFlashcards();
