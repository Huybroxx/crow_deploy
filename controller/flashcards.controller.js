
import User from '../models/user.model.js';
import FlashCard from '../models/flash-card.model.js';
import flashCardCache from '../utils/flashcard-cache.js';

//flashcards
export const getflashcards = async (req, res) => {
    try {
        const user = res.locals.user;

        // Lấy flashcards của mình với pagination
        const myPage = parseInt(req.query.myPage) || 1;
        const myLimit = 9;
        const mySkip = (myPage - 1) * myLimit;

        // Try to get from cache first
        const myCacheKey = `my_flashcards:${user._id}:page_${myPage}:limit_${myLimit}`;
        let myFlashCardSets = await flashCardCache.getMyFlashcards(user._id, myPage, myLimit);
        let totalMyCards, totalMyPages;

        if (!myFlashCardSets) {
            console.log('🔍 Cache MISS - Loading my flashcards from DB');
            totalMyCards = await FlashCard.countDocuments({ user: user._id });
            totalMyPages = Math.ceil(totalMyCards / myLimit);

            myFlashCardSets = await FlashCard.find({ user: user._id })
                .sort({ createdAt: -1 })
                .skip(mySkip)
                .limit(myLimit)
                .lean(); // Convert to plain JS objects for better caching

            // Cache the results with pagination info
            const myData = {
                flashcards: myFlashCardSets,
                totalCards: totalMyCards,
                totalPages: totalMyPages,
            };
            await flashCardCache.setMyFlashcards(user._id, myPage, myLimit, myData);
        } else {
            console.log('✅ Cache HIT - My flashcards');
            totalMyCards = myFlashCardSets.totalCards;
            totalMyPages = myFlashCardSets.totalPages;
            myFlashCardSets = myFlashCardSets.flashcards;
        }

        // Lấy flashcards của người khác với pagination và search
        const othersPage = parseInt(req.query.othersPage) || 1;
        const othersLimit = 10; // Giảm xuống 9 để giao diện đẹp hơn (3x3 grid)
        const othersSkip = (othersPage - 1) * othersLimit;
        const searchQuery = req.query.search || '';

        // Try to get from cache
        let othersFlashCardSets = await flashCardCache.getOthersFlashcards(
            user._id,
            othersPage,
            othersLimit,
            searchQuery
        );
        let totalOthersCards, totalOthersPages;

        if (!othersFlashCardSets) {
            console.log('🔍 Cache MISS - Loading others flashcards from DB');

            // Build query cho flashcards người khác
            let othersQuery = { user: { $ne: user._id } };

            // Sử dụng regex search thay vì text index để tránh lỗi
            if (searchQuery) {
                othersQuery.name = { $regex: searchQuery, $options: 'i' };
            }

            totalOthersCards = await FlashCard.countDocuments(othersQuery);
            totalOthersPages = Math.ceil(totalOthersCards / othersLimit);

            const queryBuilder = FlashCard.find(othersQuery)
                .populate('user', 'username avatar')
                .skip(othersSkip)
                .limit(othersLimit)
                .lean();

            // Sort by date
            queryBuilder.sort({ createdAt: -1 });

            othersFlashCardSets = await queryBuilder;

            // Cache the results
            const othersData = {
                flashcards: othersFlashCardSets,
                totalCards: totalOthersCards,
                totalPages: totalOthersPages,
            };
            await flashCardCache.setOthersFlashcards(
                user._id,
                othersPage,
                othersLimit,
                searchQuery,
                othersData
            );
        } else {
            console.log('✅ Cache HIT - Others flashcards');
            totalOthersCards = othersFlashCardSets.totalCards;
            totalOthersPages = othersFlashCardSets.totalPages;
            othersFlashCardSets = othersFlashCardSets.flashcards;
        }

        res.render('./page/flashcards/index', {
            title: 'Thẻ học tập',
            myFlashCardSets,
            myCurrentPage: myPage,
            myTotalPages: totalMyPages,
            myHasMore: myPage < totalMyPages,
            othersFlashCardSets,
            othersCurrentPage: othersPage,
            othersTotalPages: totalOthersPages,
            othersHasNextPage: othersPage < totalOthersPages,
            othersHasPrevPage: othersPage > 1,
            searchQuery,
        });
    } catch (error) {
        console.error('Error in getflashcards:', error);
        req.flash('error', 'Có lỗi khi tải danh sách thẻ!');
        res.redirect('/');
    }
}
//thêm thẻ
export const newCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const id = req.params.id;
        const { vocabulary, meaning } = req.body;
        const flashCard = await FlashCard.findOne({ _id: id, user: user._id });
        if (!flashCard) {
            throw new Error('Không tìm thấy bộ thẻ!');
        }
        flashCard.cards.push({ vocabulary, meaning });
        await flashCard.save();

        // Invalidate cache
        await flashCardCache.invalidateFlashcardUpdate(id, user._id);

        req.flash('success', 'Thêm thẻ thành công!');
        return res.status(200).json({ message: 'Thêm thẻ thành công!' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
//thẻ học tập chi tiết
export const getflashcardDetail = async (req, res) => {
    try {
        const user = res.locals.user;
        const cardId = req.params.id;

        // Try to get from cache first
        let flashCard = await flashCardCache.getFlashcard(cardId);

        if (!flashCard) {
            console.log('🔍 Cache MISS - Loading flashcard detail from DB');
            // Cho phép xem thẻ của bất kỳ ai (không giới hạn user._id)
            flashCard = await FlashCard.findById(cardId).populate('user', 'username avatar').lean();

            if (!flashCard) {
                req.flash('error', 'Không tìm thấy bộ thẻ!');
                return res.redirect('/flashcards');
            }

            // Cache the flashcard
            await flashCardCache.setFlashcard(cardId, flashCard);
        } else {
            console.log('✅ Cache HIT - Flashcard detail');
        }

        // Check if this is user's own card
        const isOwner = flashCard.user._id.toString() === user._id.toString();

        res.render('./page/flashcards/card', {
            title: "Thẻ " + flashCard.name,
            flashCard,
            isOwner, // Pass to view to show/hide delete button
        });
    } catch (error) {
        console.error('Error in getflashcardDetail:', error);
        req.flash('error', 'Có lỗi khi tải bộ thẻ!');
        res.redirect('/flashcards');
    }
}
export const getCreateCard = (req, res) => {
    res.render('./page/flashcards/createCard', {
        title: 'Tạo bộ thẻ mới',
        name: '',
        cardsText: ''
    });
};

export const postCreateCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const { name, cardsText } = req.body;
        let cards = [];

        if (cardsText) {
            cards = cardsText.trim().split('\n').map(line => {
                const [vocabulary, meaning] = line.split('-').map(item => item.trim());
                return { vocabulary, meaning };
            }).filter(card => card.vocabulary && card.meaning);
        }

        if (!name || cards.length === 0) {
            throw new Error('Vui lòng nhập tên bộ thẻ và ít nhất một thẻ hợp lệ!');
        }

        const flashCard = new FlashCard({
            name,
            cards,
            user: user._id,
        });

        await flashCard.save();

        // Invalidate cache after creating new flashcard
        await flashCardCache.invalidateUserFlashcards(user._id);

        req.flash('success', 'Tạo bộ thẻ thành công!');
        res.redirect('/flashcards');
    } catch (error) {
        req.flash('error', error.message || 'Có lỗi khi tạo bộ thẻ');
        res.render('./page/flashcards/createCard', {
            title: 'Tạo bộ thẻ mới',
            name: req.body.name || '',
            cardsText: req.body.cardsText || ''
        });
    }
};

//xóa thẻ và xóa bộ thẻ
export const deleteCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const cardId = req.params.id;
        const flashCard = await FlashCard.findOne({ 'cards._id': cardId, user: user._id });
        if (!flashCard) {
            throw new Error('Không tìm thấy thẻ!');
        }
        flashCard.cards = flashCard.cards.filter(card => card._id.toString() !== cardId);
        await flashCard.save();
        req.flash('success', 'Xóa thẻ thành công!');
        res.redirect('/flashcards');
    } catch (error) {
        req.flash('error', 'Có lỗi khi xóa thẻ!');
        res.redirect('/flashcards');
    }
};
export const deleteFlashCard = async (req, res) => {
    try {
        const user = res.locals.user;
        console.log('User:', user);
        if (!user || !user._id) {
            req.flash('error', 'Unauthorized');
            return res.redirect('/flashcards');
        }

        const flashCardId = req.params.id;
        console.log('Flashcard ID:', flashCardId);

        const flashCard = await FlashCard.findOne({ _id: flashCardId, user: user._id });
        console.log('Found flashcard:', flashCard);
        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }

        await flashCard.deleteOne();
        console.log('Flashcard deleted');

        // Invalidate cache after deleting flashcard
        await flashCardCache.invalidateFlashcard(flashCardId, user._id);

        req.flash('success', 'Xóa bộ thẻ thành công!');
        return res.redirect('/flashcards');
    } catch (error) {
        console.error('Error in deleteFlashCard:', error);
        req.flash('error', 'Có lỗi khi xóa bộ thẻ!');
        return res.redirect('/flashcards');
    }
};

export const baiTapTuVung = async (req, res) => {
    const { id } = req.params;
    try {
        const flashcard = await FlashCard.findById(id);
        if (!flashcard) {
            req.flash('error', 'Không tìm thấy bộ flashcard');
            return res.redirect('/flashcards');
        }
        // Lấy danh sách các card
        let cardsData = flashcard.cards.map(card => ({
            vocabulary: card.vocabulary,
            meaning: card.meaning
        }));

        // Xáo trộn mảng cardsData
        for (let i = cardsData.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardsData[i], cardsData[j]] = [cardsData[j], cardsData[i]];
        }

        // Nếu số thẻ không chia đôi, chúng ta chia theo số lượng tối đa chẵn
        const half = Math.floor(cardsData.length / 2);

        // 5 thẻ đầu: câu hỏi là vocabulary, người dùng nhập meaning
        const group1 = cardsData.slice(0, half).map(card => ({
            question: card.vocabulary,
            answer: card.meaning,
            mode: 'vocab-to-meaning'
        }));

        // 5 thẻ tiếp theo: câu hỏi là meaning, người dùng nhập vocabulary
        const group2 = cardsData.slice(half, half * 2).map(card => ({
            question: card.meaning,
            answer: card.vocabulary,
            mode: 'meaning-to-vocab'
        }));

        // Gộp 2 nhóm lại thành 1 mảng quiz
        const quiz = [...group1, ...group2];
        req.flash('success', 'Bắt đầu bài ôn luyện!');
        return res.render('./page/flashcards/review', { quiz, flashcard });
    } catch (error) {
        console.error('Lỗi khi lấy flashcard:', error);
        req.flash('error', 'Lỗi server khi tải bài ôn luyện');
        return res.redirect('/flashcards');
    }
};
export const getList = async (req, res) => {

    try {
        const user = res.locals.user;
        const cardId = req.params.id;
        // Cho phép xem list của bất kỳ ai
        const flashCard = await FlashCard.findById(cardId);
        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }

        // Populate user info separately
        await flashCard.populate('user', 'username avatar');

        // Check if this is user's own card
        const isOwner = flashCard.user._id.toString() === user._id.toString();

        res.render('./page/flashcards/list', {
            title: "Thẻ " + flashCard.name,
            flashCard,
            isOwner, // Pass to view to show/hide delete/edit buttons
        });
    } catch (error) {
        req.flash('error', 'Có lỗi khi tải bộ thẻ!');
        res.redirect('/flashcards');
    }
}

// API: Get my flashcards (CSR)
export const getMyFlashcardsAPI = async (req, res) => {
    try {
        const user = res.locals.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Try cache first
        let cachedData = await flashCardCache.getMyFlashcards(user._id, page, limit);

        if (cachedData) {
            console.log('✅ Cache HIT - My flashcards API');
            return res.json({
                flashcards: cachedData.flashcards,
                currentPage: page,
                totalPages: cachedData.totalPages,
                hasMore: page < cachedData.totalPages,
            });
        }

        console.log('🔍 Cache MISS - My flashcards API');
        const totalMyCards = await FlashCard.countDocuments({ user: user._id });
        const totalPages = Math.ceil(totalMyCards / limit);

        const flashcards = await FlashCard.find({ user: user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Cache the data
        const dataToCache = {
            flashcards,
            totalCards: totalMyCards,
            totalPages,
        };
        await flashCardCache.setMyFlashcards(user._id, page, limit, dataToCache);

        res.json({
            flashcards,
            currentPage: page,
            totalPages,
            hasMore: page < totalPages,
        });
    } catch (error) {
        console.error('Error in getMyFlashcardsAPI:', error);
        res.status(500).json({ error: 'Có lỗi khi tải danh sách thẻ' });
    }
};

// API: Get others flashcards (CSR)
export const getOthersFlashcardsAPI = async (req, res) => {
    try {
        const user = res.locals.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Giảm xuống 10 để giao diện đẹp hơn (2x5 grid)
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || '';

        // Try cache first
        let cachedData = await flashCardCache.getOthersFlashcards(user._id, page, limit, searchQuery);

        if (cachedData) {
            console.log('✅ Cache HIT - Others flashcards API');
            return res.json({
                flashcards: cachedData.flashcards,
                currentPage: page,
                totalPages: cachedData.totalPages,
                hasNextPage: page < cachedData.totalPages,
                hasPrevPage: page > 1,
            });
        }

        console.log('🔍 Cache MISS - Others flashcards API');

        let query = { user: { $ne: user._id } };

        // Sử dụng regex search thay vì text index
        if (searchQuery) {
            query.name = { $regex: searchQuery, $options: 'i' };
        }

        const totalCards = await FlashCard.countDocuments(query);
        const totalPages = Math.ceil(totalCards / limit);

        const queryBuilder = FlashCard.find(query)
            .populate('user', 'username avatar')
            .skip(skip)
            .limit(limit)
            .lean()
            .sort({ createdAt: -1 });

        const flashcards = await queryBuilder;

        // Cache the data
        const dataToCache = {
            flashcards,
            totalCards,
            totalPages,
        };
        await flashCardCache.setOthersFlashcards(user._id, page, limit, searchQuery, dataToCache);

        res.json({
            flashcards,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        });
    } catch (error) {
        console.error('Error in getOthersFlashcardsAPI:', error);
        res.status(500).json({ error: 'Có lỗi khi tải danh sách thẻ' });
    }
};
