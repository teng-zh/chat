import { db, storage } from './config.js';
import { getCurrentUser } from './auth.js';
import { showNotification, updateNotification, scrollToBottom, getChatId, escapeHtml, formatFileSize } from './utils.js';

// 全局变量
let currentChat = { type: 'public', id: 'public' };
let typingRef = null;
let messagesRef = null;
let usersRef = null;

// DOM元素
const chatsTab = document.getElementById('chats-tab');
const chatsList = document.getElementById('chats-list');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const typingIndicator = document.getElementById('typing-indicator');
const typingUsers = document.getElementById('typing-users');
const chatTitle = document.getElementById('chat-title');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const publicChatBtn = document.getElementById('public-chat-btn');
const attachmentBtn = document.getElementById('attachment-btn');
const attachmentInput = document.getElementById('attachment-input');
const toggleSidebar = document.getElementById('toggle-sidebar');
const backToList = document.getElementById('back-to-list');

// 初始化聊天事件监听
export function initChatEvents() {
    // 聊天标签切换
    chatsTab.addEventListener('click', () => {
        chatsTab.classList.add('active');
        document.getElementById('friends-tab').classList.remove('active');
        chatsList.classList.remove('hidden');
        document.getElementById('friends-list').classList.add('hidden');
    });
    
    // 消息发送
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });
    
    // 输入框事件 - 正在输入
    messageInput.addEventListener('input', handleTyping);
    
    // 公共聊天室按钮
    publicChatBtn.addEventListener('click', () => {
        switchToChat('public', 'public', '公共聊天室', '大家可以在这里畅所欲言', '<i class="fa fa-users"></i>');
    });
    
    // 附件按钮
    attachmentBtn.addEventListener('click', () => {
        attachmentInput.click();
    });
    
    attachmentInput.addEventListener('change', handleFileAttachment);
    
    // 侧边栏切换（移动端）
    toggleSidebar.addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('show');
    });
    
    backToList.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('show');
    });
    
    // 点击聊天项
    chatsList.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            // 移除之前的active类
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.remove('active');
            });
            // 添加active类到当前点击项
            chatItem.classList.add('active');
            
            const chatType = chatItem.dataset.chatType;
            const chatId = chatItem.dataset.chatId;
            const chatName = chatItem.dataset.chatName;
            const chatStatus = chatItem.dataset.chatStatus;
            const chatAvatar = chatItem.dataset.chatAvatar;
            
            switchToChat(chatType, chatId, chatName, chatStatus, chatAvatar);
            
            // 在移动端隐藏侧边栏
            if (window.innerWidth < 768) {
                document.getElementById('sidebar').classList.remove('show');
            }
        }
    });
}

// 初始化聊天相关引用
export function initChatRefs() {
    usersRef = db.ref('users');
    messagesRef = db.ref('messages');
}

// 切换到指定聊天
export function switchToChat(type, id, name, status, avatar) {
    currentChat = { type, id };
    
    // 更新聊天头部
    chatTitle.textContent = name;
    chatStatus.textContent = status;
    chatAvatar.innerHTML = avatar;
    
    // 清空消息区域
    messagesContainer.innerHTML = '';
    
    // 加载该聊天的消息
    loadMessagesForChat(type, id);
    
    // 清除之前的正在输入监听
    if (typingRef) {
        typingRef.off('value');
    }
    
    // 设置新的正在输入监听
    setupTypingListener(type, id);
}

// 加载聊天列表
export function loadChats() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 加载好友聊天
    const friendsRef = db.ref('friends/' + currentUser.id);
    friendsRef.on('child_added', (snapshot) => {
        const friendId = snapshot.key;
        const friendData = snapshot.val();
        
        if (friendData.status === 'accepted') {
            // 获取好友信息
            usersRef.child(friendId).once('value')
                .then((userSnapshot) => {
                    const friend = userSnapshot.val();
                    if (friend) {
                        addChatItem('private', friendId, friend.username, '...', friend.avatar);
                        
                        // 加载最后一条消息
                        loadLastMessage(friendId);
                    }
                });
        }
    });
}

// 添加聊天项
function addChatItem(type, id, name, lastMessage, avatar) {
    // 检查是否已存在
    if (chatsList.querySelector(`[data-chat-id="${id}"]`)) {
        return;
    }
    
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item cursor-pointer';
    chatItem.dataset.chatType = type;
    chatItem.dataset.chatId = id;
    chatItem.dataset.chatName = name;
    chatItem.dataset.chatAvatar = avatar;
    
    chatItem.innerHTML = `
        <div class="avatar">
            ${avatar}
        </div>
        <div class="chat-info">
            <div class="chat-name">${name}</div>
            <div class="chat-last-message">${lastMessage}</div>
        </div>
        <div class="chat-time">--:--</div>
    `;
    
    chatsList.appendChild(chatItem);
}

// 加载最后一条消息
function loadLastMessage(friendId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const chatId = getChatId(currentUser.id, friendId);
    messagesRef.child(chatId).limitToLast(1).once('value')
        .then((snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const message = childSnapshot.val();
                const chatItem = chatsList.querySelector(`[data-chat-id="${friendId}"]`);
                
                if (chatItem) {
                    // 更新最后一条消息
                    let messageText = message.text || '';
                    if (message.type === 'image') {
                        messageText = '[图片]';
                    } else if (message.type === 'file') {
                        messageText = '[文件]';
                    }
                    
                    if (message.userId === currentUser.id) {
                        messageText = '我: ' + messageText;
                    }
                    
                    chatItem.querySelector('.chat-last-message').textContent = messageText;
                    
                    // 更新时间
                    const date = new Date(message.timestamp);
                    chatItem.querySelector('.chat-time').textContent = 
                        `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            });
        });
}

// 加载指定聊天的消息
function loadMessagesForChat(type, id) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    let chatRef;
    
    if (type === 'public') {
        chatRef = messagesRef.child('public');
    } else if (type === 'private') {
        const chatId = getChatId(currentUser.id, id);
        chatRef = messagesRef.child(chatId);
    }
    
    if (chatRef) {
        // 加载最近100条消息
        chatRef.limitToLast(100).once('value')
            .then((snapshot) => {
                messagesContainer.innerHTML = '';
                
                if (!snapshot.hasChildren()) {
                    // 没有消息
                    const emptyMessage = document.createElement('div');
                    emptyMessage.className = 'text-center';
                    emptyMessage.innerHTML = `
                        <span style="background-color: #e4e6eb; color: #666; padding: 5px 10px; border-radius: 12px; font-size: 12px;">
                            开始与 ${chatTitle.textContent} 聊天吧
                        </span>
                    `;
                    messagesContainer.appendChild(emptyMessage);
                    return;
                }
                
                snapshot.forEach((childSnapshot) => {
                    const message = childSnapshot.val();
                    displayMessage(message);
                });
                
                // 滚动到底部
                scrollToBottom();
            });
    }
}

// 监听新消息
export function listenForNewMessages() {
    const currentUser = getCurrentUser();
    if (!currentUser || !messagesRef) return;
    
    // 监听公共消息
    messagesRef.child('public').on('child_added', (snapshot) => {
        if (currentChat.type === 'public' && currentChat.id === 'public') {
            const message = snapshot.val();
            // 检查是否已经显示过这条消息
            if (!document.querySelector(`[data-message-id="${snapshot.key}"]`)) {
                displayMessage(message, snapshot.key);
                scrollToBottom();
            }
        } else {
            // 公共消息通知
            const message = snapshot.val();
            if (message.userId !== currentUser.id) {
                showNotification(`${message.username}: ${message.text || '[附件]'}`, 'info', () => {
                    switchToChat('public', 'public', '公共聊天室', '大家可以在这里畅所欲言', '<i class="fa fa-users"></i>');
                });
            }
        }
    });
    
    // 监听好友消息
    const friendsRef = db.ref('friends/' + currentUser.id);
    friendsRef.on('child_added', (snapshot) => {
        const friendId = snapshot.key;
        const friendData = snapshot.val();
        
        if (friendData.status === 'accepted') {
            const chatId = getChatId(currentUser.id, friendId);
            
            messagesRef.child(chatId).on('child_added', (msgSnapshot) => {
                if (currentChat.type === 'private' && currentChat.id === friendId) {
                    const message = msgSnapshot.val();
                    // 检查是否已经显示过这条消息
                    if (!document.querySelector(`[data-message-id="${msgSnapshot.key}"]`)) {
                        displayMessage(message, msgSnapshot.key);
                        scrollToBottom();
                    }
                } else {
                    // 好友消息通知
                    const message = msgSnapshot.val();
                    if (message.userId !== currentUser.id) {
                        // 获取好友信息
                        usersRef.child(friendId).once('value')
                            .then((userSnapshot) => {
                                const friend = userSnapshot.val();
                                if (friend) {
                                    showNotification(`${friend.username}: ${message.text || '[附件]'}`, 'info', () => {
                                        switchToChat('private', friendId, friend.username, '', friend.avatar);
                                    });
                                }
                            });
                    }
                }
            });
        }
    });
}

// 显示消息
export function displayMessage(message, messageId = null) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const isCurrentUser = message.userId === currentUser.id;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isCurrentUser ? 'out' : 'in'} animate-fade-in`;
    if (messageId) {
        messageElement.dataset.messageId = messageId;
    }
    
    let messageContent = '';
    
    if (message.type === 'text' || !message.type) {
        messageContent = `<div>${escapeHtml(message.text)}</div>`;
    } else if (message.type === 'image') {
        messageContent = `
            <img src="${message.url}" alt="图片" class="image-attachment" onclick="window.open('${message.url}', '_blank')">
        `;
    } else if (message.type === 'file') {
        messageContent = `
            <div class="attachment">
                <div class="attachment-icon">
                    <i class="fa fa-file-o"></i>
                </div>
                <div class="attachment-info">
                    <div class="attachment-name">${escapeHtml(message.filename)}</div>
                    <div class="attachment-size">${formatFileSize(message.size)}</div>
                </div>
                <a href="${message.url}" target="_blank" class="attachment-download">
                    <i class="fa fa-download"></i>
                </a>
            </div>
        `;
    }
    
    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    
    // 添加用户名（仅对他人消息和公共聊天室）
    if (!isCurrentUser) {
        const usernameElement = document.createElement('div');
        usernameElement.className = 'message-sender';
        usernameElement.textContent = message.username;
        messageBubble.appendChild(usernameElement);
    }
    
    // 添加消息内容
    const contentElement = document.createElement('div');
    contentElement.innerHTML = messageContent;
    messageBubble.appendChild(contentElement);
    
    // 添加时间戳
    const timeElement = document.createElement('div');
    const date = new Date(message.timestamp);
    timeElement.className = 'message-time';
    timeElement.textContent = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    messageBubble.appendChild(timeElement);
    
    messageElement.appendChild(messageBubble);
    messagesContainer.appendChild(messageElement);
}

// 发送消息
function sendMessage() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const text = messageInput.value.trim();
    if (!text || !currentChat) return;
    
    // 创建消息对象
    const message = {
        text: text,
        type: 'text',
        userId: currentUser.id,
        username: currentUser.username,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    // 保存消息到数据库
    saveMessageToDatabase(message);
    
    // 清空输入框
    messageInput.value = '';
    
    // 清除正在输入状态
    clearTypingStatus();
}

// 保存消息到数据库
function saveMessageToDatabase(message) {
    if (!currentChat || !messagesRef) return;
    
    let messageRef;
    
    if (currentChat.type === 'public') {
        messageRef = messagesRef.child('public').push();
    } else if (currentChat.type === 'private') {
        const chatId = getChatId(getCurrentUser().id, currentChat.id);
        messageRef = messagesRef.child(chatId).push();
    }
    
    if (messageRef) {
        messageRef.set(message)
            .catch((error) => {
                console.error('发送消息错误:', error);
                showNotification('发送消息失败: ' + error.message, 'error');
            });
    }
}

// 处理正在输入
function handleTyping() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentChat || !messageInput.value.trim()) {
        clearTypingStatus();
        return;
    }
    
    let typingPath;
    
    if (currentChat.type === 'public') {
        typingPath = `typing/public/${currentUser.id}`;
    } else if (currentChat.type === 'private') {
        const chatId = getChatId(currentUser.id, currentChat.id);
        typingPath = `typing/${chatId}/${currentUser.id}`;
    }
    
    if (typingPath) {
        typingRef = db.ref(typingPath);
        typingRef.set({
            username: currentUser.username,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // 5秒后清除正在输入状态
        setTimeout(() => {
            if (typingRef && (!messageInput.value.trim() || Date.now() - (typingRef.lastSetTime || 0) > 4000)) {
                typingRef.remove();
            }
        }, 5000);
        
        typingRef.lastSetTime = Date.now();
    }
}

// 清除正在输入状态
function clearTypingStatus() {
    if (typingRef) {
        typingRef.remove();
    }
}

// 设置正在输入监听
function setupTypingListener(type, id) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    let typingPath;
    
    if (type === 'public') {
        typingPath = `typing/public`;
    } else if (type === 'private') {
        const chatId = getChatId(currentUser.id, id);
        typingPath = `typing/${chatId}`;
    }
    
    if (typingPath) {
        typingRef = db.ref(typingPath);
        typingRef.on('value', (snapshot) => {
            const typingUsersData = snapshot.val();
            if (typingUsersData) {
                const userIds = Object.keys(typingUsersData);
                // 过滤掉当前用户
                const otherUsers = userIds.filter(userId => userId !== currentUser.id);
                
                if (otherUsers.length > 0) {
                    // 获取用户名
                    const usernames = otherUsers.map(userId => typingUsersData[userId].username);
                    typingUsers.textContent = usernames.join('、');
                    typingIndicator.classList.remove('hidden');
                } else {
                    typingIndicator.classList.add('hidden');
                }
            } else {
                typingIndicator.classList.add('hidden');
            }
        });
    }
}

// 监听用户状态变化
export function listenForUserStatusChanges() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 监听好友状态变化
    const friendsRef = db.ref('friends/' + currentUser.id);
    friendsRef.on('child_added', (snapshot) => {
        const friendId = snapshot.key;
        const friendData = snapshot.val();
        
        if (friendData.status === 'accepted') {
            db.ref('presence/' + friendId).on('value', (presenceSnapshot) => {
                const presence = presenceSnapshot.val() || { isOnline: false };
                updateFriendStatus(friendId, presence.isOnline);
            });
        }
    });
}

// 更新好友状态
function updateFriendStatus(friendId, isOnline) {
    // 更新聊天列表中的状态
    const chatItem = chatsList.querySelector(`[data-chat-id="${friendId}"]`);
    if (chatItem) {
        // 如果是当前聊天，更新聊天头部状态
        if (currentChat.type === 'private' && currentChat.id === friendId) {
            chatStatus.textContent = isOnline ? '在线' : '离线';
        }
    }
    
    // 更新好友列表中的状态
    const friendItem = document.getElementById('friends-list').querySelector(`[data-friend-id="${friendId}"]`);
    if (friendItem) {
        const statusElement = friendItem.querySelector('.friend-status');
        const statusIndicator = friendItem.querySelector('.status-indicator');
        
        if (statusElement && statusIndicator) {
            if (isOnline) {
                statusElement.innerHTML = '<span class="status-indicator status-online pulse-status"></span> 在线';
                statusIndicator.className = 'status-indicator status-online pulse-status';
            } else {
                statusElement.innerHTML = '<span class="status-indicator status-offline"></span> 离线';
                statusIndicator.className = 'status-indicator status-offline';
            }
        }
    }
}

// 处理文件附件
function handleFileAttachment(e) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const files = e.target.files;
    if (!files || files.length === 0 || !currentChat) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploadFile(file);
    }
    
    // 重置输入
    attachmentInput.value = '';
}

// 上传文件
function uploadFile(file) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 显示上传通知
    const notificationId = showNotification(`正在上传: ${file.name}`, 'info');
    
    // 创建存储引用
    const storageRef = storage.ref(`uploads/${currentUser.id}/${Date.now()}_${file.name}`);
    
    // 上传文件
    const uploadTask = storageRef.put(file);
    
    // 监听上传进度
    uploadTask.on('state_changed', 
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            updateNotification(notificationId, `正在上传: ${file.name} (${Math.round(progress)}%)`, 'info');
        },
        (error) => {
            // 上传错误
            console.error('文件上传错误:', error);
            updateNotification(notificationId, `上传失败: ${file.name}`, 'error');
        },
        () => {
            // 上传完成，获取下载URL
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                // 确定文件类型
                let fileType = 'file';
                if (file.type.startsWith('image/')) {
                    fileType = 'image';
                }
                
                // 创建消息对象
                const message = {
                    type: fileType,
                    url: downloadURL,
                    filename: file.name,
                    size: file.size,
                    userId: currentUser.id,
                    username: currentUser.username,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                };
                
                // 保存消息
                saveMessageToDatabase(message);
                
                // 更新通知
                updateNotification(notificationId, `上传完成: ${file.name}`, 'success');
            });
        }
    );
}

// 获取当前聊天信息
export function getCurrentChat() {
    return currentChat;
}

// 获取正在输入引用
export function getTypingRef() {
    return typingRef;
}
    