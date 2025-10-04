// Lấy phần tử HTML
const cardsContainer = document.getElementById("cards-container");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");
const currentElement = document.getElementById("current");
const showButton = document.getElementById("show");
const hideButton = document.getElementById("hide");
const addContainer = document.getElementById("add-container");
const shuffleButton = document.getElementById("random"); // Nút trộn thẻ
const alertMessage = document.getElementById("alert");
// Lấy dữ liệu từ HTML (Pug đã render)
const cardData = document.querySelector(".card-data");
let flashcard = null;
let listCard = [];

if (!cardData) {
    console.error("Card data element not found!");
} else {
    try {
        const dataAttr = cardData.getAttribute("data");
        if (dataAttr) {
            flashcard = JSON.parse(dataAttr);
            listCard = flashcard.cards || [];
        } else {
            console.error("Data attribute is empty");
        }
    } catch (error) {
        console.error("Error parsing card data:", error);
    }
}

let isReversed = false;

// Chuyển đổi dữ liệu từ BE thành { question, answer }
let cardsData = [];
if (listCard && Array.isArray(listCard)) {
    cardsData = listCard.map(card => ({
        question: card.vocabulary,
        answer: card.meaning
    }));
} else {
    console.error("No cards data found or invalid format:", listCard);
}

let currentActiveCard = 0;
let cardsElement = [];

// Tạo các card từ dữ liệu BE
function createCards() {
    cardsContainer.innerHTML = ""; // Xóa danh sách cũ
    cardsElement = []; // Xóa danh sách phần tử cũ

    if (cardsData.length === 0) {
        cardsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Không có thẻ nào trong bộ này</div>';
        return;
    }

    cardsData.forEach((data, index) => createCard(data, index));
    updateCurrentCardDisplay();
}

function updateCurrentCardDisplay() {
    if (currentElement) {
        currentElement.innerText = `${currentActiveCard + 1}/${cardsElement.length}`;
    }
}


function createCard(data, index) {
    const card = document.createElement("div");
    card.classList.add("card");
    if (index === 0) card.classList.add("active");
    card.innerHTML = `
        <div class="inner-card card-animation">
            <div class="inner-card-front">
                <p style="font-size:1.5rem">${data.question}</p>
                <button class="voice-btn front-voice" data-text="${data.question}"><i class="fa-solid fa-volume-high"></i></i></button>
            </div>
            <div class="inner-card-back">
                <p style="font-size:1.5rem">${data.answer}</p>
                <button class="voice-btn back-voice" data-text="${data.answer}"><i class="fa-solid fa-volume-high"></i></button>
            </div>
        </div>
    `;
    card.addEventListener("click", () => card.classList.toggle("show-answer"));

    // Thêm sự kiện cho nút Voice trên mặt trước
    const frontVoiceBtn = card.querySelector(".front-voice");
    frontVoiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = frontVoiceBtn.getAttribute("data-text"); // Lấy từ <button>
        speakText(text);
    });

    // Thêm sự kiện cho nút Voice trên mặt sau
    const backVoiceBtn = card.querySelector(".back-voice");
    backVoiceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = backVoiceBtn.getAttribute("data-text"); // Lấy từ <button>
        speakText(text);
    });

    cardsElement.push(card);
    cardsContainer.appendChild(card);
    updateCurrentText();
}

// Hàm gọi API để đọc văn bản
async function speakText(text) {
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error('Lỗi khi gọi API TTS');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    } catch (error) {
        console.error('Error playing audio:', error);
        alert('Không thể đọc được nội dung. Vui lòng thử lại.');
    }
}
function updateCurrentText() {
    if (currentElement) {
        currentElement.innerText = `${currentActiveCard + 1}/${cardsElement.length}`;
    }
}

// Chuyển card tiếp theo
nextButton?.addEventListener("click", () => {
    cardsElement[currentActiveCard].className = "card left";
    currentActiveCard++;
    if (currentActiveCard > cardsElement.length - 1) {
        currentActiveCard = 0;
    }
    cardsElement[currentActiveCard].className = "card active";
    updateCurrentText();
});

// Chuyển card trước đó
prevButton?.addEventListener("click", () => {
    cardsElement[currentActiveCard].className = "card right";
    currentActiveCard--;
    if (currentActiveCard < 0) {
        currentActiveCard = cardsElement.length - 1;
    }
    cardsElement[currentActiveCard].className = "card active";
    updateCurrentText();
});

// Mở form thêm card
showButton?.addEventListener("click", () => addContainer.classList.add("show"));

// Đóng form thêm card
hideButton?.addEventListener("click", () => {
    addContainer.classList.remove("show");
    document.getElementById("question").value = "";
    document.getElementById("answer").value = "";
    location.reload();
});

// Trộn ngẫu nhiên danh sách thẻ
shuffleButton?.addEventListener("click", () => {
    if (cardsData.length === 0) {
        alertMessage.innerText = "Không có thẻ để trộn!";
        setTimeout(() => {
            alertMessage.innerText = "";
        }, 2000);

        return;
    }

    // Fisher-Yates shuffle
    for (let i = cardsData.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [cardsData[i], cardsData[j]] = [cardsData[j], cardsData[i]];
    }

    createCards(); // Cập nhật giao diện sau khi trộn
});

// Khởi tạo các card từ dữ liệu BE
createCards();

// Thêm card mới
const addCardBtn = document.getElementById("add-card");
if (addCardBtn) {
    addCardBtn.addEventListener("click", async () => {
        const vocabulary = document.getElementById("question").value.trim();
        const meaning = document.getElementById("answer").value.trim();
        const flashCardId = flashcard._id;

        if (!vocabulary || !meaning) {
            return;
        }

        try {
            const response = await fetch(`/flashcards/card/${flashCardId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({ vocabulary, meaning }),
            });

            if (!response.ok) {
                throw new Error("Lỗi khi gửi dữ liệu");
            }

            const data = await response.json();
            console.log(data.message); // Kiểm tra phản hồi từ server
            alertMessage.innerText = data.message;
            setTimeout(() => {
                alertMessage.innerText = "";
            }, 2000);
            // Tải lại trang để cập nhật danh sách thẻ
        } catch (error) {
            console.error("Lỗi khi thêm thẻ:", error);
        }
    });
}

$(document).ready(function () {
    // Khởi tạo Select2
    const outputLangSelect = $('#outputLang');
    if (outputLangSelect.length) {
        outputLangSelect.select2({
            templateResult: formatLanguage, // Hiển thị trong dropdown
            templateSelection: formatLanguage, // Hiển thị khi chọn
            placeholder: 'Chọn ngôn ngữ',
            allowClear: true,
        });
    }

    // Hàm hiển thị quốc kỳ và tên ngôn ngữ
    function formatLanguage(language) {
        if (!language.id) return language.text; // Placeholder
        const flagImg = language.element.dataset.img; // URL hình ảnh
        const flagEmoji = language.element.dataset.flag; // Emoji cờ
        const $language = $(
            `<span><img src="${flagImg}" class="flag-img" alt="${language.text}"/> ${language.text}</span>`
            // Nếu muốn dùng emoji thay img: `<span>${flagEmoji} ${language.text}</span>`
        );
        return $language;
    }

    // Xử lý click nút AI Gennarate
    const questionTextarea = document.getElementById('question');
    const answerTextarea = document.getElementById('answer');
    const aiGenButton = document.getElementById('AI-gen');
    const alertDiv = document.getElementById('alert');

    if (aiGenButton) {
        aiGenButton.addEventListener('click', async () => {
            const questionText = questionTextarea.value.trim();
            const outputLang = $('#outputLang').val() || 'en'; // Lấy giá trị từ Select2

            if (!questionText) {
                alertDiv.innerHTML = '<p class="text-danger">Vui lòng nhập câu hỏi!</p>';
                return;
            }

            alertDiv.innerHTML = '';

            try {
                const response = await fetch('/AI-gen', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer YOUR_AUTH_TOKEN',
                    },
                    body: JSON.stringify({ question: questionText, outputLang: outputLang }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                const data = await response.json();
                answerTextarea.value = data.answer;

            } catch (error) {
                console.error('Lỗi khi gọi API /AI-gen:', error);
                alertDiv.innerHTML = '<p class="text-danger">Đã có lỗi xảy ra. Vui lòng thử lại!</p>';
            }
        });
    }

    const learnBtn = document.getElementById('learn');
    const choiseContainer = document.getElementById('choise-container');
    const closeBtn = document.getElementById('closex');
    if (learnBtn && choiseContainer) {
        learnBtn.addEventListener('click', () => { choiseContainer.classList.add('show') });
    } else {
        console.log('Không tìm thấy phần tử');
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => { choiseContainer.classList.remove('show') });
    }

});

// Lắng nghe sự kiện phím từ bàn phím
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight':
            if (nextButton) nextButton.click();
            break;
        case 'ArrowLeft':
            if (prevButton) prevButton.click();
            break;
        case 'ArrowDown':
        case ' ':
            e.preventDefault(); // Ngăn scroll khi nhấn space
            if (cardsElement[currentActiveCard]) {
                cardsElement[currentActiveCard].classList.toggle("show-answer");
            }
            break;
        default:
            break;
    }
});

const reverseBtn = document.getElementById("reverse");
if (reverseBtn) {
    reverseBtn.addEventListener("click", () => {
        isReversed = !isReversed;

        cardsData = listCard.map(card => ({
            question: isReversed ? card.meaning : card.vocabulary,
            answer: isReversed ? card.vocabulary : card.meaning
        }));

        createCards();
    });
}

