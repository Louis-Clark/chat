// Advanced Chat Application Script
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const setupScreen = document.getElementById('setup-screen');
    const chatScreen = document.getElementById('chat-screen');
    const usernameInput = document.getElementById('username-input');
    const enterChatBtn = document.getElementById('enter-chat');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const currentUserDisplay = document.getElementById('current-user');
    const themeToggle = document.getElementById('theme-toggle');
    const clearChatBtn = document.getElementById('clear-chat');
    const emojiBtn = document.getElementById('emoji-btn');
    const imageBtn = document.getElementById('image-btn');
    const imageInput = document.getElementById('image-input');
    const emojiPicker = document.getElementById('emoji-picker');
    const typingIndicator = document.getElementById('typing-indicator');
    const colorButtons = document.querySelectorAll('.color-btn');

    // State
    let username = localStorage.getItem('username') || '';
    let userColor = localStorage.getItem('userColor') || '#6C5CE7';
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let typingTimeout;
    let userId = localStorage.getItem('userId') || generateUserId();
    let onlineUsers = new Set();

    // Initialize
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    }

    if (username) {
        showChatScreen();
    }

    // Event Listeners
    enterChatBtn.addEventListener('click', enterChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enterChat();
    });

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput.addEventListener('input', () => {
        handleTyping();
    });

    themeToggle.addEventListener('click', toggleTheme);
    clearChatBtn.addEventListener('click', clearChat);
    emojiBtn.addEventListener('click', toggleEmojiPicker);
    imageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageUpload);

    colorButtons.forEach(btn => {
        if (btn.dataset.color === userColor) {
            btn.classList.add('selected');
        }
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            userColor = btn.dataset.color;
            localStorage.setItem('userColor', userColor);
        });
    });

    // Emoji Picker
    if (emojiPicker) {
        emojiPicker.addEventListener('emoji-click', (e) => {
            messageInput.value += e.detail.unicode;
            emojiPicker.classList.add('hidden');
            messageInput.focus();
        });
    }

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });

    // Functions
    function generateUserId() {
        const id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', id);
        return id;
    }

    function enterChat() {
        const name = usernameInput.value.trim();
        if (!name) {
            alert('Please enter a username');
            return;
        }
        username = name;
        localStorage.setItem('username', username);
        localStorage.setItem('userColor', userColor);
        showChatScreen();
        setupOnlineStatus();
        listenForMessages();
    }

    function showChatScreen() {
        setupScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        currentUserDisplay.textContent = username;
        currentUserDisplay.style.color = userColor;
        messageInput.focus();
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        const messagesRef = window.ref(window.database, 'messages');
        window.push(messagesRef, {
            username: username,
            text: text,
            timestamp: Date.now(),
            userId: userId,
            userColor: userColor,
            isImage: false
        });

        messageInput.value = '';
        clearTypingStatus();
    }

    function displayMessage(message, messageId) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.userId === userId ? 'own' : 'other'}`;
        messageDiv.id = `msg-${messageId}`;

        const avatar = generateAvatar(message.username, message.userColor);
        const timestamp = formatTime(message.timestamp);

        let content = `
            <div class="message-avatar" style="background-color: ${message.userColor}">
                ${avatar}
            </div>
            <div class="message-bubble">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(message.username)}</span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
        `;

        if (message.isImage && message.imageUrl) {
            content += `<img src="${message.imageUrl}" class="message-image" alt="shared image">`;
        } else {
            content += `<div class="message-text">${linkifyText(escapeHtml(message.text))}</div>`;
        }

        content += `</div>`;
        messageDiv.innerHTML = content;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const messagesRef = window.ref(window.database, 'messages');

            window.push(messagesRef, {
                username: username,
                text: '',
                timestamp: Date.now(),
                userId: userId,
                userColor: userColor,
                isImage: true,
                imageUrl: base64
            });

            imageInput.value = '';
        };

        reader.readAsDataURL(file);
    }

    function handleTyping() {
        clearTimeout(typingTimeout);
        
        const typingRef = window.ref(window.database, `typing/${userId}`);
        window.firebaseUpdate(typingRef, { username: username, timestamp: Date.now() });

        typingTimeout = setTimeout(() => {
            clearTypingStatus();
        }, 3000);
    }

    function clearTypingStatus() {
        try {
            const typingRef = window.ref(window.database, `typing/${userId}`);
            window.firebaseUpdate(typingRef, null);
        } catch (e) {}
    }

    function setupOnlineStatus() {
        const userRef = window.ref(window.database, `online/${userId}`);
        window.firebaseUpdate(userRef, {
            username: username,
            timestamp: Date.now()
        });

        window.addEventListener('beforeunload', () => {
            window.firebaseUpdate(userRef, null);
        });

        // Listen to online users
        const onlineRef = window.ref(window.database, 'online');
        window.onChildAdded(onlineRef, (snapshot) => {
            onlineUsers.add(snapshot.key);
            updateOnlineCount();
        });

        window.onChildRemoved(onlineRef, (snapshot) => {
            onlineUsers.delete(snapshot.key);
            updateOnlineCount();
        });
    }

    function updateOnlineCount() {
        const onlineCount = document.querySelector('.online-count');
        if (onlineCount) {
            onlineCount.textContent = `Online: ${onlineUsers.size}`;
        }
    }

    function listenForMessages() {
        const messagesRef = window.ref(window.database, 'messages');
        window.onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val();
            if (message) {
                displayMessage(message, snapshot.key);
            }
        });

        // Listen for typing
        const typingRef = window.ref(window.database, 'typing');
        window.onChildAdded(typingRef, (snapshot) => {
            const typingUser = snapshot.val();
            if (typingUser && snapshot.key !== userId) {
                typingIndicator.classList.remove('hidden');
            }
        });

        window.onChildRemoved(typingRef, () => {
            typingIndicator.classList.add('hidden');
        });
    }

    function toggleTheme() {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        document.body.classList.toggle('dark-mode');
        themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    }

    function toggleEmojiPicker() {
        emojiPicker.classList.toggle('hidden');
    }

    function clearChat() {
        if (confirm('Are you sure you want to clear all messages?')) {
            chatMessages.innerHTML = '';
        }
    }

    function generateAvatar(name, color) {
        return name.charAt(0).toUpperCase();
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function linkifyText(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" style="color: var(--accent-color); text-decoration: underline;">$1</a>');
    }
});
