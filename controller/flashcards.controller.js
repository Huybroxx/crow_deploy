
import User from '../models/user.model.js';
import FlashCard from '../models/flash-card.model.js';
import axios from 'axios';

const SERPER_IMAGES_URL = 'https://google.serper.dev/images';
const PREFERRED_IMAGE_SITE = 'www.irasutoya.com';

const normalizeImageUrl = (value) => {
    const url = String(value || '').trim();
    if (!url) return '';

    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
    } catch (error) {
        return '';
    }
};

const parseSelectedImages = (value) => {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
};

const parseCardLine = (line, index, selectedImages = {}) => {
    const trimmedLine = String(line || '').trim();
    if (!trimmedLine) return null;

    let parts = trimmedLine.includes('|')
        ? trimmedLine.split('|').map(item => item.trim())
        : trimmedLine.split(/\s+-\s+/).map(item => item.trim());

    if (parts.length < 2) {
        parts = trimmedLine.split('-').map(item => item.trim());
    }

    const [vocabulary, meaning, ...imageParts] = parts;
    const selectedImage = selectedImages[`card-${index}`];
    const previewUrl = normalizeImageUrl(imageParts.join(' - ') || selectedImage);

    if (!vocabulary || !meaning) return null;

    return { vocabulary, meaning, previewUrl };
};

const parseCardsText = (cardsText, selectedImages = {}) => {
    if (!cardsText) return [];

    return cardsText
        .trim()
        .split('\n')
        .map((line, index) => parseCardLine(line, index, selectedImages))
        .filter(Boolean);
};

const parseCardsJson = (cardsJson) => {
    let parsedCards = [];

    try {
        parsedCards = JSON.parse(cardsJson || '[]');
    } catch (error) {
        parsedCards = [];
    }

    if (!Array.isArray(parsedCards)) return [];

    return parsedCards.map(card => {
        const vocabulary = String(card?.vocabulary || '').trim();
        const meaning = String(card?.meaning || '').trim();
        const previewUrl = normalizeImageUrl(card?.previewUrl);
        const normalizedCard = { vocabulary, meaning, previewUrl };

        if (card?._id) {
            normalizedCard._id = card._id;
        }

        return normalizedCard;
    }).filter(card => card.vocabulary && card.meaning);
};

const mapSerperImages = (images = []) => images.map(img => ({
    imageUrl: img.imageUrl || '',
    thumbnailUrl: img.thumbnailUrl || img.imageUrl || '',
    title: img.title || '',
    width: img.imageWidth || img.width || 0,
    height: img.imageHeight || img.height || 0,
})).filter(img => img.imageUrl);

const fetchSerperImages = async ({ query, num, apiKey }) => {
    const response = await axios.post(
        SERPER_IMAGES_URL,
        { q: query, num },
        {
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        }
    );

    return mapSerperImages(Array.isArray(response.data?.images) ? response.data.images : []);
};

//flashcards
export const getflashcards = async (req, res) => {
    try {
        const user = res.locals.user;
        const flashCardSets = await FlashCard.find({ user: user._id });
        res.render('./page/flashcards/index', {
            title: 'Thẻ học tập',
            flashCardSets,
        });
    } catch (error) {

    }
}
//thêm thẻ
export const newCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const id = req.params.id;
        const { vocabulary, meaning } = req.body;
        const previewUrl = normalizeImageUrl(req.body.previewUrl);
        const flashCard = await FlashCard.findOne({ _id: id, user: user._id });
        if (!flashCard) {
            throw new Error('Không tìm thấy bộ thẻ!');
        }
        flashCard.cards.push({ vocabulary, meaning, previewUrl });
        await flashCard.save();
        req.flash('success', 'Thêm thẻ thành công!');
        return res.status(200).json({ message: 'Thêm thẻ thành công!' });
    } catch (error) {

    }
}
//thẻ học tập chi tiết
export const getflashcardDetail = async (req, res) => {

    try {
        const user = res.locals.user;
        const cardId = req.params.id;
        const flashCard = await FlashCard.findOne({ _id: cardId, user: user._id });
        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }
        res.render('./page/flashcards/card', {
            title: "Thẻ " + flashCard.name,
            flashCard,
        });
    } catch (error) {
        req.flash('error', 'Có lỗi khi tải bộ thẻ!');
        res.redirect('/flashcards');
    }
}
export const getCreateCard = (req, res) => {
    res.render('./page/flashcards/createCard', {
        title: 'Tạo bộ thẻ mới',
        name: '',
        cardsText: '',
        selectedImages: '{}'
    });
};

export const postCreateCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const { name, cardsText } = req.body;
        const selectedImages = parseSelectedImages(req.body.selectedImages);
        const cards = parseCardsText(cardsText, selectedImages);

        if (!name || cards.length === 0) {
            throw new Error('Vui lòng nhập tên bộ thẻ và ít nhất một thẻ hợp lệ!');
        }

        const flashCard = new FlashCard({
            name,
            cards,
            user: user._id,
        });

        await flashCard.save();
        req.flash('success', 'Tạo bộ thẻ thành công!');
        res.redirect('/flashcards');
    } catch (error) {
        req.flash('error', error.message || 'Có lỗi khi tạo bộ thẻ');
        res.render('./page/flashcards/createCard', {
            title: 'Tạo bộ thẻ mới',
            name: req.body.name || '',
            cardsText: req.body.cardsText || '',
            selectedImages: req.body.selectedImages || '{}'
        });
    }
};

export const getEditCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const flashCard = await FlashCard.findOne({ _id: req.params.id, user: user._id });

        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }

        res.render('./page/flashcards/edit', {
            title: 'Chỉnh sửa bộ thẻ',
            flashCard,
        });
    } catch (error) {
        req.flash('error', 'Có lỗi khi tải trang chỉnh sửa!');
        res.redirect('/flashcards');
    }
};

export const postEditCard = async (req, res) => {
    try {
        const user = res.locals.user;
        const flashCard = await FlashCard.findOne({ _id: req.params.id, user: user._id });

        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }

        const name = String(req.body.name || '').trim();
        const cards = parseCardsJson(req.body.cardsJson);

        if (!name || cards.length === 0) {
            throw new Error('Vui lòng nhập tên bộ thẻ và ít nhất một card hợp lệ!');
        }

        flashCard.name = name;
        flashCard.cards = cards;
        await flashCard.save();

        req.flash('success', 'Cập nhật bộ thẻ thành công!');
        return res.redirect(`/flashcards/card/${flashCard._id}`);
    } catch (error) {
        req.flash('error', error.message || 'Có lỗi khi cập nhật bộ thẻ!');
        return res.redirect(`/flashcards/edit/${req.params.id}`);
    }
};

export const searchFlashcardImages = async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        const num = Math.min(Math.max(Number(req.query.num) || 8, 1), 10);
        const apiKey = process.env.SERPER_API_KEY;

        if (!query) {
            return res.status(400).json({ error: 'Thiếu từ khóa tìm ảnh' });
        }

        if (!apiKey) {
            return res.status(500).json({ error: 'Chưa cấu hình SERPER_API_KEY' });
        }

        const siteQuery = `${query} site:${PREFERRED_IMAGE_SITE}`;
        let items = await fetchSerperImages({ query: siteQuery, num, apiKey });
        let source = 'preferred_site';

        if (items.length === 0) {
            items = await fetchSerperImages({ query, num, apiKey });
            source = 'web';
        }

        return res.status(200).json({ items, source, preferredSite: PREFERRED_IMAGE_SITE });
    } catch (error) {
        console.error('Lỗi khi tìm ảnh Serper:', error.message);
        return res.status(500).json({ error: 'Không thể tìm ảnh lúc này' });
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
        const flashCard = await FlashCard.findOne({ _id: cardId, user: user._id });
        if (!flashCard) {
            req.flash('error', 'Không tìm thấy bộ thẻ!');
            return res.redirect('/flashcards');
        }
        res.render('./page/flashcards/list', {
            title: "Thẻ " + flashCard.name,
            flashCard,
        });
    } catch (error) {
        req.flash('error', 'Có lỗi khi tải bộ thẻ!');
        res.redirect('/flashcards');
    }
}
