// Advanced Chat Application Script
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Chat app starting...');
    
    // Wait for Firebase to be ready
    const waitForFirebase = setInterval(() => {
        if (window.firebaseReady && window.database) {
            clearInterval(waitForFirebase);
            console.log('✅ Firebase ready, initializing app...');
            initializeApp();
        }
    }, 100);
    
    // Failsafe: initialize after 5 seconds even if not ready
    setTimeout(() => {
        if (!window.firebaseReady) {
            console.log('⚠️ Firebase timeout, initializing anyway');
            window.database = window.database || {};
            initializeApp();
        }
    }, 5000);

    function initializeApp() {
        console.log('🚀 App initializing...');
        console.log('firebase ready:', !!window.firebaseReady);
        console.log('database ready:', !!window.database);
        
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
        const mediaBtn = document.getElementById('media-btn');
        const mediaInput = document.getElementById('media-input');
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

        console.log('💾 User ID:', userId);

        // Initialize theme
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            themeToggle.textContent = '☀️';
        }

        if (username) {
            showChatScreen();
            setupOnlineStatus();
            listenForMessages();
            isInitialized = true;
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

        const resetSessionBtn = document.getElementById('reset-session');

        // Event Listeners - Controls
        themeToggle.addEventListener('click', toggleTheme);
        clearChatBtn.addEventListener('click', clearChat);
        resetSessionBtn.addEventListener('click', resetSession);
        emojiBtn.addEventListener('click', () => {
            // Focus on message input to show emoji keyboard
            messageInput.focus();
        });
        mediaBtn.addEventListener('click', () => mediaInput.click());
        mediaInput.addEventListener('change', handleMediaUpload);

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

        // Emoji Picker removed - use emoji keyboard instead
        emojiBtn.addEventListener('click', () => {
            // Open system emoji picker (works on most devices)
            messageInput.focus();
            const emojiMenu = document.createElement('div');
            emojiMenu.style.position = 'absolute';
            emojiMenu.style.bottom = '100px';
            emojiMenu.style.right = '20px';
            emojiMenu.style.zIndex = '9999';
            emojiPicker.classList.add('hidden'); // Hide in case it exists
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
            
            if (!window.database) {
                alert('Chat is loading. Please wait a moment and try again.');
                console.error('Firebase database not ready');
                return;
            }
            
            username = name;
            localStorage.setItem('username', username);
            localStorage.setItem('userColor', userColor);
            
            try {
                console.log('👤 User entering chat:', username);
                showChatScreen();
                setupOnlineStatus();
                listenForMessages();
                isInitialized = true;
                console.log('✅ Chat ready!');
            } catch (err) {
                console.error('Error entering chat:', err);
                alert('Error entering chat: ' + err.message);
            }
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
            if (!text || !isInitialized) {
                console.log('Cannot send message - text empty or not initialized');
                return;
            }

            try {
                const db = window.database;
                if (!db) {
                    alert('Database not connected');
                    return;
                }

                console.log('📤 Sending message:', text);
                
                const messageData = {
                    username: username,
                    text: text,
                    timestamp: Date.now(),
                    userId: userId,
                    userColor: userColor,
                    isMedia: false
                };

                db.ref('messages').push(messageData, function(error) {
                    if (error) {
                        console.error('❌ Error sending message:', error);
                        console.error('Error code:', error.code);
                        console.error('Error message:', error.message);
                        alert('Failed to send message: ' + error.message);
                    } else {
                        console.log('✅ Message sent successfully');
                        messageInput.value = '';
                        clearTypingStatus();
                    }
                });
            } catch (err) {
                console.error('Exception sending message:', err);
                alert('Exception: ' + err.message);
            }
        }

        function handleMediaUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            const fileType = file.type;
            let mediaType = 'unknown';

            if (fileType.startsWith('image/')) {
                mediaType = 'image';
            } else if (fileType.startsWith('video/')) {
                mediaType = 'video';
            } else if (fileType.startsWith('audio/')) {
                mediaType = 'audio';
            }

            if (mediaType === 'unknown') {
                alert('Unsupported file type. Please upload an image, video, or audio file.');
                return;
            }

            // Upload to Cloud Storage
            try {
                const storage = window.storage;
                if (!storage) {
                    alert('Storage not available');
                    return;
                }

                // Create a unique path for the file
                const timestamp = Date.now();
                const fileName = `${mediaType}/${userId}-${timestamp}-${file.name}`;
                const storageRef = storage.ref(fileName);

                console.log('📤 Uploading to Cloud Storage:', fileName);

                storageRef.put(file).then((snapshot) => {
                    return snapshot.ref.getDownloadURL();
                }).then((downloadURL) => {
                    console.log('✅ Upload complete, URL:', downloadURL);

                    const db = window.database;
                    db.ref('messages').push({
                        username: username,
                        text: mediaType === 'image' ? '📷 Shared an image' : mediaType === 'video' ? '🎬 Shared a video' : '🎵 Shared audio',
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isMedia: true,
                        mediaType: mediaType,
                        mediaUrl: downloadURL
                    }, (error) => {
                        if (error) {
                            console.error('Error saving message:', error);
                            alert('Error saving message: ' + error.message);
                        } else {
                            console.log('✅ Message saved');
                        }
                    });

                    mediaInput.value = '';
                }).catch((error) => {
                    console.error('❌ Upload error:', error);
                    alert('Upload failed: ' + error.message);
                    mediaInput.value = '';
                });
            } catch (err) {
                console.error('Error preparing upload:', err);
                alert('Error: ' + err.message);
            }
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

            if (message.isMedia && message.mediaUrl) {
                if (message.mediaType === 'image') {
                    content += `<img src="${message.mediaUrl}" class="message-image" alt="shared image">`;
                } else if (message.mediaType === 'video') {
                    content += `<video controls class="message-video"><source src="${message.mediaUrl}" type="video/mp4">Your browser does not support video playback.</video>`;
                } else if (message.mediaType === 'audio') {
                    content += `<audio controls class="message-audio"><source src="${message.mediaUrl}" type="audio/mpeg">Your browser does not support audio playback.</audio>`;
                } else {
                    content += `<div class="message-text">${linkifyText(escapeHtml(message.text))}</div>`;
                }
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
                }, function(error) {
                    if (error) {
                        console.error('Error setting typing status:', error);
                    } else {
                        console.log('✏️ Typing indicator set');
                    }
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
                db.ref(`typing/${userId}`).remove(function(error) {
                    if (error) {
                        console.error('Error clearing typing:', error);
                    }
                });
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
                }, function(error) {
                    if (error) {
                        console.error('Error setting online status:', error);
                    } else {
                        console.log('🟢 Online status set');
                    }
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
                    console.log('👤 User online:', snapshot.key);
                });

                onlineRef.on('child_removed', (snapshot) => {
                    onlineUsers.delete(snapshot.key);
                    updateOnlineCount();
                    console.log('👤 User offline:', snapshot.key);
                });
            } catch (err) {
                console.error('Error setting up online status:', err);
            }
        }

        function updateOnlineCount() {
            const onlineCount = document.querySelector('.online-count');
            if (onlineCount) {
                onlineCount.textContent = `Online: ${onlineUsers.size}`;
                console.log('👥 Online count:', onlineUsers.size);
            }
        }

        function listenForMessages() {
            try {
                const db = window.database;
                
                // Listen for messages
                const messagesRef = db.ref('messages');
                messagesRef.on('child_added', (snapshot) => {
                    const message = snapshot.val();
                    console.log('💬 New message received:', message);
                    if (message) {
                        displayMessage(message);
                    }
                });

                console.log('👂 Message listener set up');

                // Listen for typing
                const typingRef = db.ref('typing');
                
                typingRef.on('child_added', (snapshot) => {
                    if (snapshot.key !== userId) {
                        typingUsers.add(snapshot.key);
                        updateTypingIndicator();
                        console.log('✏️ User typing:', snapshot.key);
                    }
                });

                typingRef.on('child_removed', (snapshot) => {
                    typingUsers.delete(snapshot.key);
                    updateTypingIndicator();
                    console.log('⏹️ User stopped typing:', snapshot.key);
                });

                console.log('👂 Typing listener set up');
            } catch (err) {
                console.error('Error setting up listeners:', err);
            }
        }

        function updateTypingIndicator() {
            if (typingUsers.size > 0) {
                typingIndicator.classList.remove('hidden');
                console.log('👁️ Showing typing indicator');
            } else {
                typingIndicator.classList.add('hidden');
                console.log('👁️ Hiding typing indicator');
            }
        }

        function toggleTheme() {
            isDarkMode = !isDarkMode;
            localStorage.setItem('darkMode', isDarkMode);
            document.body.classList.toggle('dark-mode');
            themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
        }

        function clearChat() {
            if (confirm('Are you sure you want to clear all messages?')) {
                chatMessages.innerHTML = '';
            }
        }

        function resetSession() {
            if (!confirm('Reset local data and reconnect?')) return;
            localStorage.removeItem('username');
            localStorage.removeItem('userColor');
            localStorage.removeItem('darkMode');
            localStorage.removeItem('userId');
            location.reload();
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
