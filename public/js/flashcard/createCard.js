document.addEventListener('DOMContentLoaded', function () {
    const textarea = document.getElementById('cardsText');
    const preview = document.getElementById('cardPreview');
    const cardCount = document.getElementById('cardCount');
    const selectedImagesInput = document.getElementById('selectedImages');
    const searchAllButton = document.getElementById('searchAllImages');
    const form = document.querySelector('form');
    const submitBtn = document.querySelector('.btn-create');
    let selectedImages = parseSelectedImages(selectedImagesInput.value);
    const imageResults = {};
    const imageMessages = {};
    const loadingSearches = new Set();
    let isSearchingAll = false;

    function parseSelectedImages(value) {
        try {
            const parsed = JSON.parse(value || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function syncSelectedImages() {
        selectedImagesInput.value = JSON.stringify(selectedImages);
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

    function parseCardLine(line) {
        const trimmedLine = String(line || '').trim();
        if (!trimmedLine) return null;

        let parts = trimmedLine.includes('|')
            ? trimmedLine.split('|').map(item => item.trim())
            : trimmedLine.split(/\s+-\s+/).map(item => item.trim());

        if (parts.length < 2) {
            parts = trimmedLine.split('-').map(item => item.trim());
        }

        const [vocabulary, meaning, ...imageParts] = parts;
        if (!vocabulary || !meaning) return null;

        return {
            vocabulary,
            meaning,
            previewUrl: imageParts.join(' - ').trim(),
        };
    }

    function renderImageResults(cardKey) {
        const results = imageResults[cardKey] || [];
        const message = imageMessages[cardKey];

        if (loadingSearches.has(cardKey)) {
            return '<div class="image-search-status">Đang tìm ảnh...</div>';
        }

        if (message) {
            return `<div class="image-search-status">${escapeHtml(message)}</div>`;
        }

        if (!results.length) return '';

        return `
            <div class="image-results">
                ${results.map((image) => `
                    <button type="button" class="image-option" data-card-key="${escapeHtml(cardKey)}" data-image-url="${escapeHtml(image.imageUrl)}" title="${escapeHtml(image.title)}">
                        <img src="${escapeHtml(image.thumbnailUrl || image.imageUrl)}" alt="${escapeHtml(image.title || 'Ảnh flashcard')}" loading="lazy">
                    </button>
                `).join('')}
            </div>
        `;
    }

    function renderPreview() {
        const lines = textarea.value.split('\n');
        preview.innerHTML = '';
        let validCards = 0;

        if (!textarea.value.trim()) {
            preview.innerHTML = '<p class="text-muted text-center">Chưa có thẻ nào được nhập</p>';
            cardCount.textContent = '0 thẻ';
            searchAllButton.disabled = true;
            return;
        }

        lines.forEach((line, index) => {
            const parsed = parseCardLine(line);
            if (!parsed) return;

            validCards++;
            const cardKey = `card-${index}`;
            const previewUrl = parsed.previewUrl || selectedImages[cardKey] || '';
            const cardItem = document.createElement('div');
            cardItem.className = 'card-item';
            cardItem.innerHTML = `
                <div class="card-item-top">
                    <div class="card-info">
                        <span class="card-index">#${validCards}</span>
                        ${previewUrl ? `<img class="preview-thumb" src="${escapeHtml(previewUrl)}" alt="${escapeHtml(parsed.vocabulary)}" loading="lazy">` : '<div class="preview-thumb preview-thumb-empty"><i class="fas fa-image"></i></div>'}
                        <span><strong>${escapeHtml(parsed.vocabulary)}</strong> - ${escapeHtml(parsed.meaning)}</span>
                    </div>
                    <div class="card-actions">
                        <button type="button" class="btn-search-image" data-index="${index}" data-query="${escapeHtml(parsed.vocabulary)}">
                            <i class="fas fa-magnifying-glass"></i> Tìm ảnh
                        </button>
                        <button type="button" class="btn-remove" data-index="${index}">Xóa</button>
                    </div>
                </div>
                ${renderImageResults(cardKey)}
            `;
            preview.appendChild(cardItem);
        });

        cardCount.textContent = `${validCards} thẻ`;
        searchAllButton.disabled = validCards === 0 || isSearchingAll;
        syncSelectedImages();
    }

    function getParsedCards() {
        return textarea.value
            .split('\n')
            .map((line, index) => ({ index, parsed: parseCardLine(line) }))
            .filter(item => item.parsed);
    }

    async function fetchImageResults(query) {
        const response = await fetch(`/flashcards/image-search?q=${encodeURIComponent(query)}&num=8`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Không thể tìm ảnh');
        }

        return data;
    }

    // Xóa thẻ
    function removeCard(index) {
        const lines = textarea.value.split('\n');
        lines.splice(index, 1);
        textarea.value = lines.join('\n');

        const nextSelectedImages = {};
        Object.entries(selectedImages).forEach(([key, url]) => {
            const currentIndex = Number(key.replace('card-', ''));
            if (Number.isNaN(currentIndex)) return;
            if (currentIndex < index) {
                nextSelectedImages[key] = url;
            } else if (currentIndex > index) {
                nextSelectedImages[`card-${currentIndex - 1}`] = url;
            }
        });

        selectedImages = nextSelectedImages;
        renderPreview();
    }

    async function searchImages(index, query) {
        const cardKey = `card-${index}`;
        loadingSearches.add(cardKey);
        imageMessages[cardKey] = '';
        renderPreview();

        try {
            const data = await fetchImageResults(query);

            imageResults[cardKey] = data.items || [];
            imageMessages[cardKey] = imageResults[cardKey].length ? '' : 'Không tìm thấy ảnh phù hợp';
        } catch (error) {
            imageResults[cardKey] = [];
            imageMessages[cardKey] = error.message || 'Không thể tìm ảnh lúc này';
        } finally {
            loadingSearches.delete(cardKey);
            renderPreview();
        }
    }

    async function searchAllImages() {
        const cards = getParsedCards().filter(({ index, parsed }) => {
            const cardKey = `card-${index}`;
            return !(parsed.previewUrl || selectedImages[cardKey]);
        });

        if (cards.length === 0) {
            alert('Các thẻ hiện tại đã có ảnh hoặc chưa có thẻ hợp lệ để tìm.');
            return;
        }

        const originalText = searchAllButton.innerHTML;
        isSearchingAll = true;
        searchAllButton.disabled = true;
        searchAllButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...';

        cards.forEach(({ index }) => {
            const cardKey = `card-${index}`;
            loadingSearches.add(cardKey);
            imageMessages[cardKey] = '';
        });
        renderPreview();

        const results = await Promise.all(cards.map(async ({ index, parsed }) => {
            const cardKey = `card-${index}`;

            try {
                const data = await fetchImageResults(parsed.vocabulary);
                return {
                    cardKey,
                    items: data.items || [],
                    source: data.source,
                    error: '',
                };
            } catch (error) {
                return {
                    cardKey,
                    items: [],
                    source: '',
                    error: error.message || 'Không thể tìm ảnh lúc này',
                };
            }
        }));

        results.forEach(({ cardKey, items, source, error }) => {
            loadingSearches.delete(cardKey);
            imageResults[cardKey] = items;

            if (error) {
                imageMessages[cardKey] = error;
                return;
            }

            if (items.length > 0) {
                selectedImages[cardKey] = items[0].imageUrl;
                imageMessages[cardKey] = source === 'web'
                    ? 'Không có ảnh trên Irasutoya, đã chọn ảnh web.'
                    : '';
            } else {
                imageMessages[cardKey] = 'Không tìm thấy ảnh phù hợp';
            }
        });

        searchAllButton.innerHTML = originalText;
        isSearchingAll = false;
        searchAllButton.disabled = false;
        syncSelectedImages();
        renderPreview();
    }

    textarea.addEventListener('input', renderPreview);
    searchAllButton.addEventListener('click', searchAllImages);

    preview.addEventListener('click', function (event) {
        const removeButton = event.target.closest('.btn-remove');
        if (removeButton) {
            removeCard(Number(removeButton.dataset.index));
            return;
        }

        const searchButton = event.target.closest('.btn-search-image');
        if (searchButton) {
            searchImages(Number(searchButton.dataset.index), searchButton.dataset.query);
            return;
        }

        const imageButton = event.target.closest('.image-option');
        if (imageButton) {
            selectedImages[imageButton.dataset.cardKey] = imageButton.dataset.imageUrl;
            syncSelectedImages();
            renderPreview();
        }
    });

    // Validation và hiệu ứng khi submit
    form.addEventListener('submit', function (e) {
        const name = document.getElementById('name').value.trim();
        const cards = textarea.value.split('\n').map(parseCardLine).filter(Boolean);

        if (!name || cards.length === 0) {
            e.preventDefault();
            alert('Vui lòng nhập tên bộ thẻ và ít nhất một thẻ hợp lệ!');
            return;
        }

        syncSelectedImages();
        submitBtn.innerHTML = 'Đang tạo...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
    });

    renderPreview();
});
