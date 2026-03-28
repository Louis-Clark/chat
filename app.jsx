const { useEffect } = React;

function ChatApp() {
  useEffect(() => {
    if (typeof window.initChatApp === 'function') {
      window.initChatApp();
    }
  }, []);

  const colorOptions = [
    { color: '#FF6B6B', label: 'Red color' },
    { color: '#4ECDC4', label: 'Teal color' },
    { color: '#45B7D1', label: 'Blue color' },
    { color: '#FFA07A', label: 'Orange color' },
    { color: '#98D8C8', label: 'Mint color' },
    { color: '#6C5CE7', label: 'Purple color', selected: true }
  ];

  return (
    <>
      <div className="app">
        <div id="setup-screen" className="setup-screen">
          <div className="setup-card">
            <h1>🎯 Chat Room</h1>
            <div className="form-group">
              <input type="text" id="username-input" className="username-input" placeholder="Enter your username" maxLength="20" autoComplete="off" />
            </div>
            <div className="color-selector">
              <label>Choose your color:</label>
              <div className="color-options">
                {colorOptions.map(({ color, label, selected }) => (
                  <button key={color} className={`color-btn${selected ? ' selected' : ''}`} data-color={color} style={{ backgroundColor: color }} aria-label={label}></button>
                ))}
              </div>
            </div>
            <div className="sound-toggle">
              <label>
                <input type="checkbox" id="sound-enabled" defaultChecked />
                Enable notification sounds
              </label>
            </div>
            <button id="enter-chat" className="btn btn-primary">Enter Chat</button>
          </div>
        </div>

        <div id="chat-screen" className="chat-screen hidden">
          <div className="chat-header">
            <div className="header-content">
              <h1>💬 Chat</h1>
              <div className="user-info">
                <span id="current-user" className="username-display"></span>
                <div className="online-indicator"></div>
              </div>
            </div>
            <div className="header-actions">
              <button id="theme-toggle" className="btn-icon" title="Toggle theme">🌙</button>
              <button id="clear-chat" className="btn-icon" title="Clear chat history">🗑️</button>
              <button id="reset-session" className="btn-icon" title="Reset local session">🔄</button>
            </div>
          </div>

          <div className="call-controls">
            <button id="call-btn" className="call-btn" title="Start a voice call with online users">📞 Call User</button>
            <span className="online-count">Online: 0</span>
          </div>

          <div className="online-users-container">
            <div id="online-users" className="online-users">
              <span className="online-count-text">Online Users</span>
            </div>
          </div>

          <div id="chat-messages" className="chat-messages"></div>

          <div id="typing-indicator" className="typing-indicator hidden">
            <span>Someone is typing</span>
            <div className="typing-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>

          <div className="input-area">
            <div className="input-controls">
              <button id="emoji-btn" className="btn-icon" title="Add emoji">😊</button>
              <button id="upload-btn" className="btn-icon" title="Upload image, video, or audio">📎</button>
              <input type="file" id="file-input" className="hidden" accept="image/*,video/*,audio/*" />
              <button id="voice-btn" className="btn-icon" title="Record voice message">🎤</button>
              <div id="voice-recording" className="voice-recording hidden">
                <span className="recording-dot">●</span>
                <span id="recording-time">0:00</span>
                <button id="stop-recording" className="btn-icon" title="Stop recording">⏹️</button>
              </div>
            </div>
            <div className="message-input-wrapper">
              <input type="text" id="message-input" className="message-input" placeholder="Type a message... (Paste YouTube, image, or GIF URLs for auto-embed)" />
            </div>
            <button id="send-button" className="btn btn-send">Send</button>
          </div>
        </div>
      </div>

      <div id="call-modal" className="modal hidden">
        <div className="modal-content">
          <div className="modal-header">
            <h3>Voice Call</h3>
            <button id="close-call-modal" className="close-modal" title="Close">✕</button>
          </div>
          <div className="call-icon">📞</div>
          <div id="call-status" className="call-status">Connecting...</div>
          <div id="call-timer" className="call-timer">0:00</div>
          <div className="call-actions">
            <button id="mute-call" className="call-action-btn mute" title="Mute microphone">🎤</button>
            <button id="speaker-call" className="call-action-btn speaker" title="Toggle speaker">🔈</button>
            <button id="end-call" className="call-action-btn end" title="End call">📞</button>
          </div>
          <div className="incoming-actions" style={{ display: 'none' }}>
            <button id="accept-call" className="call-action-btn accept" title="Accept call">Accept</button>
            <button id="reject-call" className="call-action-btn reject" title="Reject call">Reject</button>
          </div>
        </div>
      </div>

      <div id="user-list-modal" className="modal hidden">
        <div className="modal-content" style={{ width: '400px' }}>
          <div className="modal-header">
            <h3>📞 Online Users</h3>
            <button id="close-user-list" className="close-modal" title="Close">✕</button>
          </div>
          <div id="user-list-content" className="user-list-container">
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Loading users...</div>
          </div>
        </div>
      </div>

      <audio id="remote-audio" style={{ display: 'none' }}></audio>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ChatApp />);
