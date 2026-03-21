// Advanced Chat Application Script
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be ready
    const waitForFirebase = setInterval(() => {
        if (window.database && window.ref) {
            clearInterval(waitForFirebase);
            initializeApp();
        }
    }, 100);

    function initializeApp() {
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
        let typingUsers = new Set();
        let isInitialized = false;

        // Initialize theme
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀️';
        }

        if (username) {
            showChatScreen();
        }

        // Event Listeners - Setup
        enterChatBtn.addEventListener('click', enterChat);
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enterChat();
        });

        // Event Listeners - Chat
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('input', handleTyping);

        // Event Listeners - Controls
        themeToggle.addEventListener('click', toggleTheme);
        clearChatBtn.addEventListener('click', clearChat);
        emojiBtn.addEventListener('click', toggleEmojiPicker);
        imageBtn.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', handleImageUpload);

        // Color selectors
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

        document.addEventListener('click', (e) => {
            if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
                emojiPicker.classList.add('hidden');
            }
        });

        // ========== FUNCTIONS ==========

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
            isInitialized = true;
        }

        function showChatScreen() {
            setupScreen.classList.add('hidden');
            chatScreen.classList.remove('hidden');
            currentUserDisplay.textContent = username;
            currentUserDisplay.style.color = userColor;
            setTimeout(() => messageInput.focus(), 100);
        }

        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text || !isInitialized) return;

            try {
                const db = window.database;
                db.ref('messages').push({
                    username: username,
                    text: text,
                    timestamp: Date.now(),
                    userId: userId,
                    userColor: userColor,
                    isImage: false
                }, (error) => {
                    if (error) {
                        console.error('Error sending message:', error);
                        alert('Failed to send message. Check console.');
                    }
                });

                messageInput.value = '';
                clearTypingStatus();
            } catch (err) {
                console.error('Error sending message:', err);
            }
        }

        function handleImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const base64 = event.target.result;
                    const db = window.database;
                    
                    db.ref('messages').push({
                        username: username,
                        text: '📷 Shared an image',
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isImage: true,
                        imageUrl: base64
                    });

                    imageInput.value = '';
                } catch (err) {
                    console.error('Error uploading image:', err);
                }
            };

            reader.readAsDataURL(file);
        }

        function displayMessage(message) {
            if (!message) return;

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.userId === userId ? 'own' : 'other'}`;

            const avatar = generateAvatar(message.username);
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

        function handleTyping() {
            if (!isInitialized) return;

            clearTimeout(typingTimeout);
            
            try {
                const db = window.database;
                db.ref(`typing/${userId}`).set({ 
                    username: username, 
                    timestamp: Date.now(),
                    userId: userId
                });
            } catch (err) {
                console.error('Error updating typing status:', err);
            }

            typingTimeout = setTimeout(() => {
                clearTypingStatus();
            }, 3000);
        }

        function clearTypingStatus() {
            clearTimeout(typingTimeout);
            try {
                const db = window.database;
                db.ref(`typing/${userId}`).remove();
            } catch (e) {
                console.error('Error clearing typing status:', e);
            }
        }

        function setupOnlineStatus() {
            try {
                const db = window.database;
                const userRef = db.ref(`online/${userId}`);
                
                userRef.set({
                    username: username,
                    timestamp: Date.now()
                });

                window.addEventListener('beforeunload', () => {
                    try {
                        userRef.remove();
                        clearTypingStatus();
                    } catch (e) {}
                });

                // Listen to online users
                const onlineRef = db.ref('online');
                onlineRef.on('child_added', (snapshot) => {
                    onlineUsers.add(snapshot.key);
                    updateOnlineCount();
                });

                onlineRef.on('child_removed', (snapshot) => {
                    onlineUsers.delete(snapshot.key);
                    updateOnlineCount();
                });
            } catch (err) {
                console.error('Error setting up online status:', err);
            }
        }

        function updateOnlineCount() {
            const onlineCount = document.querySelector('.online-count');
            if (onlineCount) {
                onlineCount.textContent = `Online: ${onlineUsers.size}`;
            }
        }

        function listenForMessages() {
            try {
                const db = window.database;
                
                // Listen for messages
                const messagesRef = db.ref('messages');
                messagesRef.on('child_added', (snapshot) => {
                    const message = snapshot.val();
                    if (message) {
                        displayMessage(message);
                    }
                });

                // Listen for typing
                const typingRef = db.ref('typing');
                
                typingRef.on('child_added', (snapshot) => {
                    if (snapshot.key !== userId) {
                        typingUsers.add(snapshot.key);
                        updateTypingIndicator();
                    }
                });

                typingRef.on('child_removed', (snapshot) => {
                    typingUsers.delete(snapshot.key);
                    updateTypingIndicator();
                });
            } catch (err) {
                console.error('Error setting up listeners:', err);
            }
        }

        function updateTypingIndicator() {
            if (typingUsers.size > 0) {
                typingIndicator.classList.remove('hidden');
            } else {
                typingIndicator.classList.add('hidden');
            }
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

        function generateAvatar(name) {
            return (name && name.charAt(0).toUpperCase()) || '?';
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
    }
});
