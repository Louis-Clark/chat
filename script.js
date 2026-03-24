// Advanced Chat Application Script with Voice Calls
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Chat app starting...');
    
    // YouTube Player instances cache
    window.youtubePlayers = new Map();
    
    // Voice Call Variables
    let peerConnection = null;
    let localStream = null;
    let remoteStream = null;
    let callActive = false;
    let currentCallWith = null;
    let callTimer = null;
    let callStartTime = 0;
    
    // WebRTC Configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    };
    
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
        const uploadBtn = document.getElementById('upload-btn');
        const fileInput = document.getElementById('file-input');
        const voiceBtn = document.getElementById('voice-btn');
        const voiceRecordingUI = document.getElementById('voice-recording');
        const stopRecordingBtn = document.getElementById('stop-recording');
        const recordingTimeDisplay = document.getElementById('recording-time');
        const emojiPicker = document.getElementById('emoji-picker');
        const typingIndicator = document.getElementById('typing-indicator');
        const colorButtons = document.querySelectorAll('.color-btn');

        // Voice Call UI Elements - Add these to your HTML
        const callBtn = document.getElementById('call-btn');
        const callModal = document.getElementById('call-modal');
        const callStatus = document.getElementById('call-status');
        const callTimerDisplay = document.getElementById('call-timer');
        const acceptCallBtn = document.getElementById('accept-call');
        const rejectCallBtn = document.getElementById('reject-call');
        const endCallBtn = document.getElementById('end-call');
        const muteCallBtn = document.getElementById('mute-call');
        const speakerCallBtn = document.getElementById('speaker-call');
        const closeCallModal = document.getElementById('close-call-modal');
        const userListModal = document.getElementById('user-list-modal');
        const userListContent = document.getElementById('user-list-content');
        const closeUserList = document.getElementById('close-user-list');

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
        let activeReactionPicker = null;
        let pendingMediaUrls = new Map();
        let isMuted = false;
        let isSpeakerOn = false;

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
            listenForCalls();
            isInitialized = true;
        }

        // Common emojis for quick reactions
        const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👎'];

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
        
        if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
        if (fileInput) fileInput.addEventListener('change', handleFileUpload);
        
        if (voiceBtn) voiceBtn.addEventListener('click', startVoiceRecording);
        if (stopRecordingBtn) stopRecordingBtn.addEventListener('click', stopVoiceRecording);

        // Voice Call Event Listeners
        if (callBtn) callBtn.addEventListener('click', showUserList);
        if (acceptCallBtn) acceptCallBtn.addEventListener('click', acceptCall);
        if (rejectCallBtn) rejectCallBtn.addEventListener('click', rejectCall);
        if (endCallBtn) endCallBtn.addEventListener('click', endCall);
        if (muteCallBtn) muteCallBtn.addEventListener('click', toggleMute);
        if (speakerCallBtn) speakerCallBtn.addEventListener('click', toggleSpeaker);
        if (closeCallModal) closeCallModal.addEventListener('click', () => {
            if (callModal) callModal.classList.add('hidden');
        });
        if (closeUserList) closeUserList.addEventListener('click', () => {
            if (userListModal) userListModal.classList.add('hidden');
        });

        // Event delegation for reply, edit, delete, and reaction buttons
        if (chatMessages) chatMessages.addEventListener('click', (e) => {
            const messageElement = e.target.closest('.message');
            if (!messageElement) return;
            
            const messageId = messageElement.id.replace('message-', '');
            
            if (e.target.classList.contains('reply-btn')) {
                const replyUsername = messageElement.querySelector('.message-username').textContent;
                const messageText = messageElement.querySelector('.message-text')?.textContent || '[Media]';
                startReply(messageId, replyUsername, messageText, messageElement);
            }
            
            if (e.target.classList.contains('edit-btn')) {
                const messageData = getMessageDataById(messageId);
                if (messageData && messageData.userId === userId) {
                    startEdit(messageId, messageData.text, messageElement);
                }
            }
            
            if (e.target.classList.contains('delete-btn')) {
                const messageData = getMessageDataById(messageId);
                if (messageData && messageData.userId === userId) {
                    deleteMessage(messageId);
                }
            }
            
            if (e.target.classList.contains('add-reaction-btn') || e.target.closest('.add-reaction-btn')) {
                const btn = e.target.closest('.add-reaction-btn');
                e.stopPropagation();
                showReactionPicker(btn, messageId, messageElement);
            }
            
            if (e.target.classList.contains('remove-reaction') || e.target.closest('.remove-reaction')) {
                const reactionEmoji = e.target.closest('.reaction-badge').getAttribute('data-emoji');
                const messageId = e.target.closest('.message').id.replace('message-', '');
                e.stopPropagation();
                removeReaction(messageId, reactionEmoji);
            }
        });

        document.addEventListener('click', (e) => {
            if (activeReactionPicker && !activeReactionPicker.contains(e.target)) {
                activeReactionPicker.remove();
                activeReactionPicker = null;
            }
        });

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

        let messagesCache = new Map();

        // ========== VOICE CALL FUNCTIONS ==========
        
        function showUserList() {
            if (!userListModal || !userListContent) return;
            
            // Get all online users except yourself
            const otherUsers = Array.from(onlineUsers).filter(id => id !== userId);
            
            if (otherUsers.length === 0) {
                userListContent.innerHTML = '<div style="text-align: center; padding: 20px;">No other users online</div>';
            } else {
                userListContent.innerHTML = '';
                otherUsers.forEach(uid => {
                    const userRef = window.database.ref(`online/${uid}`);
                    userRef.once('value', (snapshot) => {
                        const userData = snapshot.val();
                        if (userData && userData.username) {
                            const userItem = document.createElement('div');
                            userItem.className = 'user-list-item';
                            userItem.style.cssText = `
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                padding: 12px;
                                border-bottom: 1px solid var(--border-color);
                                cursor: pointer;
                                transition: background 0.2s ease;
                            `;
                            userItem.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: ${userData.userColor || '#6C5CE7'}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white;">
                                        ${generateAvatar(userData.username)}
                                    </div>
                                    <div>
                                        <div style="font-weight: bold;">${escapeHtml(userData.username)}</div>
                                        <div style="font-size: 12px; color: #4CAF50;">● Online</div>
                                    </div>
                                </div>
                                <button class="call-user-btn" data-user-id="${uid}" data-username="${escapeHtml(userData.username)}" style="
                                    padding: 8px 16px;
                                    background: var(--accent-color);
                                    border: none;
                                    border-radius: 20px;
                                    color: white;
                                    cursor: pointer;
                                    transition: transform 0.2s ease;
                                ">📞 Call</button>
                            `;
                            
                            const callBtn = userItem.querySelector('.call-user-btn');
                            callBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                initiateCall(uid, userData.username);
                                userListModal.classList.add('hidden');
                            });
                            
                            userListContent.appendChild(userItem);
                        }
                    });
                });
            }
            
            userListModal.classList.remove('hidden');
        }
        
        async function initiateCall(targetUserId, targetUsername) {
            if (callActive) {
                alert('You are already in a call');
                return;
            }
            
            try {
                // Request microphone access
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                
                // Create peer connection
                peerConnection = new RTCPeerConnection(configuration);
                
                // Add local stream tracks
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });
                
                // Handle incoming remote stream
                peerConnection.ontrack = (event) => {
                    remoteStream = event.streams[0];
                    if (remoteStream) {
                        // Create audio element for remote audio
                        const remoteAudio = document.getElementById('remote-audio');
                        if (remoteAudio) {
                            remoteAudio.srcObject = remoteStream;
                            remoteAudio.play();
                        }
                    }
                };
                
                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        sendCallSignal(targetUserId, 'ice-candidate', {
                            candidate: event.candidate
                        });
                    }
                };
                
                // Handle connection state changes
                peerConnection.onconnectionstatechange = () => {
                    console.log('Connection state:', peerConnection.connectionState);
                    if (peerConnection.connectionState === 'connected') {
                        startCallTimer();
                        updateCallStatus('Connected');
                    } else if (peerConnection.connectionState === 'failed') {
                        endCall();
                        updateCallStatus('Connection failed');
                    } else if (peerConnection.connectionState === 'disconnected') {
                        updateCallStatus('Disconnected');
                    }
                };
                
                // Create and send offer
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                sendCallSignal(targetUserId, 'call-offer', {
                    offer: peerConnection.localDescription,
                    from: userId,
                    fromUsername: username,
                    fromUserColor: userColor
                });
                
                currentCallWith = {
                    id: targetUserId,
                    username: targetUsername
                };
                callActive = true;
                
                if (callModal) {
                    callModal.classList.remove('hidden');
                    updateCallStatus(`Calling ${targetUsername}...`);
                }
                
            } catch (err) {
                console.error('Error initiating call:', err);
                alert('Could not access microphone. Please check permissions.');
                cleanupCall();
            }
        }
        
        function listenForCalls() {
            const db = window.database;
            if (!db) return;
            
            const callsRef = db.ref('calls');
            
            callsRef.on('child_added', async (snapshot) => {
                const signal = snapshot.val();
                const signalId = snapshot.key;
                
                if (signal.target === userId) {
                    switch (signal.type) {
                        case 'call-offer':
                            if (!callActive) {
                                handleIncomingCall(signal, signalId);
                            } else {
                                // Reject if busy
                                sendCallSignal(signal.from, 'call-reject', {
                                    reason: 'busy'
                                });
                                snapshot.ref.remove();
                            }
                            break;
                            
                        case 'call-answer':
                            if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
                                await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
                                snapshot.ref.remove();
                            }
                            break;
                            
                        case 'ice-candidate':
                            if (peerConnection) {
                                try {
                                    await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                                } catch (err) {
                                    console.error('Error adding ICE candidate:', err);
                                }
                                snapshot.ref.remove();
                            }
                            break;
                            
                        case 'call-reject':
                            if (callActive && currentCallWith && currentCallWith.id === signal.from) {
                                updateCallStatus('Call rejected');
                                setTimeout(() => {
                                    cleanupCall();
                                    if (callModal) callModal.classList.add('hidden');
                                    alert(`${signal.fromUsername || 'User'} rejected the call`);
                                }, 1000);
                                snapshot.ref.remove();
                            }
                            break;
                            
                        case 'call-end':
                            if (callActive) {
                                updateCallStatus('Call ended');
                                setTimeout(() => {
                                    cleanupCall();
                                    if (callModal) callModal.classList.add('hidden');
                                }, 1000);
                                snapshot.ref.remove();
                            }
                            break;
                    }
                }
            });
        }
        
        function handleIncomingCall(signal, signalId) {
            if (callActive) {
                sendCallSignal(signal.from, 'call-reject', { reason: 'busy' });
                window.database.ref(`calls/${signalId}`).remove();
                return;
            }
            
            currentCallWith = {
                id: signal.from,
                username: signal.fromUsername,
                signalId: signalId
            };
            
            // Show incoming call notification
            if (callModal) {
                callModal.classList.remove('hidden');
                updateCallStatus(`Incoming call from ${signal.fromUsername}...`);
                
                // Store the offer for later
                window.pendingOffer = signal.offer;
                window.pendingSignalId = signalId;
                
                // Play incoming call sound
                playCallSound();
            }
        }
        
        async function acceptCall() {
            if (!window.pendingOffer || !currentCallWith) return;
            
            try {
                // Request microphone access
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                
                // Create peer connection
                peerConnection = new RTCPeerConnection(configuration);
                
                // Add local stream tracks
                localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, localStream);
                });
                
                // Handle incoming remote stream
                peerConnection.ontrack = (event) => {
                    remoteStream = event.streams[0];
                    if (remoteStream) {
                        const remoteAudio = document.getElementById('remote-audio');
                        if (remoteAudio) {
                            remoteAudio.srcObject = remoteStream;
                            remoteAudio.play();
                        }
                    }
                };
                
                // Handle ICE candidates
                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        sendCallSignal(currentCallWith.id, 'ice-candidate', {
                            candidate: event.candidate
                        });
                    }
                };
                
                // Set remote description
                await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));
                
                // Create and send answer
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                sendCallSignal(currentCallWith.id, 'call-answer', {
                    answer: peerConnection.localDescription
                });
                
                // Clean up pending offer
                if (window.pendingSignalId) {
                    window.database.ref(`calls/${window.pendingSignalId}`).remove();
                    window.pendingOffer = null;
                    window.pendingSignalId = null;
                }
                
                callActive = true;
                updateCallStatus(`Connected with ${currentCallWith.username}`);
                startCallTimer();
                
            } catch (err) {
                console.error('Error accepting call:', err);
                alert('Could not start call. Please check microphone permissions.');
                cleanupCall();
            }
        }
        
        function rejectCall() {
            if (currentCallWith && currentCallWith.signalId) {
                sendCallSignal(currentCallWith.id, 'call-reject', {
                    reason: 'rejected',
                    fromUsername: username
                });
                window.database.ref(`calls/${currentCallWith.signalId}`).remove();
            }
            cleanupCall();
            if (callModal) callModal.classList.add('hidden');
        }
        
        function endCall() {
            if (callActive && currentCallWith) {
                sendCallSignal(currentCallWith.id, 'call-end', {});
            }
            cleanupCall();
            if (callModal) callModal.classList.add('hidden');
        }
        
        function toggleMute() {
            if (localStream) {
                isMuted = !isMuted;
                localStream.getAudioTracks().forEach(track => {
                    track.enabled = !isMuted;
                });
                if (muteCallBtn) {
                    muteCallBtn.textContent = isMuted ? '🔇' : '🎤';
                    muteCallBtn.title = isMuted ? 'Unmute' : 'Mute';
                }
            }
        }
        
        function toggleSpeaker() {
            const remoteAudio = document.getElementById('remote-audio');
            if (remoteAudio) {
                isSpeakerOn = !isSpeakerOn;
                remoteAudio.style.transform = isSpeakerOn ? 'scale(1.1)' : 'scale(1)';
                if (speakerCallBtn) {
                    speakerCallBtn.textContent = isSpeakerOn ? '🔊' : '🔈';
                }
            }
        }
        
        function sendCallSignal(targetUserId, type, data) {
            const db = window.database;
            if (!db) return;
            
            const signal = {
                type: type,
                target: targetUserId,
                from: userId,
                fromUsername: username,
                timestamp: Date.now(),
                ...data
            };
            
            db.ref('calls').push(signal);
        }
        
        function startCallTimer() {
            if (callTimer) clearInterval(callTimer);
            callStartTime = Date.now();
            callTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                if (callTimerDisplay) {
                    callTimerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);
        }
        
        function updateCallStatus(message) {
            if (callStatus) {
                callStatus.textContent = message;
            }
        }
        
        function cleanupCall() {
            if (callTimer) {
                clearInterval(callTimer);
                callTimer = null;
            }
            
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }
            
            if (remoteStream) {
                const remoteAudio = document.getElementById('remote-audio');
                if (remoteAudio) {
                    remoteAudio.srcObject = null;
                }
                remoteStream = null;
            }
            
            callActive = false;
            currentCallWith = null;
            isMuted = false;
            
            if (muteCallBtn) muteCallBtn.textContent = '🎤';
            if (speakerCallBtn) speakerCallBtn.textContent = '🔈';
            if (callTimerDisplay) callTimerDisplay.textContent = '0:00';
        }
        
        function playCallSound() {
            if (!soundEnabled) return;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                // Ring pattern
                let count = 0;
                const ring = () => {
                    if (count >= 3 || callActive) {
                        oscillator.stop();
                        return;
                    }
                    
                    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                    
                    count++;
                    setTimeout(ring, 1500);
                };
                
                oscillator.start();
                ring();
                
            } catch (e) {
                console.log('Web Audio API not available');
            }
        }

        // ========== SMART LINK DETECTION WITH META TAGS ==========
        
        function isDirectMediaUrl(url) {
            const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|webm|mov|avi|mkv|mp3|wav|ogg|m4a)$/i;
            if (mediaExtensions.test(url)) {
                return true;
            }
            
            const mediaDomains = [
                'imgur.com', 'i.imgur.com', 'giphy.com', 'media.giphy.com', 'tenor.com',
                'cdn.discordapp.com', 'cdn.dribbble.com', 'images.unsplash.com',
                'i.redd.it', 'i.reddituploads.com', 'ibb.co', 'i.ibb.co', 'cloudinary.com'
            ];
            
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                if (mediaDomains.some(domain => hostname.includes(domain))) {
                    return true;
                }
            } catch (e) {
                return false;
            }
            
            return false;
        }
        
        function isYouTubeUrl(url) {
            const youtubePatterns = [
                /(?:youtube\.com\/watch\?v=)([\w-]+)/i,
                /(?:youtube\.com\/embed\/)([\w-]+)/i,
                /(?:youtube\.com\/v\/)([\w-]+)/i,
                /(?:youtube\.com\/live\/)([\w-]+)/i,
                /(?:youtu\.be\/)([\w-]+)/i,
                /(?:youtube\.com\/shorts\/)([\w-]+)/i
            ];
            return youtubePatterns.some(pattern => pattern.test(url));
        }
        
        async function fetchPageMetadata(url) {
            if (pendingMediaUrls.has(url)) {
                return pendingMediaUrls.get(url);
            }
            
            const promise = new Promise((resolve) => {
                const timeoutId = setTimeout(() => {
                    resolve({ type: 'link', error: 'timeout' });
                }, 3000);
                
                fetch(url, { method: 'HEAD', mode: 'no-cors' })
                    .then(response => {
                        clearTimeout(timeoutId);
                        const contentType = response.headers.get('content-type');
                        
                        if (contentType) {
                            if (contentType.startsWith('image/')) {
                                resolve({ type: 'image', url: url });
                            } else if (contentType.startsWith('video/')) {
                                resolve({ type: 'video', url: url });
                            } else if (contentType.startsWith('audio/')) {
                                resolve({ type: 'audio', url: url });
                            } else {
                                resolve({ type: 'link' });
                            }
                        } else {
                            resolve({ type: 'link' });
                        }
                    })
                    .catch(() => {
                        clearTimeout(timeoutId);
                        resolve({ type: 'link' });
                    });
            });
            
            pendingMediaUrls.set(url, promise);
            
            setTimeout(() => {
                pendingMediaUrls.delete(url);
            }, 60000);
            
            return promise;
        }
        
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

        async function detectAndProcessLinksAsync(text) {
            if (!text) return { processedText: text, mediaEmbed: null };
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const matches = text.match(urlRegex);
            
            if (!matches) return { processedText: text, mediaEmbed: null };
            
            for (const url of matches) {
                if (isYouTubeUrl(url)) {
                    const videoId = extractYouTubeId(url);
                    if (videoId) {
                        let processedText = text.replace(url, '').trim();
                        if (!processedText) {
                            processedText = '📺 Shared a YouTube video';
                        }
                        return {
                            processedText: processedText,
                            mediaEmbed: {
                                type: 'youtube',
                                videoId: videoId,
                                originalUrl: url
                            }
                        };
                    }
                }
                
                if (isDirectMediaUrl(url)) {
                    let processedText = text.replace(url, '').trim();
                    if (!processedText) {
                        if (url.match(/\.(gif)$/i)) {
                            processedText = '🎬 Shared a GIF';
                        } else if (url.match(/\.(mp4|webm|mov)$/i)) {
                            processedText = '🎥 Shared a video';
                        } else if (url.match(/\.(mp3|wav|ogg)$/i)) {
                            processedText = '🎵 Shared audio';
                        } else {
                            processedText = '🖼️ Shared an image';
                        }
                    }
                    return {
                        processedText: processedText,
                        mediaEmbed: {
                            type: 'image',
                            url: url
                        }
                    };
                }
                
                try {
                    const metadata = await fetchPageMetadata(url);
                    if (metadata.type === 'image' || metadata.type === 'video' || metadata.type === 'audio') {
                        let processedText = text.replace(url, '').trim();
                        if (!processedText) {
                            if (metadata.type === 'image') {
                                processedText = '🖼️ Shared an image';
                            } else if (metadata.type === 'video') {
                                processedText = '🎥 Shared a video';
                            } else if (metadata.type === 'audio') {
                                processedText = '🎵 Shared audio';
                            }
                        }
                        return {
                            processedText: processedText,
                            mediaEmbed: {
                                type: metadata.type,
                                url: url
                            }
                        };
                    }
                } catch (err) {
                    console.log('Metadata fetch failed for:', url, err);
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
                    
                    setTimeout(() => {
                        createYouTubePlayer(containerId, videoId, messageId);
                    }, 100);
                    
                    return `
                        <div class="media-embed youtube-embed" style="margin: 8px 0; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; background: #000;">
                            <div id="${containerId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
                        </div>
                    `;
                case 'image':
                case 'video':
                case 'audio':
                    const isVideo = embedData.type === 'video';
                    const isAudio = embedData.type === 'audio';
                    const mediaUrl = embedData.url;
                    
                    if (isVideo) {
                        return `
                            <div class="media-embed video-embed" style="margin: 8px 0;">
                                <video controls class="message-video" style="max-width: 100%; max-height: 400px; border-radius: 12px;">
                                    <source src="${mediaUrl}" type="video/mp4">
                                    Your browser does not support video playback.
                                </video>
                            </div>
                        `;
                    } else if (isAudio) {
                        return `
                            <div class="media-embed audio-embed" style="margin: 8px 0;">
                                <audio controls class="message-audio" style="width: 100%;">
                                    <source src="${mediaUrl}" type="audio/mpeg">
                                    Your browser does not support audio playback.
                                </audio>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="media-embed image-embed" style="margin: 8px 0;">
                                <img 
                                    src="${mediaUrl}" 
                                    alt="Shared image" 
                                    style="max-width: 100%; max-height: 400px; border-radius: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s ease;" 
                                    loading="lazy" 
                                    onclick="window.open('${mediaUrl}', '_blank')"
                                    onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 8px; background: rgba(255,0,0,0.1); border-radius: 8px; color: #ff4444;\\'>❌ Failed to load image</div>'"
                                >
                            </div>
                        `;
                    }
                default:
                    return '';
            }
        }

        function linkifyAndProcessText(text) {
            if (!text) return '';
            
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const linkedText = text.replace(urlRegex, (url) => {
                if (isYouTubeUrl(url) || isDirectMediaUrl(url)) {
                    return '';
                }
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            });
            
            return linkedText;
        }

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
                
                setTimeout(() => {
                    if (!window.YT) {
                        reject(new Error('YouTube API load timeout'));
                    }
                }, 10000);
            });
        }

        loadYouTubeAPI().catch(err => console.warn('YouTube API load failed:', err));

        // ========== REACTION FUNCTIONS ==========
        
        function showReactionPicker(button, messageId, messageElement) {
            if (activeReactionPicker) {
                activeReactionPicker.remove();
                activeReactionPicker = null;
            }
            
            const picker = document.createElement('div');
            picker.className = 'reaction-picker';
            picker.style.cssText = `
                position: fixed;
                background: var(--bg-secondary);
                border-radius: 28px;
                padding: 8px 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                display: flex;
                gap: 8px;
                z-index: 10000;
                border: 1px solid var(--border-color);
                animation: fadeInUp 0.2s ease;
                white-space: nowrap;
            `;
            
            const rect = button.getBoundingClientRect();
            const messageBubble = messageElement.querySelector('.message-bubble');
            const bubbleRect = messageBubble ? messageBubble.getBoundingClientRect() : rect;
            
            const pickerWidth = 280;
            const pickerHeight = 50;
            
            let top = rect.top - pickerHeight - 10;
            if (top < 10) {
                top = rect.bottom + 10;
            }
            if (top + pickerHeight > window.innerHeight - 10) {
                top = window.innerHeight - pickerHeight - 10;
            }
            
            let left;
            
            if (messageElement.classList.contains('own')) {
                left = bubbleRect.left - pickerWidth - 10;
                if (left < 10) left = 10;
                if (left + pickerWidth > window.innerWidth - 10) {
                    left = window.innerWidth - pickerWidth - 10;
                }
            } else {
                left = bubbleRect.right + 10;
                if (left + pickerWidth > window.innerWidth - 10) {
                    left = window.innerWidth - pickerWidth - 10;
                }
                if (left < 10) left = 10;
            }
            
            picker.style.top = `${top}px`;
            picker.style.left = `${left}px`;
            
            quickReactions.forEach(emoji => {
                const reactionBtn = document.createElement('button');
                reactionBtn.textContent = emoji;
                reactionBtn.style.cssText = `
                    background: transparent;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 24px;
                    transition: transform 0.1s ease, background 0.2s ease;
                `;
                reactionBtn.onmouseenter = () => {
                    reactionBtn.style.transform = 'scale(1.2)';
                    reactionBtn.style.background = 'var(--bg-hover)';
                };
                reactionBtn.onmouseleave = () => {
                    reactionBtn.style.transform = 'scale(1)';
                    reactionBtn.style.background = 'transparent';
                };
                reactionBtn.onclick = (e) => {
                    e.stopPropagation();
                    addReaction(messageId, emoji);
                    picker.remove();
                    activeReactionPicker = null;
                };
                picker.appendChild(reactionBtn);
            });
            
            const customBtn = document.createElement('button');
            customBtn.textContent = '➕';
            customBtn.style.cssText = `
                background: transparent;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 24px;
                transition: transform 0.1s ease;
            `;
            customBtn.onmouseenter = () => {
                customBtn.style.transform = 'scale(1.1)';
                customBtn.style.background = 'var(--bg-hover)';
            };
            customBtn.onmouseleave = () => {
                customBtn.style.transform = 'scale(1)';
                customBtn.style.background = 'transparent';
            };
            customBtn.onclick = (e) => {
                e.stopPropagation();
                openCustomEmojiPicker(messageId);
                picker.remove();
                activeReactionPicker = null;
            };
            picker.appendChild(customBtn);
            
            document.body.appendChild(picker);
            activeReactionPicker = picker;
        }
        
        function openCustomEmojiPicker(messageId) {
            const modal = document.createElement('div');
            modal.className = 'emoji-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                animation: fadeIn 0.2s ease;
            `;
            
            const pickerContainer = document.createElement('div');
            pickerContainer.style.cssText = `
                background: var(--bg-primary);
                border-radius: 12px;
                padding: 20px;
                max-width: 400px;
                width: 90%;
                max-height: 500px;
                overflow-y: auto;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            `;
            
            const title = document.createElement('h3');
            title.textContent = 'Choose a reaction';
            title.style.cssText = `
                margin: 0 0 16px 0;
                color: var(--text-primary);
                font-size: 18px;
            `;
            pickerContainer.appendChild(title);
            
            const emojiGrid = document.createElement('div');
            emojiGrid.style.cssText = `
                display: grid;
                grid-template-columns: repeat(8, 1fr);
                gap: 8px;
            `;
            
            const customEmojis = [
                '👍', '👎', '❤️', '🔥', '🎉', '😢', '😂', '😮',
                '😡', '🥺', '🙏', '💯', '🤣', '😍', '😎', '🤔',
                '👀', '💀', '✨', '⭐', '🍿', '🎵', '💪', '🤝',
                '😭', '😱', '🤯', '🥳', '😤', '💔', '✅', '❌'
            ];
            
            customEmojis.forEach(emoji => {
                const emojiBtn = document.createElement('button');
                emojiBtn.textContent = emoji;
                emojiBtn.style.cssText = `
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    font-size: 28px;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 8px;
                    transition: transform 0.1s ease, background 0.2s ease;
                `;
                emojiBtn.onmouseenter = () => {
                    emojiBtn.style.transform = 'scale(1.05)';
                    emojiBtn.style.background = 'var(--bg-hover)';
                };
                emojiBtn.onmouseleave = () => {
                    emojiBtn.style.transform = 'scale(1)';
                    emojiBtn.style.background = 'var(--bg-secondary)';
                };
                emojiBtn.onclick = () => {
                    addReaction(messageId, emoji);
                    modal.remove();
                };
                emojiGrid.appendChild(emojiBtn);
            });
            
            pickerContainer.appendChild(emojiGrid);
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = `
                margin-top: 16px;
                padding: 8px 16px;
                background: var(--accent-color);
                border: none;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                width: 100%;
            `;
            closeBtn.onclick = () => modal.remove();
            pickerContainer.appendChild(closeBtn);
            
            modal.appendChild(pickerContainer);
            document.body.appendChild(modal);
            
            modal.onclick = (e) => {
                if (e.target === modal) modal.remove();
            };
        }
        
        function addReaction(messageId, emoji) {
            const db = window.database;
            if (!db) return;
            
            const messageRef = db.ref(`messages/${messageId}`);
            messageRef.once('value', (snapshot) => {
                const messageData = snapshot.val();
                if (messageData) {
                    let reactions = messageData.reactions || {};
                    let userReaction = reactions[emoji] || [];
                    
                    if (!userReaction.includes(userId)) {
                        userReaction.push(userId);
                        reactions[emoji] = userReaction;
                        
                        messageRef.update({ reactions: reactions }, (error) => {
                            if (error) {
                                console.error('Error adding reaction:', error);
                            } else {
                                console.log(`✅ Reaction ${emoji} added to message ${messageId}`);
                                if (soundEnabled) {
                                    playReactionSound();
                                }
                            }
                        });
                    }
                }
            });
        }
        
        function removeReaction(messageId, emoji) {
            const db = window.database;
            if (!db) return;
            
            const messageRef = db.ref(`messages/${messageId}`);
            messageRef.once('value', (snapshot) => {
                const messageData = snapshot.val();
                if (messageData && messageData.reactions) {
                    let reactions = { ...messageData.reactions };
                    let userReaction = reactions[emoji] || [];
                    
                    const index = userReaction.indexOf(userId);
                    if (index > -1) {
                        userReaction.splice(index, 1);
                        
                        if (userReaction.length === 0) {
                            delete reactions[emoji];
                        } else {
                            reactions[emoji] = userReaction;
                        }
                        
                        messageRef.update({ reactions: reactions }, (error) => {
                            if (error) {
                                console.error('Error removing reaction:', error);
                            } else {
                                console.log(`✅ Reaction ${emoji} removed from message ${messageId}`);
                            }
                        });
                    }
                }
            });
        }
        
        function renderReactions(messageId, reactions) {
            if (!reactions || Object.keys(reactions).length === 0) {
                return '';
            }
            
            let reactionsHtml = '<div class="message-reactions" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
            
            for (const [emoji, users] of Object.entries(reactions)) {
                const count = users.length;
                const hasUserReacted = users.includes(userId);
                
                reactionsHtml += `
                    <div class="${hasUserReacted ? 'reaction-badge reacted' : 'reaction-badge'}" data-emoji="${emoji}" style="
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 2px 8px;
                        background: ${hasUserReacted ? 'rgba(108, 92, 231, 0.2)' : 'var(--bg-secondary)'};
                        border-radius: 24px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.2s ease;
                        border: 1px solid ${hasUserReacted ? 'var(--accent-color)' : 'var(--border-color)'};
                    ">
                        <span style="font-size: 16px;">${escapeHtml(emoji)}</span>
                        <span style="font-size: 12px; color: var(--text-secondary);">${count}</span>
                        ${hasUserReacted ? '<span class="remove-reaction" style="margin-left: 4px; font-size: 12px; opacity: 0.6;">✕</span>' : ''}
                    </div>
                `;
            }
            
            reactionsHtml += '</div>';
            return reactionsHtml;
        }
        
        function playReactionSound() {
            if (!soundEnabled) return;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
                oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            } catch (e) {
                console.log('Web Audio API not available, skipping reaction sound');
            }
        }

        // ========== UNIFIED MEDIA UPLOAD FUNCTION ==========

        function handleFileUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            let mediaType = '';
            let defaultText = '';
            let maxSize = 0;

            if (file.type.startsWith('image/')) {
                mediaType = 'image';
                defaultText = '📷 Shared an image';
                maxSize = 20 * 1024 * 1024;
            } else if (file.type.startsWith('video/')) {
                mediaType = 'video';
                defaultText = '🎥 Shared a video';
                maxSize = 100 * 1024 * 1024;
            } else if (file.type.startsWith('audio/')) {
                mediaType = 'audio';
                defaultText = '🎵 Shared an audio file';
                maxSize = 50 * 1024 * 1024;
            } else {
                alert('Unsupported file type. Please upload an image, video, or audio file.');
                fileInput.value = '';
                return;
            }

            if (file.size > maxSize) {
                const sizeMB = Math.round(maxSize / (1024 * 1024));
                alert(`File is too large. Maximum size is ${sizeMB}MB.`);
                fileInput.value = '';
                return;
            }

            uploadToCloudinary(file, mediaType, defaultText);
            fileInput.value = '';
        }

        function uploadToCloudinary(file, mediaType, defaultText) {
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.textContent = '⏳';
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', window.CLOUDINARY_UPLOAD_PRESET);

            console.log(`📤 Uploading ${mediaType} to Cloudinary...`);

            fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) throw new Error('Upload failed: ' + response.statusText);
                return response.json();
            })
            .then(data => {
                console.log(`✅ ${mediaType} uploaded:`, data.secure_url);

                const db = window.database;
                if (db) {
                    db.ref('messages').push({
                        username: username,
                        text: defaultText,
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isMedia: true,
                        mediaType: mediaType,
                        mediaUrl: data.secure_url,
                        isDeleted: false,
                        isEdited: false
                    }, (error) => {
                        if (uploadBtn) {
                            uploadBtn.disabled = false;
                            uploadBtn.textContent = '📎';
                        }
                        if (error) {
                            console.error('Error saving message:', error);
                            alert('Error saving message: ' + error.message);
                        } else {
                            console.log('✅ Message saved');
                        }
                    });
                } else {
                    if (uploadBtn) {
                        uploadBtn.disabled = false;
                        uploadBtn.textContent = '📎';
                    }
                }
            })
            .catch((error) => {
                console.error(`❌ ${mediaType} upload error:`, error);
                if (uploadBtn) {
                    uploadBtn.disabled = false;
                    uploadBtn.textContent = '📎';
                }
                alert(`Upload failed: ${error.message}`);
            });
        }

        // ========== VOICE RECORDING FUNCTIONS ==========

        async function startVoiceRecording() {
            try {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    stopVoiceRecording();
                }
                
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
                
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(audioStream);
                audioChunks = [];
                recordingStartTime = Date.now();

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log('🎤 Recording stopped, processing audio...');
                    if (audioChunks.length > 0) {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        sendVoiceMessage(audioBlob);
                    } else {
                        console.log('No audio data recorded');
                    }
                    
                    if (audioStream) {
                        audioStream.getTracks().forEach(track => track.stop());
                        audioStream = null;
                    }
                    mediaRecorder = null;
                    audioChunks = [];
                    
                    if (voiceRecordingUI) voiceRecordingUI.classList.add('hidden');
                    if (voiceBtn) voiceBtn.classList.remove('hidden');
                    if (recordingTimer) clearInterval(recordingTimer);
                    recordingTimer = null;
                };

                mediaRecorder.start(100);
                if (voiceRecordingUI) voiceRecordingUI.classList.remove('hidden');
                if (voiceBtn) voiceBtn.classList.add('hidden');
                startRecordingTimer();
                console.log('🎤 Voice recording started');
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Please allow microphone access to record voice messages.');
                if (voiceRecordingUI) voiceRecordingUI.classList.add('hidden');
                if (voiceBtn) voiceBtn.classList.remove('hidden');
            }
        }

        function stopVoiceRecording() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                console.log('⏹️ Stopping voice recording...');
                mediaRecorder.stop();
            } else {
                if (voiceRecordingUI) voiceRecordingUI.classList.add('hidden');
                if (voiceBtn) voiceBtn.classList.remove('hidden');
                if (recordingTimer) clearInterval(recordingTimer);
                recordingTimer = null;
                
                if (audioStream) {
                    audioStream.getTracks().forEach(track => track.stop());
                    audioStream = null;
                }
            }
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
            if (audioBlob.size < 1000) {
                console.log('Recording too short, not sending');
                return;
            }
            
            if (voiceBtn) voiceBtn.disabled = true;
            
            const formData = new FormData();
            formData.append('file', audioBlob, 'voice_message.webm');
            formData.append('upload_preset', window.CLOUDINARY_UPLOAD_PRESET);

            console.log('📤 Uploading voice message to Cloudinary...');

            fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) throw new Error('Upload failed: ' + response.statusText);
                return response.json();
            })
            .then(data => {
                console.log('✅ Voice message uploaded:', data.secure_url);

                const db = window.database;
                if (db) {
                    db.ref('messages').push({
                        username: username,
                        text: '🎤 Sent a voice message',
                        timestamp: Date.now(),
                        userId: userId,
                        userColor: userColor,
                        isMedia: true,
                        mediaType: 'audio',
                        mediaUrl: data.secure_url,
                        isDeleted: false,
                        isEdited: false
                    }, (error) => {
                        if (voiceBtn) voiceBtn.disabled = false;
                        if (error) {
                            console.error('Error saving voice message:', error);
                            alert('Error saving voice message: ' + error.message);
                        } else {
                            console.log('✅ Voice message saved');
                        }
                    });
                } else {
                    if (voiceBtn) voiceBtn.disabled = false;
                }
            })
            .catch((error) => {
                console.error('❌ Voice upload error:', error);
                if (voiceBtn) voiceBtn.disabled = false;
                alert('Failed to send voice message: ' + error.message);
            });
        }

        // ========== CORE FUNCTIONS ==========

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
                listenForCalls();
                isInitialized = true;
                console.log('✅ Chat ready!');
                
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

        async function sendMessage() {
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

                const { processedText, mediaEmbed } = await detectAndProcessLinksAsync(text);
                
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
                    mediaEmbed: mediaEmbed,
                    reactions: {}
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

        async function saveEditedMessage() {
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
                
                const { processedText, mediaEmbed } = await detectAndProcessLinksAsync(newText);
                
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
                            mediaEmbed: null,
                            reactions: null
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

        function displayMessage(message, options = {}) {
            if (!message || !chatMessages) return;

            console.log('💬 Displaying message:', {
                id: message.id,
                text: message.text,
                mediaEmbed: message.mediaEmbed,
                isDeleted: message.isDeleted,
                reactions: message.reactions
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
                content += `
                    <button class="reply-btn" title="Reply to this message">🗨️</button>
                    <button class="add-reaction-btn" title="Add reaction" style="margin-left: 4px;">😊</button>`;
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
                    content += `<video controls class="message-video" style="max-width: 100%; max-height: 400px; border-radius: 12px; margin-top: 8px;"><source src="${message.mediaUrl}" type="video/mp4">Your browser does not support video playback.</video>`;
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
                let processedText = textContent;
                
                processedText = linkifyAndProcessText(processedText);
                processedText = highlightMentions(processedText);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = processedText;
                
                content += `<div class="message-text">${tempDiv.innerHTML}${editedBadge}</div>`;
            }
            
            if (message.reactions && !message.isDeleted) {
                content += renderReactions(messageId, message.reactions);
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
                    timestamp: Date.now(),
                    userColor: userColor
                });

                window.addEventListener('beforeunload', () => {
                    try {
                        if (userRef) userRef.remove();
                        clearTypingStatus();
                        window.youtubePlayers.forEach((player, id) => {
                            if (player && player.destroy) {
                                player.destroy();
                            }
                        });
                        window.youtubePlayers.clear();
                        cleanupCall();
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
            
            return text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
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