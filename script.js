// Advanced Chat Application Script
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Chat app starting...');
    initializeApp();

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
        const imageBtn = document.getElementById('image-btn');
        const imageInput = document.getElementById('image-input');
        const voiceBtn = document.getElementById('voice-btn');
        const voiceRecordingUI = document.getElementById('voice-recording');
        const stopRecordingBtn = document.getElementById('stop-recording');
        const recordingTimeDisplay = document.getElementById('recording-time');
        const emojiPicker = document.getElementById('emoji-picker');
        const typingIndicator = document.getElementById('typing-indicator');
        const colorButtons = document.querySelectorAll('.color-btn');

        // State
        let username = localStorage.getItem('username') || '';
        let userColor = localStorage.getItem('userColor') || '#6C5CE7';
        let isDarkMode = localStorage.getItem('darkMode') === 'true';
        let typingTimeout;
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingStartTime = 0;
        let recordingTimer = null;
        let audioStream = null;
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
        if (enterChatBtn) enterChatBtn.addEventListener('click', enterChat);
        if (usernameInput) usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enterChat();
        });

        // Event Listeners - Chat
        if (sendButton) sendButton.addEventListener('click', sendMessage);
        if (messageInput) messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        if (messageInput) messageInput.addEventListener('input', handleTyping);

        const resetSessionBtn = document.getElementById('reset-session');

        // Event Listeners - Controls
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
        if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
        if (resetSessionBtn) resetSessionBtn.addEventListener('click', resetSession);
        if (emojiBtn) emojiBtn.addEventListener('click', () => {
            // Focus on message input to show emoji keyboard
            messageInput.focus();
        });
        if (imageBtn) imageBtn.addEventListener('click', () => imageInput.click());
        if (imageInput) imageInput.addEventListener('change', handleImageUpload);
        if (voiceBtn) voiceBtn.addEventListener('click', startVoiceRecording);
        if (stopRecordingBtn) stopRecordingBtn.addEventListener('click', stopVoiceRecording);

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

                // Disable send button while sending
                sendButton.disabled = true;
                const originalText = sendButton.textContent;
                sendButton.textContent = '⏳';

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
                    // Re-enable send button
                    sendButton.disabled = false;
                    sendButton.textContent = originalText;

                    if (error) {
                        console.error('❌ Error sending message:', error);
                        alert('Failed to send: ' + (error.message || 'Unknown error'));
                    } else {
                        console.log('✅ Message sent successfully');
                        messageInput.value = '';
                        messageInput.focus();
                        clearTypingStatus();
                    }
                });
            } catch (err) {
                console.error('Exception sending message:', err);
                sendButton.disabled = false;
                sendButton.textContent = originalText;
                alert('Error: ' + err.message);
            }
        }

        function handleImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file.');
                return;
            }

            // Disable the button while uploading
            imageBtn.disabled = true;
            const originalText = imageBtn.textContent;
            imageBtn.textContent = '⏳';

            // Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', window.CLOUDINARY_UPLOAD_PRESET);

            console.log('📤 Uploading image to Cloudinary...');

            fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) throw new Error('Upload failed: ' + response.statusText);
                return response.json();
            })
            .then(data => {
                console.log('✅ Image uploaded:', data.secure_url);

                const db = window.database;
                db.ref('messages').push({
                    username: username,
                    text: '📷 Shared an image',
                    timestamp: Date.now(),
                    userId: userId,
                    userColor: userColor,
                    isMedia: true,
                    mediaType: 'image',
                    mediaUrl: data.secure_url
                }, (error) => {
                    // Re-enable button
                    imageBtn.disabled = false;
                    imageBtn.textContent = originalText;

                    if (error) {
                        console.error('Error saving message:', error);
                        alert('Error saving message: ' + error.message);
                    } else {
                        console.log('✅ Message saved');
                        imageInput.value = '';
                    }
                });
            })
            .catch((error) => {
                console.error('❌ Upload error:', error);
                imageBtn.disabled = false;
                imageBtn.textContent = originalText;
                alert('Upload failed: ' + error.message);
                imageInput.value = '';
            });
        }

        async function startVoiceRecording() {
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(audioStream);
                audioChunks = [];
                recordingStartTime = Date.now();

                mediaRecorder.ondataavailable = (e) => {
                    audioChunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    // Stop all audio tracks to turn off the microphone
                    if (audioStream) {
                        audioStream.getTracks().forEach(track => track.stop());
                    }
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    sendVoiceMessage(audioBlob);
                };

                mediaRecorder.start();
                voiceRecordingUI.classList.remove('hidden');
                voiceBtn.classList.add('hidden');
                startRecordingTimer();
                console.log('🎤 Voice recording started');
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Please allow microphone access to record voice messages.');
            }
        }

        function stopVoiceRecording() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            
            // Always close the audio stream to turn off the microphone
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            voiceRecordingUI.classList.add('hidden');
            voiceBtn.classList.remove('hidden');
            clearInterval(recordingTimer);
            console.log('⏹️ Voice recording stopped and microphone turned off');
        }

        function startRecordingTimer() {
            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                recordingTimeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }, 100);
        }

        function sendVoiceMessage(audioBlob) {
            const formData = new FormData();
            formData.append('file', audioBlob, 'voice_message.wav');
            formData.append('upload_preset', window.CLOUDINARY_UPLOAD_PRESET);

            console.log('📤 Uploading voice message to Cloudinary...');

            fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                console.log('✅ Voice message uploaded:', data.secure_url);

                const db = window.database;
                db.ref('messages').push({
                    username: username,
                    text: '🎵 Sent a voice message',
                    timestamp: Date.now(),
                    userId: userId,
                    userColor: userColor,
                    isMedia: true,
                    mediaType: 'audio',
                    mediaUrl: data.secure_url
                }, (error) => {
                    if (error) {
                        console.error('Error saving voice message:', error);
                    } else {
                        console.log('✅ Voice message saved');
                    }
                });
            })
            .catch((error) => {
                console.error('❌ Voice upload error:', error);
                alert('Failed to send voice message: ' + error.message);
            });
        }

        function displayMessage(message) {
            if (!message) return;

            // Smart auto-scroll: only scroll if already near bottom
            const atBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;

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

            if (atBottom) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
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
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            // Format the time of day (HH:MM AM/PM)
            const timeOfDay = date.toLocaleTimeString('en-US', { 
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

            // Format the relative time
            let relativeTime;
            if (diffMins < 1) {
                relativeTime = 'now';
            } else if (diffMins < 60) {
                relativeTime = `${diffMins}m ago`;
            } else if (diffHours < 24) {
                relativeTime = `${diffHours}h ago`;
            } else if (diffDays === 1) {
                relativeTime = 'yesterday';
            } else if (diffDays < 7) {
                relativeTime = `${diffDays}d ago`;
            } else {
                relativeTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }

            return `${timeOfDay} ${relativeTime}`;
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
