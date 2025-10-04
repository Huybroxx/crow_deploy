// Lấy thông tin từ data attributes (được render từ server)
const chatContainer = document.querySelector('.chat-container');
const currentUserId = chatContainer.getAttribute('data-current-user-id');
const receiverId = chatContainer.getAttribute('data-receiver-id');
const receiverAvatar = chatContainer.getAttribute('data-receiver-avatar') || '/img/Avata.png';
const receiverName = chatContainer.getAttribute('data-receiver-name') || 'User';

const chatBox = document.querySelector('.chat-box');
const chatInput = document.querySelector('.chat-text-input');
const sendButton = document.querySelector('.send-button');
const userId = document.querySelector('.userId')?.value || currentUserId;

// Kết nối Socket.IO tự động phát hiện môi trường
const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://crow-r6s9.onrender.com';

console.log(`💬 Chat connecting to: ${socketUrl}`);

const socket = io(socketUrl, {
    query: { userId },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});

// Socket connection events
socket.on('connect', () => {
    console.log('✅ Chat socket connected:', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('❌ Chat socket connection error:', err);
});

socket.on('disconnect', (reason) => {
    console.warn('⚠️ Chat socket disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Chat socket reconnected after', attemptNumber, 'attempts');
});

// Phát âm thanh khi có tin nhắn mới
const messageSound = new Audio('/audio/message.mp3');

function playMessageSound() {
    messageSound.muted = true;
    messageSound.play().then(() => {
        messageSound.muted = false;
    }).catch(error => console.warn("Không thể phát âm thanh:", error));
}

// Hàm format thời gian
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Hàm thêm tin nhắn vào giao diện (CSR - không reload)
function appendMessage({ senderId, message, timestamp, skipScroll = false }) {
    // Kiểm tra xem tin nhắn đã tồn tại chưa (tránh duplicate)
    const existingMessages = chatBox.querySelectorAll('.chat-message');
    const messageText = message.trim();

    // Tạo message element
    const messageDiv = document.createElement('div');
    messageDiv.className = senderId === userId ? 'chat-message right' : 'chat-message left';

    // Nếu là tin nhắn từ người khác, thêm avatar
    if (senderId !== userId) {
        const avatarImg = document.createElement('img');
        avatarImg.src = receiverAvatar;
        avatarImg.alt = receiverName;
        avatarImg.className = 'chat-avatar';
        messageDiv.appendChild(avatarImg);
    }

    // Thêm nội dung tin nhắn
    const messageContent = document.createElement('div');
    messageContent.className = 'chat-message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'chat-text';
    textDiv.textContent = messageText;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'chat-time';
    timeDiv.textContent = formatTime(timestamp);

    messageContent.appendChild(textDiv);
    messageContent.appendChild(timeDiv);
    messageDiv.appendChild(messageContent);

    // Thêm vào chat box
    chatBox.appendChild(messageDiv);

    // Animation fade in
    requestAnimationFrame(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(10px)';
        requestAnimationFrame(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        });
    });

    // Cuộn xuống tin nhắn mới (smooth scroll)
    if (!skipScroll) {
        setTimeout(() => {
            chatBox.scrollTo({
                top: chatBox.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }
}

// Hàm gửi tin nhắn
async function sendMessage() {
    const messageText = chatInput.value.trim();

    if (!messageText) {
        console.log('Tin nhắn rỗng');
        return;
    }

    // Disable input và button trong lúc gửi
    chatInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = '...';

    try {
        // Gửi qua Socket.IO thay vì HTTP
        socket.emit('sendMessage', {
            senderId: userId,
            receiverId: receiverId,
            message: messageText
        });

        // Thêm tin nhắn vào UI ngay lập tức (optimistic update)
        appendMessage({
            senderId: userId,
            message: messageText,
            timestamp: new Date()
        });

        // Xóa input
        chatInput.value = '';
        chatInput.focus();

    } catch (err) {
        console.error('❌ Lỗi gửi tin:', err);
        alert('Không thể gửi tin nhắn. Vui lòng thử lại!');
    } finally {
        // Enable lại input và button
        chatInput.disabled = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Gửi';
    }
}

// Gửi tin nhắn khi nhấn nút gửi
sendButton.addEventListener('click', sendMessage);

// Gửi tin nhắn khi nhấn phím Enter
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Lắng nghe sự kiện "newMessage" từ server (Real-time)
socket.on('newMessage', (data) => {
    console.log('📨 Nhận tin nhắn mới:', data);

    // Chỉ hiển thị tin nhắn từ người khác (tin của mình đã được thêm optimistically)
    if (data.senderId !== userId) {
        playMessageSound();
        appendMessage(data);

        // Thông báo trên tab title
        if (document.hidden) {
            const originalTitle = document.title;
            document.title = '💬 Tin nhắn mới!';
            setTimeout(() => {
                document.title = originalTitle;
            }, 3000);
        }
    }
});

// Hiển thị typing indicator (optional - có thể thêm sau)
let typingTimeout;
chatInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    socket.emit('typing', { receiverId, isTyping: true });

    typingTimeout = setTimeout(() => {
        socket.emit('typing', { receiverId, isTyping: false });
    }, 1000);
});

socket.on('userTyping', ({ senderId, isTyping }) => {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (senderId === receiverId) {
        if (typingIndicator) {
            typingIndicator.style.display = isTyping ? 'block' : 'none';
        }
    }
});

// Auto scroll to bottom on load
window.addEventListener('load', () => {
    chatBox.scrollTop = chatBox.scrollHeight;
});

console.log('✅ Chat controls initialized');
