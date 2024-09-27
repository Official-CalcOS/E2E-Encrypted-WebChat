const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// File to store username and password mapping
const userDataFile = path.join(__dirname, 'user_data.json');

// Array to store active users
let activeUsers = [];

// Array to store messages with timestamps
let messages = [];

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Load existing user data from disk
let userData = {};
if (fs.existsSync(userDataFile)) {
    userData = JSON.parse(fs.readFileSync(userDataFile, 'utf-8'));
}

// Helper function to generate a unique random username
function generateUniqueUsername() {
    return `User${Math.floor(Math.random() * 10000)}`;
}

// Function to delete a message after 30 minutes
function scheduleMessageDeletion(messageId) {
    setTimeout(() => {
        messages = messages.filter(msg => msg.id !== messageId);
        io.emit('deleteMessage', messageId); // Notify clients to delete the message
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
}

// Handle socket connections
io.on('connection', (socket) => {

    // Listen for a new user joining with a username and password
    socket.on('join', ({ requestedUsername, password }) => {
        let username = requestedUsername;

        // Check if the username is already taken
        if (activeUsers.some(user => user.username === username)) {
            // Notify the client that the username is taken and prompt them to retry
            socket.emit('usernameTaken', 'Username already taken. Please choose another one.');
            return;
        }

        // Check if the username is locked and verify the password
        if (userData[requestedUsername] && userData[requestedUsername] !== password) {
            socket.emit('error', 'Incorrect password for this username.');
            return;
        }

        // If username is available, assign it
        const user = {
            id: socket.id,
            username: username,
            joinDate: new Date().toLocaleString()
        };

        // Add user to active users list
        activeUsers.push(user);

        // Log the newly connected username
        console.log(`${username} connected`);

        // Notify the client of their assigned username
        socket.emit('userAssigned', username);

        // Broadcast updated user list to all clients
        io.emit('updateUserList', activeUsers);
    });

    // Lock username with a password
    socket.on('lockUsername', ({ username, password }) => {
        if (!username || !password) {
            socket.emit('error', 'Username and password are required.');
            return;
        }

        // Store the username and password
        userData[username] = password;
        fs.writeFileSync(userDataFile, JSON.stringify(userData, null, 2));
        socket.emit('usernameLocked', username);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');

        // Remove user from the active users list
        activeUsers = activeUsers.filter(user => user.id !== socket.id);

        // Broadcast updated user list to all clients
        io.emit('updateUserList', activeUsers);
    });

    // Listen for new messages
    socket.on('sendMessage', (data) => {
        const { username, message, hasEncryptionKey } = data;
        const messageId = Date.now(); // Use timestamp as unique message ID

        const newMessage = {
            id: messageId,
            username: username,
            message: message,
            timestamp: new Date().toLocaleTimeString(),
            hasEncryptionKey: hasEncryptionKey
        };

        // Store the message in the server's memory
        messages.push(newMessage);

        // Broadcast the message to all clients (except the sender)
        socket.broadcast.emit('receiveMessage', newMessage);

        console.log("Encrypted message received:", newMessage.message);

        // Schedule deletion of the message after 30 minutes
        scheduleMessageDeletion(messageId);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

