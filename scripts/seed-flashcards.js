import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FlashCard from '../models/flash-card.model.js';
import User from '../models/user.model.js';

dotenv.config();

// Sample vocabulary data for realistic flashcards
const vocabularyTopics = {
    technology: [
        { vocabulary: 'Algorithm', meaning: 'Thuật toán' },
        { vocabulary: 'Database', meaning: 'Cơ sở dữ liệu' },
        { vocabulary: 'Framework', meaning: 'Khung phát triển' },
        { vocabulary: 'Repository', meaning: 'Kho lưu trữ' },
        { vocabulary: 'Deployment', meaning: 'Triển khai' },
        { vocabulary: 'Authentication', meaning: 'Xác thực' },
        { vocabulary: 'Authorization', meaning: 'Phân quyền' },
        { vocabulary: 'Encryption', meaning: 'Mã hóa' },
        { vocabulary: 'API', meaning: 'Giao diện lập trình ứng dụng' },
        { vocabulary: 'Backend', meaning: 'Phần máy chủ' },
    ],
    business: [
        { vocabulary: 'Revenue', meaning: 'Doanh thu' },
        { vocabulary: 'Profit', meaning: 'Lợi nhuận' },
        { vocabulary: 'Investment', meaning: 'Đầu tư' },
        { vocabulary: 'Marketing', meaning: 'Tiếp thị' },
        { vocabulary: 'Strategy', meaning: 'Chiến lược' },
        { vocabulary: 'Customer', meaning: 'Khách hàng' },
        { vocabulary: 'Competitor', meaning: 'Đối thủ cạnh tranh' },
        { vocabulary: 'Target', meaning: 'Mục tiêu' },
        { vocabulary: 'Budget', meaning: 'Ngân sách' },
        { vocabulary: 'Expansion', meaning: 'Mở rộng' },
    ],
    daily: [
        { vocabulary: 'Morning', meaning: 'Buổi sáng' },
        { vocabulary: 'Afternoon', meaning: 'Buổi chiều' },
        { vocabulary: 'Evening', meaning: 'Buổi tối' },
        { vocabulary: 'Weekend', meaning: 'Cuối tuần' },
        { vocabulary: 'Holiday', meaning: 'Ngày lễ' },
        { vocabulary: 'Breakfast', meaning: 'Bữa sáng' },
        { vocabulary: 'Lunch', meaning: 'Bữa trưa' },
        { vocabulary: 'Dinner', meaning: 'Bữa tối' },
        { vocabulary: 'Exercise', meaning: 'Tập thể dục' },
        { vocabulary: 'Relax', meaning: 'Thư giãn' },
    ],
    academic: [
        { vocabulary: 'Research', meaning: 'Nghiên cứu' },
        { vocabulary: 'Thesis', meaning: 'Luận án' },
        { vocabulary: 'Hypothesis', meaning: 'Giả thuyết' },
        { vocabulary: 'Analysis', meaning: 'Phân tích' },
        { vocabulary: 'Conclusion', meaning: 'Kết luận' },
        { vocabulary: 'Reference', meaning: 'Tham khảo' },
        { vocabulary: 'Citation', meaning: 'Trích dẫn' },
        { vocabulary: 'Methodology', meaning: 'Phương pháp luận' },
        { vocabulary: 'Abstract', meaning: 'Tóm tắt' },
        { vocabulary: 'Publication', meaning: 'Xuất bản' },
    ],
    travel: [
        { vocabulary: 'Destination', meaning: 'Điểm đến' },
        { vocabulary: 'Journey', meaning: 'Hành trình' },
        { vocabulary: 'Adventure', meaning: 'Phiêu lưu' },
        { vocabulary: 'Accommodation', meaning: 'Chỗ ở' },
        { vocabulary: 'Transportation', meaning: 'Phương tiện' },
        { vocabulary: 'Sightseeing', meaning: 'Tham quan' },
        { vocabulary: 'Reservation', meaning: 'Đặt chỗ' },
        { vocabulary: 'Itinerary', meaning: 'Lịch trình' },
        { vocabulary: 'Souvenir', meaning: 'Quà lưu niệm' },
        { vocabulary: 'Departure', meaning: 'Khởi hành' },
    ],
};

const topicNames = Object.keys(vocabularyTopics);

/**
 * Generate random cards for a flashcard set
 */
function generateRandomCards(count, topicName) {
    const topic = vocabularyTopics[topicName];
    const cards = [];

    for (let i = 0; i < count; i++) {
        const randomCard = topic[Math.floor(Math.random() * topic.length)];
        cards.push({
            vocabulary: `${randomCard.vocabulary} ${i + 1}`,
            meaning: `${randomCard.meaning} ${i + 1}`,
        });
    }

    return cards;
}

/**
 * Create fake flashcards
 */
async function createFakeFlashcards() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find user "H phuc" (you need to adjust the query based on your user data)
        const username = 'hphuc'; // Change this to the actual username
        let user = await User.findOne({ username: new RegExp(username, 'i') });

        if (!user) {
            console.log('❌ User not found. Creating demo user...');
            // Create a demo user if not exists
            user = await User.create({
                fullname: 'Hoang Phuc',
                username: 'hphuc',
                password: '$2b$10$dummyhash', // dummy hash
                email: 'hphuc@example.com',
            });
            console.log('✅ Demo user created');
        }

        console.log(`✅ Found user: ${user.username} (${user._id})`);

        // Check existing flashcards count (for info only)
        const existingCount = await FlashCard.countDocuments({ user: user._id });
        console.log(`📊 Current flashcards: ${existingCount}`);

        // Always create 1,000 new flashcards each time (add to existing)
        const toCreate = 1000;
        console.log(`🚀 Creating ${toCreate} new flashcards...`);
        console.log(`📈 After completion: ${existingCount} + ${toCreate} = ${existingCount + toCreate} flashcards`);

        // Create flashcards in batches
        const batchSize = 50;
        const batches = Math.ceil(toCreate / batchSize);

        for (let batch = 0; batch < batches; batch++) {
            const flashcardsToCreate = [];
            const currentBatchSize = Math.min(batchSize, toCreate - batch * batchSize);

            for (let i = 0; i < currentBatchSize; i++) {
                // Use existingCount as offset to ensure unique names
                const globalIndex = existingCount + batch * batchSize + i;
                const topicName = topicNames[globalIndex % topicNames.length];
                const cardCount = Math.floor(Math.random() * 15) + 5; // 5-20 cards per set

                flashcardsToCreate.push({
                    name: `${topicName.charAt(0).toUpperCase() + topicName.slice(1)} Vocabulary Set ${globalIndex + 1}`,
                    cards: generateRandomCards(cardCount, topicName),
                    user: user._id,
                    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
                });
            }

            // Insert batch
            await FlashCard.insertMany(flashcardsToCreate);
            console.log(`✅ Batch ${batch + 1}/${batches} completed (${(batch + 1) * batchSize}/${toCreate})`);
        }

        const finalCount = await FlashCard.countDocuments({ user: user._id });
        console.log(`\n✅ Seed completed successfully!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 TOTAL FLASHCARDS: ${finalCount}`);
        console.log(`➕ Added this run: ${toCreate}`);
        console.log(`📈 Previous: ${existingCount} → Current: ${finalCount}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the script
createFakeFlashcards();

/*
 * Usage:
 *
 * Each run creates 1,000 new flashcards (no deletion, no limit check):
 *    node scripts/seed-flashcards.js
 *
 * Run multiple times to accumulate flashcards:
 *    1st run: 1,000 flashcards
 *    2nd run: 2,000 flashcards (1,000 + 1,000)
 *    3rd run: 3,000 flashcards (2,000 + 1,000)
 *    ...and so on
 */
