// Flashcards CSR - Client Side Rendering without page reload
// Global state
let myCurrentPage = 1;
let othersCurrentPage = 1;
let searchQuery = '';
let isMyCardsExpanded = true;
let isOthersCardsExpanded = true;

// DOM Elements
const myCardsContainer = document.getElementById('my-cards-container');
const othersCardsContainer = document.getElementById('others-cards-container');
const searchInput = document.getElementById('searchInput');
const toggleMyCardsBtn = document.getElementById('toggleMyCards');
const toggleOthersCardsBtn = document.getElementById('toggleOthersCards');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeState();
    setupEventListeners();
    initializePaginationFromServerData();
});

// Initialize state from URL
function initializeState() {
    const params = new URLSearchParams(window.location.search);
    myCurrentPage = parseInt(params.get('myPage')) || 1;
    othersCurrentPage = parseInt(params.get('othersPage')) || 1;
    searchQuery = params.get('search') || '';

    if (searchInput) {
        searchInput.value = searchQuery;
    }
}

// Initialize pagination from server-rendered data
function initializePaginationFromServerData() {
    // Get pagination data from window object (set by server)
    if (window.flashcardPageData) {
        const { myTotalPages, myCurrentPage: myPage, othersTotalPages, othersCurrentPage: othersPage } = window.flashcardPageData;

        myCurrentPage = myPage || 1;
        othersCurrentPage = othersPage || 1;

        // Render initial pagination
        if (myTotalPages > 1) {
            renderMyPagination(myCurrentPage, myTotalPages, myCurrentPage < myTotalPages);
        }

        if (othersTotalPages > 1) {
            renderOthersPagination(othersCurrentPage, othersTotalPages, othersCurrentPage < othersTotalPages, othersCurrentPage > 1);
        }
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Toggle My Cards
    if (toggleMyCardsBtn) {
        toggleMyCardsBtn.addEventListener('click', () => {
            toggleSection('my');
        });
    }

    // Toggle Others Cards
    if (toggleOthersCardsBtn) {
        toggleOthersCardsBtn.addEventListener('click', () => {
            toggleSection('others');
        });
    }

    // Search with debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = e.target.value.trim();
                othersCurrentPage = 1; // Reset to page 1 when searching
                loadOthersCards();
                updateURL();
            }, 500);
        });

        // Focus effects
        searchInput.addEventListener('focus', function () {
            this.style.borderColor = 'var(--primary-color)';
            this.style.boxShadow = '0 0 0 3px rgba(230, 126, 34, 0.1)';
        });

        searchInput.addEventListener('blur', function () {
            this.style.borderColor = '#ddd';
            this.style.boxShadow = 'none';
        });
    }

    // Delegate clicks for pagination (since they're dynamically loaded)
    document.addEventListener('click', (e) => {
        // My cards pagination - Previous
        if (e.target.closest('.my-prev-btn')) {
            e.preventDefault();
            myCurrentPage--;
            loadMyCards();
            updateURL();
        }

        // My cards pagination - Next
        if (e.target.closest('.my-next-btn')) {
            e.preventDefault();
            myCurrentPage++;
            loadMyCards();
            updateURL();
        }

        // Others pagination - Previous
        if (e.target.closest('.others-prev-btn')) {
            e.preventDefault();
            othersCurrentPage--;
            loadOthersCards();
            updateURL();
        }

        // Others pagination - Next
        if (e.target.closest('.others-next-btn')) {
            e.preventDefault();
            othersCurrentPage++;
            loadOthersCards();
            updateURL();
        }
    });
}

// Toggle section visibility
function toggleSection(section) {
    if (section === 'my') {
        isMyCardsExpanded = !isMyCardsExpanded;
        const container = myCardsContainer;
        const btn = toggleMyCardsBtn;

        if (isMyCardsExpanded) {
            container.style.maxHeight = '10000px';
            container.style.opacity = '1';
            container.style.overflow = 'visible';
            btn.querySelector('i').className = 'fas fa-chevron-up';
            btn.querySelector('span').textContent = 'Thu gọn';
        } else {
            container.style.maxHeight = '0';
            container.style.opacity = '0';
            container.style.overflow = 'hidden';
            btn.querySelector('i').className = 'fas fa-chevron-down';
            btn.querySelector('span').textContent = 'Mở rộng';
        }
    } else {
        isOthersCardsExpanded = !isOthersCardsExpanded;
        const container = othersCardsContainer.parentElement; // Get the wrapper
        const btn = toggleOthersCardsBtn;

        if (isOthersCardsExpanded) {
            othersCardsContainer.style.maxHeight = '10000px';
            othersCardsContainer.style.opacity = '1';
            othersCardsContainer.style.overflow = 'visible';
            btn.querySelector('i').className = 'fas fa-chevron-up';
            btn.querySelector('span').textContent = 'Thu gọn';
            // Show pagination if exists
            const pagination = document.querySelector('.others-pagination-container');
            if (pagination) pagination.style.display = 'flex';
        } else {
            othersCardsContainer.style.maxHeight = '0';
            othersCardsContainer.style.opacity = '0';
            othersCardsContainer.style.overflow = 'hidden';
            btn.querySelector('i').className = 'fas fa-chevron-down';
            btn.querySelector('span').textContent = 'Mở rộng';
            // Hide pagination
            const pagination = document.querySelector('.others-pagination-container');
            if (pagination) pagination.style.display = 'none';
        }
    }
}

// Load my cards via AJAX
async function loadMyCards() {
    try {
        showLoading(myCardsContainer);

        const response = await fetch(`/api/flashcards/my?page=${myCurrentPage}`);
        const data = await response.json();

        renderMyCards(data);
    } catch (error) {
        console.error('Error loading my cards:', error);
        showError(myCardsContainer, 'Không thể tải thẻ của bạn');
    }
}

// Load others cards via AJAX
async function loadOthersCards() {
    try {
        showLoading(othersCardsContainer);

        const url = `/api/flashcards/others?page=${othersCurrentPage}${searchQuery ? '&search=' + encodeURIComponent(searchQuery) : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        renderOthersCards(data);
    } catch (error) {
        console.error('Error loading others cards:', error);
        showError(othersCardsContainer, 'Không thể tải thẻ cộng đồng');
    }
}

// Render my cards
function renderMyCards(data) {
    const { flashcards, currentPage, totalPages, hasMore } = data;

    // Reset min-height after loading
    myCardsContainer.style.minHeight = '';

    let html = `
        <div class="card course-card" id="add-card-set">
            <div class="content text-center">
                <i class="fas fa-plus-circle"></i>
                <h2>Tạo thẻ mới</h2>
                <a href="/flashcards/createCard">Tạo thẻ mới</a>
            </div>
        </div>
    `;

    if (flashcards && flashcards.length > 0) {
        flashcards.forEach(flashcard => {
            html += `
                <div class="card course-card">
                    <div class="content">
                        <img src="./img/course-1.png" alt="hình ảnh thẻ ghi nhớ">
                        <h2>${flashcard.name}</h2>
                        <p>${flashcard.cards ? flashcard.cards.length : 0} thẻ</p>
                        <p>Tạo lúc: ${new Date(flashcard.createdAt).toLocaleDateString("vi-VN")}</p>
                        <div class="control">
                            <a href="/flashcards/card/${flashcard._id}">Xem</a>
                            <a href="/flashcards/list/${flashcard._id}">List</a>
                            <form action="/flashcards/delete/${flashcard._id}?_method=DELETE" method="POST" style="display: inline;">
                                <button type="submit" class="delete-card">Xóa</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html += `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-inbox" style="font-size: 3em; color: #ddd; margin-bottom: 15px;"></i>
                <h3 style="color: #999;">Chưa có thẻ ghi nhớ nào</h3>
            </div>
        `;
    }

    myCardsContainer.innerHTML = html;

    // Render load more buttons
    renderMyPagination(currentPage, totalPages, hasMore);
}

// Render others cards
function renderOthersCards(data) {
    const { flashcards, currentPage, totalPages, hasNextPage, hasPrevPage } = data;

    // Reset min-height after loading
    othersCardsContainer.style.minHeight = '';

    let html = '';

    if (flashcards && flashcards.length > 0) {
        flashcards.forEach(flashcard => {
            const username = flashcard.user ? flashcard.user.username : 'Unknown';
            html += `
                <div class="card course-card">
                    <div class="content">
                        <img src="./img/course-1.png" alt="hình ảnh thẻ ghi nhớ">
                        <h2>${flashcard.name}</h2>
                        <p>${flashcard.cards ? flashcard.cards.length : 0} thẻ</p>
                        <p style="font-size: 0.85em; color: #888;">
                            <i class="fas fa-user" style="margin-right: 5px;"></i>
                            ${username}
                        </p>
                        <p>Tạo lúc: ${new Date(flashcard.createdAt).toLocaleDateString("vi-VN")}</p>
                        <div class="control">
                            <a href="/flashcards/card/${flashcard._id}">Xem</a>
                            <a href="/flashcards/list/${flashcard._id}">List</a>
                        </div>
                    </div>
                </div>
            `;
        });
    } else {
        html = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search" style="font-size: 3em; color: #ddd; margin-bottom: 15px;"></i>
                <h3 style="color: #999;">Không tìm thấy kết quả nào</h3>
            </div>
        `;
    }

    othersCardsContainer.innerHTML = html;

    // Render pagination
    renderOthersPagination(currentPage, totalPages, hasNextPage, hasPrevPage);
}

// Render my cards pagination
function renderMyPagination(currentPage, totalPages, hasMore) {
    let existingContainer = document.querySelector('.my-pagination-container');

    if (totalPages <= 1) {
        if (existingContainer) existingContainer.remove();
        return;
    }

    let html = '<div class="pagination-container my-pagination-container" style="display: flex; justify-content: center; align-items: center; margin: 30px 0; gap: 10px;">';

    // Previous button
    if (currentPage > 1) {
        html += `<a href="#" class="pagination-btn my-prev-btn" style="padding: 10px 20px; background: #1877f2; color: white; border-radius: 5px; text-decoration: none; font-weight: bold;">← Trước</a>`;
    } else {
        html += `<span class="pagination-btn disabled" style="padding: 10px 20px; background: #ccc; color: #666; border-radius: 5px; cursor: not-allowed;">← Trước</span>`;
    }

    // Page info
    html += `<span class="pagination-info" style="padding: 10px 20px; font-weight: bold; color: #333;">Trang ${currentPage} / ${totalPages}</span>`;

    // Next button
    if (hasMore) {
        html += `<a href="#" class="pagination-btn my-next-btn" style="padding: 10px 20px; background: #1877f2; color: white; border-radius: 5px; text-decoration: none; font-weight: bold;">Tiếp →</a>`;
    } else {
        html += `<span class="pagination-btn disabled" style="padding: 10px 20px; background: #ccc; color: #666; border-radius: 5px; cursor: not-allowed;">Tiếp →</span>`;
    }

    html += '</div>';

    if (existingContainer) {
        existingContainer.outerHTML = html;
    } else {
        myCardsContainer.insertAdjacentHTML('afterend', html);
    }
}

// Render others pagination
function renderOthersPagination(currentPage, totalPages, hasNextPage, hasPrevPage) {
    let existingContainer = document.querySelector('.others-pagination-container');

    if (totalPages <= 1) {
        if (existingContainer) existingContainer.remove();
        return;
    }

    let html = '<div class="pagination-container others-pagination-container" style="display: flex; justify-content: center; align-items: center; margin: 30px 0; gap: 10px;">';

    if (hasPrevPage) {
        html += `<a href="#" class="pagination-btn others-prev-btn" style="padding: 10px 20px; background: #1877f2; color: white; border-radius: 5px; text-decoration: none; font-weight: bold;">← Trước</a>`;
    } else {
        html += `<span class="pagination-btn disabled" style="padding: 10px 20px; background: #ccc; color: #666; border-radius: 5px; cursor: not-allowed;">← Trước</span>`;
    }

    html += `<span class="pagination-info" style="padding: 10px 20px; font-weight: bold; color: #333;">Trang ${currentPage} / ${totalPages}</span>`;

    if (hasNextPage) {
        html += `<a href="#" class="pagination-btn others-next-btn" style="padding: 10px 20px; background: #1877f2; color: white; border-radius: 5px; text-decoration: none; font-weight: bold;">Tiếp →</a>`;
    } else {
        html += `<span class="pagination-btn disabled" style="padding: 10px 20px; background: #ccc; color: #666; border-radius: 5px; cursor: not-allowed;">Tiếp →</span>`;
    }

    html += '</div>';

    if (existingContainer) {
        existingContainer.outerHTML = html;
    } else {
        othersCardsContainer.insertAdjacentHTML('afterend', html);
    }
}

// Show loading state
function showLoading(container) {
    // Save current height to prevent layout shift
    const currentHeight = container.offsetHeight;
    container.style.minHeight = currentHeight + 'px';
    container.style.position = 'relative';

    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; min-height: ${currentHeight}px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <i class="fas fa-spinner fa-spin" style="font-size: 3em; color: var(--primary-color);"></i>
            <p style="margin-top: 15px; color: #666;">Đang tải...</p>
        </div>
    `;
}

// Show error state
function showError(container, message) {
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <i class="fas fa-exclamation-circle" style="font-size: 3em; color: #e74c3c;"></i>
            <p style="margin-top: 15px; color: #e74c3c;">${message}</p>
        </div>
    `;
}

// Update URL without reload
function updateURL() {
    const params = new URLSearchParams();

    if (myCurrentPage > 1) params.set('myPage', myCurrentPage);
    if (othersCurrentPage > 1) params.set('othersPage', othersCurrentPage);
    if (searchQuery) params.set('search', searchQuery);

    const newURL = `/flashcards${params.toString() ? '?' + params.toString() : ''}`;
    window.history.pushState({}, '', newURL);
}

// Add CSS for smooth transitions
const style = document.createElement('style');
style.textContent = `
    #my-cards-container, #others-cards-container {
        transition: max-height 0.5s ease, opacity 0.3s ease, min-height 0.3s ease;
    }

    .toggle-btn:hover {
        background: var(--primary-color) !important;
        color: white !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(230, 126, 34, 0.3);
    }

    .pagination-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(24, 119, 242, 0.3);
    }

    .load-more-btn:hover, .show-less-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Prevent layout shift during loading */
    .flashcard-categories {
        min-height: fit-content;
    }

    /* Smooth spinner animation */
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .fa-spinner.fa-spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);
