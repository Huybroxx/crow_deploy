import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FlashCard from '../models/flash-card.model.js';
import redisCache from '../utils/redis.js';
import flashCardCache from '../utils/flashcard-cache.js';

dotenv.config();

/**
 * Performance test script
 */
async function performanceTest() {
    try {
        // Connect to MongoDB and Redis
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        await redisCache.connect();
        console.log('✅ Connected to Redis');

        // Find a test user
        const testUser = await mongoose.model('User').findOne();
        if (!testUser) {
            console.log('❌ No user found. Please create a user first.');
            return;
        }

        console.log(`\n🧪 Testing with user: ${testUser.username}`);
        console.log('═'.repeat(60));

        // Clear cache to start fresh
        await flashCardCache.clearAllFlashcardCache();
        console.log('🧹 Cache cleared\n');

        // Test 1: Get flashcard detail (without cache)
        console.log('📊 Test 1: Get flashcard detail');
        console.log('─'.repeat(60));

        const sampleFlashcard = await FlashCard.findOne().lean();
        if (!sampleFlashcard) {
            console.log('❌ No flashcards found. Run seed script first.');
            return;
        }

        const flashcardId = sampleFlashcard._id.toString();

        // Without cache
        const start1 = Date.now();
        const flashcard1 = await FlashCard.findById(flashcardId).populate('user', 'username avatar').lean();
        const time1 = Date.now() - start1;
        console.log(`⏱️  DB Query (no cache): ${time1}ms`);

        // Cache it
        await flashCardCache.setFlashcard(flashcardId, flashcard1);

        // With cache
        const start2 = Date.now();
        const flashcard2 = await flashCardCache.getFlashcard(flashcardId);
        const time2 = Date.now() - start2;
        console.log(`⚡ Cache Query: ${time2}ms`);
        console.log(`🚀 Improvement: ${(time1 / time2).toFixed(2)}x faster\n`);

        // Test 2: List user's flashcards with pagination
        console.log('📊 Test 2: List user flashcards (pagination)');
        console.log('─'.repeat(60));

        const page = 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Without cache
        const start3 = Date.now();
        const result1 = await FlashCard.find({ user: { $ne: testUser._id } })
            .populate('user', 'username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        const time3 = Date.now() - start3;
        console.log(`⏱️  DB Query (no cache): ${time3}ms`);

        // Cache it
        const dataToCache = {
            flashcards: result1,
            totalCards: await FlashCard.countDocuments({ user: { $ne: testUser._id } }),
            totalPages: 10,
        };
        await flashCardCache.setOthersFlashcards(testUser._id, page, limit, '', dataToCache);

        // With cache
        const start4 = Date.now();
        const result2 = await flashCardCache.getOthersFlashcards(testUser._id, page, limit, '');
        const time4 = Date.now() - start4;
        console.log(`⚡ Cache Query: ${time4}ms`);
        console.log(`🚀 Improvement: ${(time3 / time4).toFixed(2)}x faster\n`);

        // Test 3: Search with text index
        console.log('📊 Test 3: Search flashcards (text index)');
        console.log('─'.repeat(60));

        const searchQuery = 'technology';

        // With regex (old way)
        const start5 = Date.now();
        const result3 = await FlashCard.find({
            user: { $ne: testUser._id },
            name: { $regex: searchQuery, $options: 'i' }
        })
            .populate('user', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const time5 = Date.now() - start5;
        console.log(`⏱️  Regex Search: ${time5}ms`);

        // With text index (new way)
        const start6 = Date.now();
        const result4 = await FlashCard.find({
            user: { $ne: testUser._id },
            $text: { $search: searchQuery }
        })
            .populate('user', 'username avatar')
            .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
            .limit(limit)
            .lean();
        const time6 = Date.now() - start6;
        console.log(`⚡ Text Index Search: ${time6}ms`);
        console.log(`🚀 Improvement: ${(time5 / time6).toFixed(2)}x faster\n`);

        // Cache the search result
        const searchData = {
            flashcards: result4,
            totalCards: await FlashCard.countDocuments({
                user: { $ne: testUser._id },
                $text: { $search: searchQuery }
            }),
            totalPages: 5,
        };
        await flashCardCache.setOthersFlashcards(testUser._id, page, limit, searchQuery, searchData);

        // With cache
        const start7 = Date.now();
        const result5 = await flashCardCache.getOthersFlashcards(testUser._id, page, limit, searchQuery);
        const time7 = Date.now() - start7;
        console.log(`⚡ Cached Search: ${time7}ms`);
        console.log(`🚀 vs Regex: ${(time5 / time7).toFixed(2)}x faster`);
        console.log(`🚀 vs Text Index: ${(time6 / time7).toFixed(2)}x faster\n`);

        // Test 4: Count queries
        console.log('📊 Test 4: Count operations');
        console.log('─'.repeat(60));

        // Without index
        const start8 = Date.now();
        const count1 = await FlashCard.countDocuments({ user: testUser._id });
        const time8 = Date.now() - start8;
        console.log(`⏱️  Count (indexed field): ${time8}ms - Result: ${count1}`);

        // Search count
        const start9 = Date.now();
        const count2 = await FlashCard.countDocuments({
            user: { $ne: testUser._id },
            $text: { $search: searchQuery }
        });
        const time9 = Date.now() - start9;
        console.log(`⏱️  Count with text search: ${time9}ms - Result: ${count2}\n`);

        // Summary
        console.log('═'.repeat(60));
        console.log('📈 PERFORMANCE SUMMARY');
        console.log('═'.repeat(60));
        console.log(`✅ Detail Query: ${time1}ms → ${time2}ms (${(time1 / time2).toFixed(1)}x faster)`);
        console.log(`✅ List Query: ${time3}ms → ${time4}ms (${(time3 / time4).toFixed(1)}x faster)`);
        console.log(`✅ Search Query: ${time5}ms → ${time6}ms → ${time7}ms (${(time5 / time7).toFixed(1)}x faster with cache)`);
        console.log('═'.repeat(60));

        // Cache stats
        const stats = await flashCardCache.getCacheStats();
        console.log('\n📊 Redis Stats:');
        console.log(stats);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        await redisCache.disconnect();
        console.log('\n👋 Disconnected');
    }
}

// Run the test
performanceTest();
