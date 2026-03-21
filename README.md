# Real-time Chat App

A simple real-time chat application that can be hosted on GitHub Pages, allowing users on different devices and networks to chat with each other.

## Features

- Real-time messaging using Firebase Realtime Database
- Username support
- Responsive design
- No server required - fully static

## Setup Instructions

### 1. Set up Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable the Realtime Database:
   - Go to "Database" in the left sidebar
   - Click "Create database"
   - Choose "Start in test mode" (you can change rules later for production)
4. Get your Firebase configuration:
   - Go to Project settings (gear icon)
   - Scroll down to "Your apps" section
   - Click "Add app" and select Web (</>)
   - Copy the config object

### 2. Configure the App

1. Open `index.html`
2. Replace the `firebaseConfig` object with your Firebase project configuration
3. Commit and push your changes

### 3. Enable GitHub Pages

1. Go to your repository settings
2. Scroll down to "Pages" section
3. Under "Source", select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Click "Save"

Your chat app will be available at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Usage

1. Open the GitHub Pages URL in your browser
2. Enter a username
3. Start chatting!

## Security Note

The Firebase Realtime Database is set to test mode by default, which allows anyone to read/write. For production use, update the database rules to restrict access as needed.

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Firebase Realtime Database