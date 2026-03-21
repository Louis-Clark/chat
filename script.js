// script.js
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const usernameInput = document.getElementById('username-input');
    const setUsernameButton = document.getElementById('set-username');

    let username = localStorage.getItem('username') || '';

    // Disable chat initially
    messageInput.disabled = true;
    sendButton.disabled = true;

    // Set initial username if stored
    if (username) {
        usernameInput.value = username;
        enableChat();
    }

    setUsernameButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (username) {
            localStorage.setItem('username', username);
            enableChat();
        }
    });

    function enableChat() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        usernameInput.disabled = true;
        setUsernameButton.disabled = true;

        // Listen for new messages
        const messagesRef = window.ref(window.database, 'messages');
        window.onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val();
            displayMessage(message);
        });
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText && username) {
            const messagesRef = window.ref(window.database, 'messages');
            window.push(messagesRef, {
                username: username,
                text: messageText,
                timestamp: Date.now()
            });
            messageInput.value = '';
        }
    }

    function displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (message.username === username) {
            messageElement.classList.add('own');
        } else {
            messageElement.classList.add('other');
        }
        messageElement.innerHTML = `<strong>${message.username}:</strong> ${message.text}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});