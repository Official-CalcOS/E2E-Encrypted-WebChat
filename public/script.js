const socket = io();

// Prompt for username and password
let username = prompt('Enter your username (optional)') || 'Anonymous';
let password = prompt('Enter your password (optional for locking username)') || '';

// Emit join event
socket.emit('join', { requestedUsername: username, password: password });

// Function to encrypt the message
function encryptMessage(message, key) {
    return CryptoJS.AES.encrypt(message, key).toString();
}

// Function to decrypt the message
function decryptMessage(encryptedMessage, key) {
    const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// Function to display a message in the chat box
function displayMessage(username, message) {
    const chatBox = document.getElementById('chat-box');
    const messageElement = document.createElement('div');
    messageElement.textContent = `${username}: ${message}`;
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the latest message
}

// Handle locking username with a password
document.getElementById('lock-username-btn').addEventListener('click', () => {
    const passwordInput = prompt('Enter a password to lock your username:');

    if (!passwordInput) {
        alert('Please enter a password to lock your username.');
        return;
    }

    socket.emit('lockUsername', { username, password: passwordInput });
});

// Handle sending a message
document.getElementById('send-button').addEventListener('click', () => {
    const secretKeyInput = document.getElementById('secret-key-input').value; // Optional encryption key
    const messageInput = document.getElementById('message-input').value;

    if (messageInput.trim() === '') return; // Don't send empty messages

    let messageToSend = messageInput;
    const hasEncryptionKey = secretKeyInput.trim() !== '';

    // Encrypt the message if a key is provided
    if (hasEncryptionKey) {
        messageToSend = encryptMessage(messageInput, secretKeyInput);
    }

    // Display your own message immediately (show the original message, not encrypted)
    displayMessage(username, messageInput);  

    // Send the encrypted (or plain) message to the server
    socket.emit('sendMessage', {
        username: username,
        message: messageToSend,
        hasEncryptionKey: hasEncryptionKey // Indicate if the sender has a key
    });

    document.getElementById('message-input').value = ''; // Clear the input
});

// Receive messages from other users
socket.on('receiveMessage', (data) => {
    const secretKeyInput = document.getElementById('secret-key-input').value; // User's encryption key

    let displayMessageContent;

    // If sender has encryption key
    if (data.hasEncryptionKey) {
        if (secretKeyInput.trim() !== '') {
            try {
                // Decrypt the message
                displayMessageContent = decryptMessage(data.message, secretKeyInput);
                // If decryption results in an empty string, show the default message
                if (displayMessageContent === '') {
                    displayMessageContent = '(Secret Message - Adjust your key to view)'; 
                }
            } catch (e) {
                console.error('Decryption failed:', e);
                displayMessageContent = '(Secret Message - Adjust your key to view)'; // Show default text if an error occurs
            }
        } else {
            displayMessageContent = '(Secret Message - Adjust your key to view)'; // Show default text if no key provided
        }
    } else {
        // Sender did not use encryption
        displayMessageContent = data.message; // Display the original message
    }

    // Display the received message
    displayMessage(data.username, displayMessageContent);
});

// Toggle the user sidebar
const toggleUsersBtn = document.getElementById('toggle-users-btn');
const userSidebar = document.getElementById('user-sidebar');

toggleUsersBtn.addEventListener('click', () => {
    userSidebar.classList.toggle('show');
});

// Update active users list when the server sends the update
socket.on('updateUserList', (activeUsers) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = ''; // Clear the list first

    activeUsers.forEach(user => {
        const listItem = document.createElement('li');
        listItem.textContent = `${user.username} (Joined: ${user.joinDate})`;
        userList.appendChild(listItem);
    });
});

// Handle error messages
socket.on('error', (message) => {
    alert(message);
});

// Handle username locked confirmation
socket.on('usernameLocked', (username) => {
    alert(`Username '${username}' has been locked successfully!`);
});

// Disable username input after joining
document.getElementById('username-input').value = username;
document.getElementById('username-input').disabled = true; // Disable the input

