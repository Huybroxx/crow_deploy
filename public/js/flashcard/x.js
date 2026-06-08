import { FlashcardDeckSpeaker, isSpeechSupported, stopBrowserSpeech } from "./tts.js";

const deleteForms = document.querySelectorAll('form[action*="/flashcards/delete"]');

deleteForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
        const confirmDelete = confirm('Bạn có chắc chắn muốn xóa bộ thẻ này không?');
        if (!confirmDelete) {
            e.preventDefault(); // Ngăn submit nếu người dùng không xác nhận
        }
    });
});

const listenButtons = document.querySelectorAll(".flashcard-listen-btn");
let activeSpeaker = null;
let activeButton = null;

function parseButtonCards(button) {
    try {
        return JSON.parse(button.dataset.cards || "[]");
    } catch (error) {
        console.error("Không thể đọc dữ liệu bộ thẻ:", error);
        return [];
    }
}

function setListenButton(button, isPlaying) {
    if (!button) return;

    button.classList.toggle("is-playing", isPlaying);
    button.innerHTML = isPlaying
        ? '<i class="fas fa-stop"></i> Dừng'
        : '<i class="fas fa-volume-high"></i> Nghe';
}

listenButtons.forEach((button) => {
    button.disabled = !isSpeechSupported();

    button.addEventListener("click", () => {
        if (!isSpeechSupported()) {
            alert("Trình duyệt này chưa hỗ trợ đọc bằng giọng nói.");
            return;
        }

        if (activeSpeaker && activeButton === button && activeSpeaker.isPlaying) {
            activeSpeaker.stop();
            setListenButton(button, false);
            activeSpeaker = null;
            activeButton = null;
            return;
        }

        if (activeSpeaker) {
            activeSpeaker.stop();
            setListenButton(activeButton, false);
        }

        const cards = parseButtonCards(button);

        if (!cards.length) {
            alert("Bộ thẻ này chưa có nội dung để đọc.");
            return;
        }

        activeButton = button;
        setListenButton(button, true);

        activeSpeaker = new FlashcardDeckSpeaker(cards, {
            rate: 1,
            onDone: () => {
                setListenButton(button, false);
                activeSpeaker = null;
                activeButton = null;
            },
            onStop: () => {
                setListenButton(button, false);
            },
            onError: () => {
                setListenButton(button, false);
                alert("Không thể đọc bộ thẻ lúc này.");
                activeSpeaker = null;
                activeButton = null;
            },
        });

        activeSpeaker.play(0);
    });
});

window.addEventListener("beforeunload", stopBrowserSpeech);

// Chọn section.flashcards
const flashcardsSection = document.querySelector('section.flashcards');

// Hàm tạo bong bóng ngẫu nhiên
function createBubble() {
    if (!flashcardsSection) return null;

    const bubble = document.createElement('div');
    bubble.classList.add('bubble');

    // Kích thước ngẫu nhiên từ 20px đến 60px
    const size = Math.random() * 40 + 20;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;

    // Vị trí ban đầu ngẫu nhiên
    bubble.style.left = `${Math.random() * (flashcardsSection.offsetWidth - size)}px`;
    bubble.style.top = `${Math.random() * (flashcardsSection.offsetHeight - size)}px`;

    // Tốc độ di chuyển ngẫu nhiên
    const speedX = (Math.random() - 0.5) * 4; // -2 đến 2
    const speedY = (Math.random() - 0.5) * 4;
    bubble.dataset.speedX = speedX;
    bubble.dataset.speedY = speedY;

    flashcardsSection.appendChild(bubble);
    return bubble;
}


const bubbles = [];
if (flashcardsSection) {
    for (let i = 0; i < 10; i++) {
        const bubble = createBubble();
        if (bubble) {
            bubbles.push(bubble);
        }
    }
}

function updateBubbles() {
    if (!flashcardsSection) return;

    bubbles.forEach((bubble) => {
        let x = parseFloat(bubble.style.left);
        let y = parseFloat(bubble.style.top);
        const size = parseFloat(bubble.style.width);
        let speedX = parseFloat(bubble.dataset.speedX);
        let speedY = parseFloat(bubble.dataset.speedY);

        // Cập nhật vị trí
        x += speedX;
        y += speedY;

        // Kiểm tra va chạm với cạnh
        if (x <= 0 || x + size >= flashcardsSection.offsetWidth) {
            speedX = -speedX; // Nảy ngược theo trục X
            x = Math.max(0, Math.min(x, flashcardsSection.offsetWidth - size)); // Giới hạn trong khung
        }
        if (y <= 0 || y + size >= flashcardsSection.offsetHeight) {
            speedY = -speedY; // Nảy ngược theo trục Y
            y = Math.max(0, Math.min(y, flashcardsSection.offsetHeight - size));
        }

        // Gán lại giá trị
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
        bubble.dataset.speedX = speedX;
        bubble.dataset.speedY = speedY;
    });

    requestAnimationFrame(updateBubbles); // Vòng lặp animation
}

// Bắt đầu animation
updateBubbles();
