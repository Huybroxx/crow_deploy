document.addEventListener('DOMContentLoaded', () => {
    const dataNode = document.querySelector('.flashcard-edit-data');
    const cardsContainer = document.getElementById('editCards');
    const cardsJsonInput = document.getElementById('cardsJson');
    const form = document.getElementById('editFlashcardForm');
    const addCardButton = document.getElementById('addCard');
    const searchAllButton = document.getElementById('searchAllMissing');
    const editCount = document.getElementById('editCount');

    let rawCards = [];
    try {
        rawCards = JSON.parse(dataNode?.dataset.cards || '[]');
    } catch (error) {
        rawCards = [];
    }

    let cards = rawCards.map((card, index) => normalizeCard(card, index));
    const imageResults = {};
    const imageMessages = {};
    const loadingSearches = new Set();
    let isSearchingAll = false;

    function normalizeCard(card = {}, index = 0) {
        const id = card._id ? String(card._id) : '';
        return {
            localId: id || `new-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
            _id: id,
            vocabulary: card.vocabulary || '',
            meaning: card.meaning || '',
            previewUrl: card.previewUrl || '',
        };
    }

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[char]));
    }

    function hasJapaneseText(value) {
        return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(String(value || ''));
    }

    function getImageSearchQuery(card) {
        if (!card) return '';
        if (hasJapaneseText(card.vocabulary)) return card.vocabulary.trim();
        if (hasJapaneseText(card.meaning)) return card.meaning.trim();
        return (card.vocabulary || card.meaning || '').trim();
    }

    function serializeCards(sourceCards = cards) {
        return sourceCards.map(card => {
            const serialized = {
                vocabulary: card.vocabulary.trim(),
                meaning: card.meaning.trim(),
                previewUrl: card.previewUrl.trim(),
            };

            if (card._id) {
                serialized._id = card._id;
            }

            return serialized;
        });
    }

    function syncHiddenInput() {
        cardsJsonInput.value = JSON.stringify(serializeCards());
    }

    function cardHasContent(card) {
        return Boolean(card.vocabulary.trim() || card.meaning.trim() || card.previewUrl.trim());
    }

    function findCardIndex(localId) {
        return cards.findIndex(card => card.localId === localId);
    }

    function renderThumb(card) {
        if (!card.previewUrl) {
            return '<div class="edit-thumb-empty"><i class="fas fa-image"></i></div>';
        }

        return `<img src="${escapeHtml(card.previewUrl)}" alt="${escapeHtml(card.vocabulary || 'Ảnh flashcard')}" loading="lazy">`;
    }

    function renderImageResults(localId) {
        if (loadingSearches.has(localId)) {
            return '<div class="edit-image-status">Đang tìm ảnh...</div>';
        }

        const message = imageMessages[localId];
        if (message) {
            return `<div class="edit-image-status">${escapeHtml(message)}</div>`;
        }

        const results = imageResults[localId] || [];
        if (!results.length) return '';

        return `
            <div class="edit-image-grid">
                ${results.map(image => `
                    <button type="button" class="edit-image-option" data-action="select-image" data-image-url="${escapeHtml(image.imageUrl)}" title="${escapeHtml(image.title)}">
                        <img src="${escapeHtml(image.thumbnailUrl || image.imageUrl)}" alt="${escapeHtml(image.title || 'Ảnh flashcard')}" loading="lazy">
                    </button>
                `).join('')}
            </div>
        `;
    }

    function render() {
        cardsContainer.innerHTML = '';

        if (cards.length === 0) {
            cardsContainer.innerHTML = '<div class="edit-empty">Chưa có card nào. Bấm "Thêm card" để tạo card đầu tiên.</div>';
        }

        cards.forEach((card, index) => {
            const item = document.createElement('div');
            item.className = 'edit-card-item';
            item.dataset.cardId = card.localId;
            item.innerHTML = `
                <div class="edit-position">
                    <span class="position-pill">#${index + 1}</span>
                    <div class="position-controls">
                        <button type="button" data-action="move-up" title="Đưa card lên trên" ${index === 0 ? 'disabled' : ''}><i class="fas fa-arrow-up"></i></button>
                        <button type="button" data-action="move-down" title="Đưa card xuống dưới" ${index === cards.length - 1 ? 'disabled' : ''}><i class="fas fa-arrow-down"></i></button>
                    </div>
                    <label>
                        Vị trí
                        <input class="position-input" type="number" min="1" max="${cards.length}" value="${index + 1}">
                    </label>
                </div>
                <div class="edit-thumb">${renderThumb(card)}</div>
                <div class="edit-fields">
                    <label>
                        Câu hỏi
                        <input type="text" data-field="vocabulary" value="${escapeHtml(card.vocabulary)}" placeholder="Nhập câu hỏi / từ vựng">
                    </label>
                    <label>
                        Trả lời
                        <textarea data-field="meaning" rows="3" placeholder="Nhập câu trả lời / nghĩa">${escapeHtml(card.meaning)}</textarea>
                    </label>
                    <label>
                        URL ảnh
                        <input type="url" data-field="previewUrl" value="${escapeHtml(card.previewUrl)}" placeholder="Dán URL ảnh hoặc chọn từ Serper">
                    </label>
                    <div class="edit-image-actions">
                        <button type="button" data-action="search-image"><i class="fas fa-magnifying-glass"></i> Tìm ảnh</button>
                        <button type="button" data-action="clear-image"><i class="fas fa-eraser"></i> Xóa ảnh</button>
                    </div>
                    <div class="edit-image-panel">${renderImageResults(card.localId)}</div>
                </div>
                <button type="button" class="delete-card-btn" data-action="delete-card" title="Xóa card">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            cardsContainer.appendChild(item);
        });

        editCount.textContent = `${cards.length} card`;
        searchAllButton.disabled = isSearchingAll || cards.length === 0;
        syncHiddenInput();
    }

    function updateCardField(localId, field, value) {
        const index = findCardIndex(localId);
        if (index === -1) return;

        cards[index][field] = value;
        syncHiddenInput();
    }

    function updateThumbForItem(item, card) {
        const thumb = item.querySelector('.edit-thumb');
        if (thumb) {
            thumb.innerHTML = renderThumb(card);
        }
    }

    function moveCard(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= cards.length) return;
        const targetIndex = Math.max(0, Math.min(toIndex, cards.length - 1));
        if (fromIndex === targetIndex) return;

        const [card] = cards.splice(fromIndex, 1);
        cards.splice(targetIndex, 0, card);
        render();
    }

    async function fetchImageResults(query) {
        const response = await fetch(`/flashcards/image-search?q=${encodeURIComponent(query)}&num=8`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Không thể tìm ảnh');
        }

        return data;
    }

    async function searchImagesForCard(localId) {
        const index = findCardIndex(localId);
        if (index === -1) return;

        const card = cards[index];
        const query = getImageSearchQuery(card);
        if (!query) {
            imageMessages[localId] = 'Nhập câu hỏi hoặc trả lời trước để tìm ảnh.';
            render();
            return;
        }

        loadingSearches.add(localId);
        imageMessages[localId] = '';
        render();

        try {
            const data = await fetchImageResults(query);
            imageResults[localId] = data.items || [];
            imageMessages[localId] = imageResults[localId].length
                ? (data.source === 'web' ? 'Không có ảnh trên Irasutoya, đang hiển thị ảnh web.' : '')
                : 'Không tìm thấy ảnh phù hợp.';
        } catch (error) {
            imageResults[localId] = [];
            imageMessages[localId] = error.message || 'Không thể tìm ảnh lúc này.';
        } finally {
            loadingSearches.delete(localId);
            render();
        }
    }

    async function searchAllMissingImages() {
        const targets = cards.filter(card => getImageSearchQuery(card) && !card.previewUrl.trim());

        if (targets.length === 0) {
            alert('Không có card nào thiếu ảnh và có nội dung để tìm.');
            return;
        }

        isSearchingAll = true;
        searchAllButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...';
        targets.forEach(card => {
            loadingSearches.add(card.localId);
            imageMessages[card.localId] = '';
        });
        render();

        const results = await Promise.all(targets.map(async card => {
            try {
                const data = await fetchImageResults(getImageSearchQuery(card));
                return { localId: card.localId, items: data.items || [], source: data.source, error: '' };
            } catch (error) {
                return { localId: card.localId, items: [], source: '', error: error.message || 'Không thể tìm ảnh lúc này.' };
            }
        }));

        results.forEach(({ localId, items, source, error }) => {
            const index = findCardIndex(localId);
            loadingSearches.delete(localId);
            imageResults[localId] = items;

            if (index === -1) return;

            if (error) {
                imageMessages[localId] = error;
            } else if (items.length > 0) {
                cards[index].previewUrl = items[0].imageUrl;
                imageMessages[localId] = source === 'web'
                    ? 'Không có ảnh trên Irasutoya, đã chọn ảnh web.'
                    : '';
            } else {
                imageMessages[localId] = 'Không tìm thấy ảnh phù hợp.';
            }
        });

        isSearchingAll = false;
        searchAllButton.innerHTML = '<i class="fas fa-images"></i> Tìm ảnh còn thiếu';
        render();
    }

    addCardButton.addEventListener('click', () => {
        const newCard = normalizeCard({}, cards.length);
        cards.push(newCard);
        render();

        const lastItem = cardsContainer.querySelector(`[data-card-id="${newCard.localId}"]`);
        lastItem?.querySelector('[data-field="vocabulary"]')?.focus();
    });

    searchAllButton.addEventListener('click', searchAllMissingImages);

    cardsContainer.addEventListener('input', (event) => {
        const field = event.target.dataset.field;
        if (!field) return;

        const item = event.target.closest('.edit-card-item');
        const localId = item?.dataset.cardId;
        if (!localId) return;

        updateCardField(localId, field, event.target.value);

        if (field === 'previewUrl') {
            const index = findCardIndex(localId);
            if (index !== -1) updateThumbForItem(item, cards[index]);
        }
    });

    cardsContainer.addEventListener('change', (event) => {
        if (!event.target.classList.contains('position-input')) return;

        const item = event.target.closest('.edit-card-item');
        const fromIndex = findCardIndex(item?.dataset.cardId);
        const toIndex = Number(event.target.value) - 1;
        moveCard(fromIndex, Number.isNaN(toIndex) ? fromIndex : toIndex);
    });

    cardsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const item = button.closest('.edit-card-item');
        const localId = item?.dataset.cardId;
        const index = findCardIndex(localId);
        const action = button.dataset.action;

        if (index === -1) return;

        if (action === 'move-up') {
            moveCard(index, index - 1);
            return;
        }

        if (action === 'move-down') {
            moveCard(index, index + 1);
            return;
        }

        if (action === 'delete-card') {
            const shouldDelete = !cardHasContent(cards[index]) || confirm('Xóa card này khỏi bộ thẻ?');
            if (!shouldDelete) return;

            cards.splice(index, 1);
            render();
            return;
        }

        if (action === 'clear-image') {
            cards[index].previewUrl = '';
            imageResults[localId] = [];
            imageMessages[localId] = '';
            render();
            return;
        }

        if (action === 'search-image') {
            searchImagesForCard(localId);
            return;
        }

        if (action === 'select-image') {
            cards[index].previewUrl = button.dataset.imageUrl || '';
            imageMessages[localId] = '';
            syncHiddenInput();
            render();
        }
    });

    form.addEventListener('submit', (event) => {
        const partialCard = cards.find(card => cardHasContent(card) && !(card.vocabulary.trim() && card.meaning.trim()));
        if (partialCard) {
            event.preventDefault();
            alert('Mỗi card có nội dung cần đủ cả câu hỏi và trả lời.');
            return;
        }

        const validCards = cards.filter(card => card.vocabulary.trim() && card.meaning.trim());
        if (validCards.length === 0) {
            event.preventDefault();
            alert('Bộ thẻ cần ít nhất một card hợp lệ.');
            return;
        }

        cardsJsonInput.value = JSON.stringify(serializeCards(validCards));
    });

    render();
});
