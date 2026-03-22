// Advanced Chat Application Script
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Chat app starting...');
    
    // YouTube Player instances cache
    window.youtubePlayers = new Map();
    
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
        const soundToggle = document.getElementById('sound-enabled');
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
        let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
        let currentReply = null;
        let currentEdit = null;
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
        if (soundToggle) {
            soundToggle.checked = soundEnabled;
            soundToggle.addEventListener('change', (e) => {
                soundEnabled = e.target.checked;
                localStorage.setItem('soundEnabled', soundEnabled);
            });
        }

        // Event Listeners - Chat
        if (sendButton) sendButton.addEventListener('click', () => {
            if (currentEdit) {
                saveEditedMessage();
            } else {
                sendMessage();
            }
        });
        
        if (messageInput) messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (currentEdit) {
                    saveEditedMessage();
                } else {
                    sendMessage();
                }
            }
        });

        if (messageInput) messageInput.addEventListener('input', handleTyping);

        const resetSessionBtn = document.getElementById('reset-session');

        // Event Listeners - Controls
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
        if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
        if (resetSessionBtn) resetSessionBtn.addEventListener('click', resetSession);
        if (emojiBtn) emojiBtn.addEventListener('click', () => {
            messageInput.focus();
        });
        if (imageBtn) imageBtn.addEventListener('click', () => imageInput.click());
        if (imageInput) imageInput.addEventListener('change', handleImageUpload);
        if (voiceBtn) voiceBtn.addEventListener('click', startVoiceRecording);
        if (stopRecordingBtn) stopRecordingBtn.addEventListener('click', stopVoiceRecording);

        // Event delegation for reply, edit, and delete buttons
        if (chatMessages) chatMessages.addEventListener('click', (e) => {
            const messageElement = e.target.closest('.message');
            if (!messageElement) return;
            
            const messageId = messageElement.id.replace('message-', '');
            
            // Reply button
            if (e.target.classList.contains('reply-btn')) {
                const replyUsername = messageElement.querySelector('.message-username').textContent;
                const messageText = messageElement.querySelector('.message-text')?.textContent || '[Media]';
                startReply(messageId, replyUsername, messageText, messageElement);
            }
            
            // Edit button (only for own messages)
            if (e.target.classList.contains('edit-btn')) {
                const messageData = getMessageDataById(messageId);
                if (messageData && messageData.userId === userId) {
                    startEdit(messageId, messageData.text, messageElement);
                }
            }
            
            // Delete button (only for own messages)
            if (e.target.classList.contains('delete-btn')) {
                const messageData = getMessageDataById(messageId);
                if (messageData && messageData.userId === userId) {
                    deleteMessage(messageId);
                }
            }
        });

        // Event delegation for clicking on reply previews in messages
        if (chatMessages) chatMessages.addEventListener('click', (e) => {
            const replyPreview = e.target.closest('.message-reply');
            if (replyPreview) {
                const messageElement = replyPreview.closest('.message');
                if (messageElement) {
                    const messageId = messageElement.id.replace('message-', '');
                    const messageData = getMessageDataById(messageId);
                    if (messageData && messageData.replyTo && messageData.replyTo.id) {
                        scrollToMessage(`message-${messageData.replyTo.id}`);
                    }
                }
                e.stopPropagation();
            }
        });

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
                if (currentUserDisplay) {
                    currentUserDisplay.style.color = userColor;
                }
            });
        });

        // Store messages data for reference
        let messagesCache = new Map();

        // ========== LOAD YOUTUBE IFrame API ==========
        function loadYouTubeAPI() {
            if (window.YT && window.YT.Player) {
                console.log('✅ YouTube API already loaded');
                return Promise.resolve();
            }
            
            return new Promise((resolve, reject) => {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                const firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                
                window.onYouTubeIframeAPIReady = () => {
                    console.log('✅ YouTube IFrame API ready');
                    resolve();
                };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!window.YT) {
                        reject(new Error('YouTube API load timeout'));
                    }
                }, 10000);
            });
        }

        // Call this when chat starts
        loadYouTubeAPI().catch(err => console.warn('YouTube API load failed:', err));

        // ========== IMPROVED LINK PREVIEW FUNCTIONS WITH YOUTUBE API ==========

        function extractYouTubeId(url) {
            if (!url) return null;
            
            const patterns = [
                /(?:youtube\.com\/watch\?v=)([\w-]+)/i,
                /(?:youtube\.com\/embed\/)([\w-]+)/i,
                /(?:youtube\.com\/v\/)([\w-]+)/i,
                /(?:youtube\.com\/live\/)([\w-]+)/i,
                /(?:youtu\.be\/)([\w-]+)/i,
                /(?:youtube\.com\/shorts\/)([\w-]+)/i,
                /(?:youtube\.com\/watch\?.*v=)([\w-]+)/i
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    console.log('🎯 YouTube ID extracted:', match[1], 'from URL:', url);
                    return match[1];
                }
            }
            
            return null;
        }

        // NEW FUNCTION: Extract direct image URL from search result URLs (Bing, Google, etc.)
        function extractDirectImageUrl(url) {
            if (!url) return null;
            
            // Try to extract mediaurl parameter from Bing URLs
            const bingMatch = url.match(/[?&]mediaurl=([^&]+)/i);
            if (bingMatch) {
                const decodedUrl = decodeURIComponent(bingMatch[1]);
                console.log('🔍 Extracted Bing image URL:', decodedUrl);
                return decodedUrl;
            }
            
            // Try to extract imgurl parameter from Google Images
            const googleMatch = url.match(/[?&]imgurl=([^&]+)/i);
            if (googleMatch) {
                const decodedUrl = decodeURIComponent(googleMatch[1]);
                console.log('🔍 Extracted Google image URL:', decodedUrl);
                return decodedUrl;
            }
            
            // Try to extract imgurl parameter from other image search engines
            const imgurMatch = url.match(/[?&]imgurl=([^&]+)/i);
            if (imgurMatch) {
                const decodedUrl = decodeURIComponent(imgurMatch[1]);
                console.log('🔍 Extracted image URL:', decodedUrl);
                return decodedUrl;
            }
            
            // Try to extract direct image URL from common patterns
            const directImageMatch = url.match(/(https?:\/\/[^\s]+?\.(jpg|jpeg|png|gif|webp|bmp|svg))/i);
            if (directImageMatch && !url.includes('bing.com') && !url.includes('google.com')) {
                console.log('🔍 Extracted direct image URL:', directImageMatch[1]);
                return directImageMatch[1];
            }
            
            return null;
        }

        function detectAndProcessLinks(text) {
            if (!text) return { processedText: text, mediaEmbed: null };
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = text.match(urlRegex);
            
            if (matches) {
                for (const url of matches) {
                    // Check for YouTube
                    const videoId = extractYouTubeId(url);
                    if (videoId) {
                        let processedText = text.replace(url, '').trim();
                        if (!processedText) {
                            processedText = '📺 Shared a YouTube video';
                        }
                        
                        console.log('🎬 YouTube video detected:', videoId);
                        
                        return {
                            processedText: processedText,
                            mediaEmbed: {
                                type: 'youtube',
                                videoId: videoId,
                                originalUrl: url
                            }
                        };
                    }
                    
                    // NEW: Extract direct image URL from search result URLs (Bing, Google, etc.)
                    const directImageUrl = extractDirectImageUrl(url);
                    if (directImageUrl) {
                        let processedText = text.replace(url, '').trim();
                        if (!processedText) {
                            processedText = '🖼️ Shared an image';
                        }
                        
                        console.log('🖼️ Image detected from search URL:', directImageUrl);
                        
                        return {
                            processedText: processedText,
                            mediaEmbed: {
                                type: 'image',
                                url: directImageUrl
                            }
                        };
                    }
                    
                    // Check for direct image/GIF links (URL ends with image extension)
                    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
                        let processedText = text.replace(url, '').trim();
                        if (!processedText) {
                            processedText = '🖼️ Shared an image';
                        }
                        
                        console.log('🖼️ Direct image detected:', url);
                        
                        return {
                            processedText: processedText,
                            mediaEmbed: {
                                type: 'image',
                                url: url
                            }
                        };
                    }
                }
            }
            
            return { processedText: text, mediaEmbed: null };
        }

        function createYouTubePlayer(containerId, videoId, messageId) {
            if (!window.YT || !window.YT.Player) {
                console.log('⏳ YouTube API not ready, loading...');
                loadYouTubeAPI().then(() => {
                    createYouTubePlayer(containerId, videoId, messageId);
                }).catch(err => {
                    console.error('Failed to load YouTube API:', err);
                    const container = document.getElementById(containerId);
                    if (container) {
                        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">❌ Failed to load YouTube player</div>';
                    }
                });
                return;
            }
            
            // Check if player already exists for this message
            if (window.youtubePlayers.has(messageId)) {
                return;
            }
            
            try {
                const player = new YT.Player(containerId, {
                    height: '100%',
                    width: '100%',
                    videoId: videoId,
                    playerVars: {
                        'playsinline': 1,
                        'modestbranding': 1,
                        'rel': 0,
                        'controls': 1,
                        'origin': window.location.origin,
                        'enablejsapi': 1
                    },
                    events: {
                        'onReady': (event) => {
                            console.log(`🎬 YouTube player ready for message ${messageId}`);
                        },
                        'onStateChange': (event) => {
                            console.log(`YouTube player state changed: ${event.data}`);
                        },
                        'onError': (event) => {
                            console.error(`YouTube player error: ${event.data}`);
                            const container = document.getElementById(containerId);
                            if (container) {
                                let errorMessage = 'Unable to play video';
                                if (event.data === 2) {
                                    errorMessage = 'Invalid video ID';
                                } else if (event.data === 100) {
                                    errorMessage = 'Video not found';
                                } else if (event.data === 101 || event.data === 150) {
                                    errorMessage = 'Video cannot be played in embedded player';
                                }
                                container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ff4444;">❌ ${errorMessage}</div>`;
                            }
                        }
                    }
                });
                
                window.youtubePlayers.set(messageId, player);
                console.log(`✅ YouTube player created for message ${messageId}`);
            } catch (err) {
                console.error('Error creating YouTube player:', err);
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">❌ Failed to create YouTube player</div>';
                }
            }
        }

        function createMediaEmbed(embedData, messageId) {
            if (!embedData) return '';
            
            switch (embedData.type) {
                case 'youtube':
                    const videoId = embedData.videoId;
                    if (!videoId) return '<div class="embed-error" style="padding: 8px; background: rgba(255,0,0,0.1); border-radius: 8px; color: #ff4444; margin-top: 8px;">❌ Invalid YouTube URL</div>';
                    
                    const containerId = `youtube-container-${messageId}`;
                    
                    // Store the container ID for later initialization
                    setTimeout(() => {
                        createYouTubePlayer(containerId, videoId, messageId);
                    }, 100);
                    
                    return `
                        <div class="media-embed youtube-embed" style="margin: 8px 0; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
                            <div id="${containerId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
                        </div>
                    `;
                case 'image':
                    return `
                        <div class="media-embed image-embed" style="margin: 8px 0;">
                            <img 
                                src="${embedData.url}" 
                                alt="Shared image" 
                                style="max-width: 100%; max-height: 400px; border-radius: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s ease;" 
                                loading="lazy" 
                                onclick="window.open('${embedData.url}', '_blank')"
                                onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 8px; background: rgba(255,0,0,0.1); border-radius: 8px; color: #ff4444;\\'>❌ Failed to load image</div>'"
                            >
                        </div>
                    `;
                default:
                    return '';
            }
        }

        function linkifyAndProcessText(text) {
            if (!text) return '';
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const linkedText = text.replace(urlRegex, (url) => {
                // Skip YouTube URLs, image URLs, and search URLs that contain images
                if (extractYouTubeId(url) || 
                    url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
                    extractDirectImageUrl(url)) {
                    return '';
                }
                return `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;" rel="noopener noreferrer">${url}</a>`;
            });
            
            return linkedText;
        }

        // ========== EXISTING FUNCTIONS ==========

        function generateUserId() {
            const id = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', id);
            return id;
        }

        function getMessageDataById(messageId) {
            return messagesCache.get(messageId);
        }

        function storeMessageData(messageId, messageData) {
            messagesCache.set(messageId, messageData);
        }

        function updateMessageInCache(messageId, updatedData) {
            const existing = messagesCache.get(messageId);
            if (existing) {
                messagesCache.set(messageId, { ...existing, ...updatedData });
            }
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
            localStorage.setItem('soundEnabled', soundEnabled);
            
            try {
                console.log('👤 User entering chat:', username);
                showChatScreen();
                setupOnlineStatus();
                listenForMessages();
                isInitialized = true;
                console.log('✅ Chat ready!');
                
                // Preload YouTube API
                loadYouTubeAPI().catch(err => console.warn('YouTube API preload failed:', err));
            } catch (err) {
                console.error('Error entering chat:', err);
                alert('Error entering chat: ' + err.message);
            }
        }

        function showChatScreen() {
            if (setupScreen && chatScreen) {
                setupScreen.classList.add('hidden');
                chatScreen.classList.remove('hidden');
                if (currentUserDisplay) {
                    currentUserDisplay.textContent = username;
                    currentUserDisplay.style.color = userColor;
                }
                setTimeout(() => messageInput && messageInput.focus(), 100);
            }
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

                const originalText = sendButton.textContent;
                sendButton.disabled = true;
                sendButton.textContent = '⏳';

                const { processedText, mediaEmbed } = detectAndProcessLinks(text);
                
                console.log('📝 Processed message:', { originalText: text, processedText, mediaEmbed });

                const messageData = {
                    username: username,
                    text: processedText,
                    originalText: text,
                    timestamp: Date.now(),
                    userId: userId,
                    userColor: userColor,
                    replyTo: currentReply ? {
                        id: currentReply.id,
                        username: currentReply.username,
                        text: currentReply.text
                    } : null,
                    isDeleted: false,
                    isEdited: false,
                    editHistory: [],
                    mediaEmbed: mediaEmbed
                };

                db.ref('messages').push(messageData, function(error) {
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
                        cancelReply();
                    }
                });
            } catch (err) {
                console.error('Exception sending message:', err);
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.textContent = '📤';
                }
                alert('Error: ' + err.message);
            }
        }

        function startEdit(messageId, currentText, messageElement) {
            if (currentReply) {
                cancelReply();
            }
            
            currentEdit = {
                id: messageId,
                originalText: currentText,
                element: messageElement
            };
            
            messageInput.value = currentText;
            messageInput.focus();
            sendButton.textContent = '✏️ Update';
            updateEditPreview();
            
            messageElement.style.transition = 'background-color 0.3s';
            messageElement.style.backgroundColor = 'rgba(108, 92, 231, 0.2)';
        }

        function updateEditPreview() {
            const existingPreview = document.querySelector('.current-edit-preview');
            if (existingPreview) {
                existingPreview.remove();
            }

            if (currentEdit && messageInput) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'current-edit-preview';
                previewDiv.innerHTML = `
                    <div class="edit-content" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background-color: rgba(255, 193, 7, 0.1); border-radius: 8px; margin-bottom: 8px;">
                        <span class="edit-label" style="font-size: 12px; color: #ffc107;">✏️ Editing message:</span>
                        <span class="edit-text" style="font-size: 12px; color: var(--text-secondary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(currentEdit.originalText.substring(0, 50))}${currentEdit.originalText.length > 50 ? '...' : ''}</span>
                        <button class="cancel-edit" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0 4px;" title="Cancel edit">✕</button>
                    </div>
                `;

                const cancelBtn = previewDiv.querySelector('.cancel-edit');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        cancelEdit();
                    });
                }

                const inputArea = document.querySelector('.input-area');
                if (inputArea && inputArea.parentNode) {
                    inputArea.parentNode.insertBefore(previewDiv, inputArea);
                }
            }
        }

        function cancelEdit() {
            if (currentEdit && currentEdit.element) {
                currentEdit.element.style.backgroundColor = '';
            }
            currentEdit = null;
            messageInput.value = '';
            sendButton.textContent = '📤 Send';
            const editPreview = document.querySelector('.current-edit-preview');
            if (editPreview) {
                editPreview.remove();
            }
        }

        function saveEditedMessage() {
            const newText = messageInput.value.trim();
            if (!newText || !currentEdit) return;
            
            if (newText === currentEdit.originalText) {
                cancelEdit();
                return;
            }
            
            try {
                const db = window.database;
                if (!db) {
                    alert('Database not connected');
                    return;
                }
                
                const originalText = sendButton.textContent;
                sendButton.disabled = true;
                sendButton.textContent = '⏳';
                
                const { processedText, mediaEmbed } = detectAndProcessLinks(newText);
                
                const messageRef = db.ref(`messages/${currentEdit.id}`);
                messageRef.once('value', (snapshot) => {
                    const messageData = snapshot.val();
                    if (messageData && messageData.userId === userId) {
                        const updatedData = {
                            text: processedText,
                            originalText: newText,
                            isEdited: true,
                            lastEdited: Date.now(),
                            mediaEmbed: mediaEmbed,
                            editHistory: [...(messageData.editHistory || []), {
                                text: messageData.text,
                                timestamp: Date.now()
                            }]
                        };
                        
                        messageRef.update(updatedData, (error) => {
                            sendButton.disabled = false;
                            sendButton.textContent = originalText;
                            
                            if (error) {
                                console.error('Error updating message:', error);
                                alert('Failed to update message: ' + error.message);
                            } else {
                                console.log('✅ Message updated successfully');
                                cancelEdit();
                                messageInput.focus();
                            }
                        });
                    } else {
                        sendButton.disabled = false;
                        sendButton.textContent = originalText;
                        alert('You can only edit your own messages');
                        cancelEdit();
                    }
                });
            } catch (err) {
                console.error('Error saving edited message:', err);
                sendButton.disabled = false;
                sendButton.textContent = '📤';
                alert('Error: ' + err.message);
            }
        }

        function deleteMessage(messageId) {
            if (!confirm('Are you sure you want to delete this message?')) return;
            
            try {
                const db = window.database;
                if (!db) {
                    alert('Database not connected');
                    return;
                }
                
                const messageRef = db.ref(`messages/${messageId}`);
                messageRef.once('value', (snapshot) => {
                    const messageData = snapshot.val();
                    if (messageData && messageData.userId === userId) {
                        // Clean up YouTube player if it exists
                        if (window.youtubePlayers.has(messageId)) {
                            const player = window.youtubePlayers.get(messageId);
                            if (player && player.destroy) {
                                player.destroy();
                            }
                            window.youtubePlayers.delete(messageId);
                        }
                        
                        messageRef.update({
                            isDeleted: true,
                            text: '🗑️ This message was deleted',
                            deletedAt: Date.now(),
                            originalText: messageData.text,
                            mediaEmbed: null
                        }, (error) => {
                            if (error) {
                                console.error('Error deleting message:', error);
                                alert('Failed to delete message: ' + error.message);
                            } else {
                                console.log('✅ Message deleted successfully');
                                if (currentEdit && currentEdit.id === messageId) {
                                    cancelEdit();
                                }
                            }
                        });
                    } else {
                        alert('You can only delete your own messages');
                    }
                });
            } catch (err) {
                console.error('Error deleting message:', err);
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

            if (imageBtn) imageBtn.disabled = true;
            const originalText = imageBtn ? imageBtn.textContent : '📷';
            if (imageBtn) imageBtn.textContent = '⏳';

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
                if (db) {
                    db.ref('messages').push({
                        username: username,
                        text: '📷 Shared an image',
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isMedia: true,
                        mediaType: 'image',
                        mediaUrl: data.secure_url,
                        isDeleted: false,
                        isEdited: false
                    }, (error) => {
                        if (imageBtn) {
                            imageBtn.disabled = false;
                            imageBtn.textContent = originalText;
                        }

                        if (error) {
                            console.error('Error saving message:', error);
                            alert('Error saving message: ' + error.message);
                        } else {
                            console.log('✅ Message saved');
                            if (imageInput) imageInput.value = '';
                        }
                    });
                }
            })
            .catch((error) => {
                console.error('❌ Upload error:', error);
                if (imageBtn) {
                    imageBtn.disabled = false;
                    imageBtn.textContent = originalText;
                }
                alert('Upload failed: ' + error.message);
                if (imageInput) imageInput.value = '';
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
                    if (audioStream) {
                        audioStream.getTracks().forEach(track => track.stop());
                    }
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    sendVoiceMessage(audioBlob);
                };

                mediaRecorder.start();
                if (voiceRecordingUI) voiceRecordingUI.classList.remove('hidden');
                if (voiceBtn) voiceBtn.classList.add('hidden');
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
            
            if (audioStream) {
                audioStream.getTracks().forEach(track => track.stop());
                audioStream = null;
            }
            
            if (voiceRecordingUI) voiceRecordingUI.classList.add('hidden');
            if (voiceBtn) voiceBtn.classList.remove('hidden');
            if (recordingTimer) clearInterval(recordingTimer);
            console.log('⏹️ Voice recording stopped and microphone turned off');
        }

        function startRecordingTimer() {
            if (recordingTimer) clearInterval(recordingTimer);
            recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                if (recordingTimeDisplay) {
                    recordingTimeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
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
                if (db) {
                    db.ref('messages').push({
                        username: username,
                        text: '🎵 Sent a voice message',
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isMedia: true,
                        mediaType: 'audio',
                        mediaUrl: data.secure_url,
                        isDeleted: false,
                        isEdited: false
                    }, (error) => {
                        if (error) {
                            console.error('Error saving voice message:', error);
                        } else {
                            console.log('✅ Voice message saved');
                        }
                    });
                }
            })
            .catch((error) => {
                console.error('❌ Voice upload error:', error);
                alert('Failed to send voice message: ' + error.message);
            });
        }

        function displayMessage(message, options = {}) {
            if (!message || !chatMessages) return;

            console.log('💬 Displaying message:', {
                id: message.id,
                text: message.text,
                mediaEmbed: message.mediaEmbed,
                isDeleted: message.isDeleted
            });

            if (message.id) {
                storeMessageData(message.id, message);
            }

            const atBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;

            const messageDiv = document.createElement('div');
            const messageId = message.id || message.timestamp;
            messageDiv.className = `message ${message.userId === userId ? 'own' : 'other'}`;
            messageDiv.id = `message-${messageId}`;
            messageDiv.setAttribute('data-temp-id', message.timestamp);

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
                        <div class="message-actions">`;

            if (message.userId === userId && !message.isDeleted) {
                content += `
                    <button class="edit-btn" title="Edit message">✏️</button>
                    <button class="delete-btn" title="Delete message">🗑️</button>`;
            }
            
            if (!message.isDeleted) {
                content += `<button class="reply-btn" title="Reply to this message">🗨️</button>`;
            }
            
            content += `</div>
                    </div>`;

            if (message.replyTo && !message.isDeleted) {
                content += `
                    <div class="message-reply" data-reply-id="${message.replyTo.id}" style="cursor: pointer;" title="Click to view original message">
                        <div class="reply-line"></div>
                        <div class="reply-info">
                            <span class="reply-username">↩️ ${escapeHtml(message.replyTo.username || 'Unknown')}</span>
                            <span class="reply-preview">${escapeHtml(message.replyTo.text || '[No preview]')}</span>
                        </div>
                    </div>`;
            }

            if (message.isMedia && !message.isDeleted) {
                if (message.mediaType === 'image') {
                    content += `<img src="${message.mediaUrl}" alt="Shared image" class="message-image" loading="lazy" style="max-width: 100%; max-height: 400px; border-radius: 12px; margin-top: 8px;">`;
                } else if (message.mediaType === 'video') {
                    content += `<video controls class="message-video" style="max-width: 100%; border-radius: 12px; margin-top: 8px;"><source src="${message.mediaUrl}" type="video/mp4">Your browser does not support video playback.</video>`;
                } else if (message.mediaType === 'audio') {
                    content += `<audio controls class="message-audio" style="width: 100%; margin-top: 8px;"><source src="${message.mediaUrl}" type="audio/mpeg">Your browser does not support audio playback.</audio>`;
                }
            }

            if (message.mediaEmbed && !message.isDeleted) {
                console.log('🎨 Creating media embed for:', message.mediaEmbed);
                content += createMediaEmbed(message.mediaEmbed, messageId);
            }

            let textContent = message.text;
            let editedBadge = '';
            
            if (message.isDeleted) {
                textContent = '🗑️ This message was deleted';
                content += `<div class="message-text deleted-message" style="font-style: italic; color: var(--text-secondary);">${escapeHtml(textContent)}</div>`;
            } else {
                if (message.isEdited) {
                    editedBadge = '<span class="edited-badge" style="font-size: 10px; color: var(--text-secondary); margin-left: 5px;" title="Message was edited">(edited)</span>';
                }
                
                const { mentionedUsers } = processMentions(textContent);
                const linkedText = linkifyAndProcessText(textContent);
                const escapedText = escapeHtml(linkedText);
                const highlightedText = highlightMentions(escapedText);
                content += `<div class="message-text">${highlightedText}${editedBadge}</div>`;
            }
            
            content += `</div>`;
            messageDiv.innerHTML = content;

            chatMessages.appendChild(messageDiv);

            const replyPreview = messageDiv.querySelector('.message-reply');
            if (replyPreview) {
                replyPreview.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const replyId = replyPreview.getAttribute('data-reply-id');
                    if (replyId) {
                        scrollToMessage(`message-${replyId}`);
                    }
                });
            }

            if (!options.skipSound && message.userId !== userId && !message.isDeleted) {
                const { mentionedUsers } = processMentions(message.text);
                const hasMention = isUserMentioned(mentionedUsers);
                const isReplyToUser = message.replyTo && message.replyTo.username === username;
                
                if (hasMention || isReplyToUser) {
                    playMentionSound();
                } else {
                    playNotificationSound();
                }
            }

            if (atBottom) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        function handleTyping() {
            if (!isInitialized) return;

            if (typingTimeout) clearTimeout(typingTimeout);
            
            try {
                const db = window.database;
                if (db) {
                    db.ref(`typing/${userId}`).set({ 
                        username: username, 
                        timestamp: Date.now(),
                        userId: userId
                    });
                }
            } catch (err) {
                console.error('Error updating typing status:', err);
            }

            typingTimeout = setTimeout(() => {
                clearTypingStatus();
            }, 3000);
        }

        function clearTypingStatus() {
            if (typingTimeout) clearTimeout(typingTimeout);
            try {
                const db = window.database;
                if (db) {
                    db.ref(`typing/${userId}`).remove();
                }
            } catch (e) {
                console.error('Error clearing typing status:', e);
            }
        }

        function setupOnlineStatus() {
            try {
                const db = window.database;
                if (!db) return;
                
                const userRef = db.ref(`online/${userId}`);
                
                userRef.set({
                    username: username,
                    timestamp: Date.now()
                });

                window.addEventListener('beforeunload', () => {
                    try {
                        if (userRef) userRef.remove();
                        clearTypingStatus();
                        // Clean up YouTube players
                        window.youtubePlayers.forEach((player, id) => {
                            if (player && player.destroy) {
                                player.destroy();
                            }
                        });
                        window.youtubePlayers.clear();
                    } catch (e) {}
                });

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
                if (!db) return;
                
                const messagesRef = db.ref('messages');
                let initialMessageLoad = true;

                messagesRef.once('value').then(() => {
                    initialMessageLoad = false;
                }).catch((err) => {
                    console.warn('Error during initial message load check:', err);
                    initialMessageLoad = false;
                });

                messagesRef.on('child_added', (snapshot) => {
                    const message = snapshot.val();
                    console.log('💬 New message received:', message);
                    if (message) {
                        message.id = snapshot.key;

                        const existingElement = document.querySelector(`[data-temp-id="${message.timestamp}"]`);
                        if (existingElement) {
                            existingElement.id = `message-${snapshot.key}`;
                            existingElement.removeAttribute('data-temp-id');
                            const replyBtn = existingElement.querySelector('.reply-btn');
                            if (replyBtn) {
                                replyBtn.dataset.messageId = snapshot.key;
                            }
                        } else {
                            displayMessage(message, { skipSound: initialMessageLoad });
                        }
                    }
                });

                messagesRef.on('child_changed', (snapshot) => {
                    const updatedMessage = snapshot.val();
                    updatedMessage.id = snapshot.key;
                    
                    updateMessageInCache(snapshot.key, updatedMessage);
                    
                    const messageElement = document.getElementById(`message-${snapshot.key}`);
                    if (messageElement) {
                        const wasAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 50;
                        displayMessage(updatedMessage, { skipSound: true });
                        const newElement = chatMessages.lastChild;
                        messageElement.replaceWith(newElement);
                        if (wasAtBottom) {
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }
                });

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
            if (typingIndicator) {
                if (typingUsers.size > 0) {
                    typingIndicator.classList.remove('hidden');
                } else {
                    typingIndicator.classList.add('hidden');
                }
            }
        }

        function toggleTheme() {
            isDarkMode = !isDarkMode;
            localStorage.setItem('darkMode', isDarkMode);
            document.body.classList.toggle('dark-mode');
            if (themeToggle) {
                themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
            }
        }

        function clearChat() {
            if (chatMessages && confirm('Are you sure you want to clear all messages?')) {
                chatMessages.innerHTML = '';
                messagesCache.clear();
                // Clean up YouTube players
                window.youtubePlayers.forEach((player, id) => {
                    if (player && player.destroy) {
                        player.destroy();
                    }
                });
                window.youtubePlayers.clear();
            }
        }

        function resetSession() {
            if (!confirm('Reset local data and reconnect?')) return;
            // Clean up YouTube players
            window.youtubePlayers.forEach((player, id) => {
                if (player && player.destroy) {
                    player.destroy();
                }
            });
            window.youtubePlayers.clear();
            localStorage.removeItem('username');
            localStorage.removeItem('userColor');
            localStorage.removeItem('darkMode');
            localStorage.removeItem('soundEnabled');
            localStorage.removeItem('userId');
            location.reload();
        }

        function playNotificationSound() {
            if (!soundEnabled) return;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.log('Web Audio API not available, skipping notification sound');
            }
        }

        function cancelReply() {
            currentReply = null;
            updateReplyPreview();
        }

        function startReply(messageId, replyUsername, messageText, messageElement) {
            if (currentEdit) {
                cancelEdit();
            }
            
            currentReply = {
                id: messageId,
                username: replyUsername,
                text: messageText,
                preview: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
                elementId: `message-${messageId}`,
                element: messageElement
            };
            updateReplyPreview();
            if (messageInput) messageInput.focus();
            
            if (messageElement) {
                messageElement.style.transition = 'background-color 0.3s';
                messageElement.style.backgroundColor = 'rgba(108, 92, 231, 0.2)';
                setTimeout(() => {
                    if (messageElement) {
                        messageElement.style.backgroundColor = '';
                    }
                }, 500);
            }
        }

        function updateReplyPreview() {
            const existingPreview = document.querySelector('.current-reply-preview');
            if (existingPreview) {
                existingPreview.remove();
            }

            if (currentReply && messageInput) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'current-reply-preview';
                previewDiv.innerHTML = `
                    <div class="reply-content" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background-color: rgba(108, 92, 231, 0.1); border-radius: 8px; margin-bottom: 8px;">
                        <span class="reply-label" style="font-size: 12px; color: var(--accent-color);">Replying to <strong>${escapeHtml(currentReply.username)}</strong>:</span>
                        <span class="reply-text" style="font-size: 12px; color: var(--text-secondary); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(currentReply.preview)}</span>
                        <button class="cancel-reply" style="background: none; border: none; cursor: pointer; font-size: 16px; padding: 0 4px;" title="Cancel reply">✕</button>
                    </div>
                `;

                previewDiv.style.cursor = 'pointer';
                previewDiv.addEventListener('click', (e) => {
                    if (e.target.classList.contains('cancel-reply')) {
                        return;
                    }
                    if (currentReply.elementId) {
                        scrollToMessage(currentReply.elementId);
                    }
                });

                const cancelBtn = previewDiv.querySelector('.cancel-reply');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        cancelReply();
                    });
                }

                const inputArea = document.querySelector('.input-area');
                if (inputArea && inputArea.parentNode) {
                    inputArea.parentNode.insertBefore(previewDiv, inputArea);
                }
            }
        }

        function scrollToMessage(elementId) {
            console.log('Scrolling to:', elementId);
            const messageElement = document.getElementById(elementId);
            if (messageElement && chatMessages) {
                messageElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                const originalBackground = messageElement.style.backgroundColor;
                messageElement.style.transition = 'background-color 0.3s ease';
                messageElement.style.backgroundColor = 'rgba(108, 92, 231, 0.3)';
                
                let flashCount = 0;
                const flashInterval = setInterval(() => {
                    if (flashCount >= 3) {
                        clearInterval(flashInterval);
                        messageElement.style.backgroundColor = originalBackground;
                    } else {
                        messageElement.style.backgroundColor = flashCount % 2 === 0 
                            ? 'rgba(108, 92, 231, 0.3)' 
                            : 'rgba(108, 92, 231, 0.1)';
                        flashCount++;
                    }
                }, 300);
                
                const originalBorder = messageElement.style.border;
                messageElement.style.border = '2px solid var(--accent-color)';
                setTimeout(() => {
                    messageElement.style.border = originalBorder;
                }, 2000);
            } else {
                console.warn('Message element not found:', elementId);
            }
        }

        function playMentionSound() {
            if (!soundEnabled) return;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.log('Web Audio API not available, skipping mention sound');
            }
        }

        function processMentions(text) {
            if (!text) return { hasMention: false, mentionedUsers: [] };
            
            const mentionRegex = /@(\w+)/g;
            const mentionedUsers = [];
            let hasMention = false;
            
            let match;
            while ((match = mentionRegex.exec(text)) !== null) {
                const mentionedUsername = match[1];
                mentionedUsers.push(mentionedUsername);
                hasMention = true;
            }
            
            return { hasMention, mentionedUsers };
        }

        function highlightMentions(text) {
            if (!text) return text;
            
            return text.replace(/@(\w+)/g, '<span class="mention" style="background-color: rgba(108, 92, 231, 0.2); border-radius: 4px; padding: 0 2px;">@$1</span>');
        }

        function isUserMentioned(mentionedUsers) {
            return mentionedUsers.some(mentionedUsername => mentionedUsername.toLowerCase() === username.toLowerCase());
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

            const timeOfDay = date.toLocaleTimeString('en-US', { 
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });

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
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }
});