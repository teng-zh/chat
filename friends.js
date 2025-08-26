import { db, storage } from './config.js';
import { getCurrentUser } from './auth.js';
import { showNotification, openModal, closeModal, debounce, generateAvatar } from './utils.js';
import { switchToChat } from './chat.js';

// DOM元素
const friendsTab = document.getElementById('friends-tab');
const friendsList = document.getElementById('friends-list');
const findFriendsBtn = document.getElementById('find-friends-btn');

// 初始化好友事件监听
export function initFriendsEvents() {
    // 好友标签切换
    friendsTab.addEventListener('click', () => {
        friendsTab.classList.add('active');
        document.getElementById('chats-tab').classList.remove('active');
        friendsList.classList.remove('hidden');
        document.getElementById('chats-list').classList.add('hidden');
        loadFriends();
    });
    
    // 查找好友按钮
    findFriendsBtn.addEventListener('click', openFindFriendsModal);
}

// 加载好友列表
export function loadFriends() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 清空好友列表
    friendsList.innerHTML = '';
    
    // 添加分组标题
    const onlineHeader = document.createElement('div');
    onlineHeader.className = 'search-bar';
    onlineHeader.innerHTML = '<h3>在线好友</h3>';
    friendsList.appendChild(onlineHeader);
    
    const onlineContainer = document.createElement('div');
    friendsList.appendChild(onlineContainer);
    
    const offlineHeader = document.createElement('div');
    offlineHeader.className = 'search-bar';
    offlineHeader.innerHTML = '<h3>离线好友</h3>';
    friendsList.appendChild(offlineHeader);
    
    const offlineContainer = document.createElement('div');
    friendsList.appendChild(offlineContainer);
    
    // 加载好友
    const friendsRef = db.ref('friends/' + currentUser.id);
    friendsRef.on('child_added', (snapshot) => {
        const friendId = snapshot.key;
        const friendData = snapshot.val();
        
        if (friendData.status === 'accepted') {
            // 获取好友信息
            db.ref('users/' + friendId).once('value')
                .then((userSnapshot) => {
                    const friend = userSnapshot.val();
                    if (friend) {
                        // 获取好友在线状态
                        db.ref('presence/' + friendId).once('value')
                            .then((presenceSnapshot) => {
                                const presence = presenceSnapshot.val() || { isOnline: false };
                                addFriendItem(friend, presence.isOnline, friendData, onlineContainer, offlineContainer);
                            });
                    }
                });
        } else if (friendData.status === 'pending' && friendData.initiator !== currentUser.id) {
            // 显示好友请求
            db.ref('users/' + friendId).once('value')
                .then((userSnapshot) => {
                    const friend = userSnapshot.val();
                    if (friend) {
                        addFriendRequestItem(friend, friendId);
                    }
                });
        }
    });
}

// 添加好友项
function addFriendItem(friend, isOnline, friendData, onlineContainer, offlineContainer) {
    const friendItem = document.createElement('div');
    friendItem.className = 'friend-item';
    friendItem.dataset.friendId = friend.id || friendData.friendId;
    
    const statusClass = isOnline ? 'status-online pulse-status' : 'status-offline';
    const statusText = isOnline ? '在线' : '离线';
    
    friendItem.innerHTML = `
        <div class="avatar">
            ${friend.avatar}
        </div>
        <div class="friend-info">
            <div class="friend-name">${friend.username}</div>
            <div class="friend-status">
                <span class="status-indicator ${statusClass}"></span>
                ${statusText}
            </div>
        </div>
        <div>
            <button class="chat-with-friend btn btn-secondary">
                <i class="fa fa-comment mr-1"></i> 聊天
            </button>
        </div>
    `;
    
    // 添加聊天事件
    friendItem.querySelector('.chat-with-friend').addEventListener('click', () => {
        // 移除之前的active类
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        switchToChat('private', friend.id, friend.username, isOnline ? '在线' : '离线', friend.avatar);
        
        // 在移动端隐藏侧边栏
        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.remove('show');
        }
    });
    
    // 根据在线状态添加到不同容器
    if (isOnline) {
        onlineContainer.appendChild(friendItem);
    } else {
        offlineContainer.appendChild(friendItem);
    }
}

// 添加好友请求项
function addFriendRequestItem(user, userId) {
    const requestItem = document.createElement('div');
    requestItem.className = 'friend-request';
    requestItem.dataset.userId = userId;
    
    requestItem.innerHTML = `
        <div class="friend-item">
            <div class="avatar">
                ${user.avatar}
            </div>
            <div class="friend-info">
                <div class="friend-name">${user.username}</div>
                <div class="friend-status">请求添加你为好友</div>
            </div>
            <div class="request-actions">
                <button class="accept-request request-btn accept-btn">接受</button>
                <button class="decline-request request-btn decline-btn">拒绝</button>
            </div>
        </div>
    `;
    
    // 添加接受/拒绝事件
    requestItem.querySelector('.accept-request').addEventListener('click', () => {
        acceptFriendRequest(userId);
        requestItem.remove();
    });
    
    requestItem.querySelector('.decline-request').addEventListener('click', () => {
        declineFriendRequest(userId);
        requestItem.remove();
    });
    
    // 添加到在线好友上方
    const onlineHeader = friendsList.querySelector('.search-bar');
    friendsList.insertBefore(requestItem, onlineHeader);
}

// 打开查找好友模态框
function openFindFriendsModal() {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    
    modalTitle.textContent = '查找好友';
    modalBody.innerHTML = `
        <div class="form-group">
            <label for="search-friends">搜索用户名或邮箱</label>
            <input type="text" id="search-friends" class="form-control" placeholder="输入用户名或邮箱">
        </div>
        <div id="search-results" class="mt-4 max-h-60 overflow-y-auto" style="border: 1px solid #eee; border-radius: 6px; padding: 10px;">
            <!-- 搜索结果将在这里显示 -->
            <p class="text-center text-gray-500 text-sm">请输入搜索内容</p>
        </div>
    `;
    
    // 隐藏模态框底部按钮
    modalFooter.classList.add('hidden');
    
    // 添加搜索事件
    document.getElementById('search-friends').addEventListener('input', debounce(searchFriends, 500));
    
    openModal();
}

// 搜索好友
function searchFriends() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const query = document.getElementById('search-friends').value.trim().toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    
    if (!query) {
        resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-sm">请输入搜索内容</p>';
        return;
    }
    
    resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-sm">搜索中...</p>';
    
    db.ref('users').once('value')
        .then((snapshot) => {
            const users = snapshot.val();
            const results = [];
            
            if (users) {
                for (const userId in users) {
                    const user = users[userId];
                    // 排除当前用户
                    if (userId === currentUser.id) continue;
                    
                    // 检查用户名或邮箱是否匹配
                    const usernameMatch = user.username && user.username.toLowerCase().includes(query);
                    const emailMatch = user.email && user.email.toLowerCase().includes(query);
                    
                    if (usernameMatch || emailMatch) {
                        results.push({ id: userId, ...user });
                    }
                }
            }
            
            if (results.length === 0) {
                resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-sm">没有找到匹配的用户</p>';
            } else {
                resultsContainer.innerHTML = '';
                results.forEach(user => {
                    addSearchResult(user);
                });
            }
        });
}

// 添加搜索结果
function addSearchResult(user) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const resultsContainer = document.getElementById('search-results');
    
    // 检查好友关系
    db.ref('friends/' + currentUser.id + '/' + user.id).once('value')
        .then((snapshot) => {
            const friendData = snapshot.val();
            let statusText = '';
            let buttonHtml = '';
            
            if (friendData) {
                if (friendData.status === 'pending') {
                    if (friendData.initiator === currentUser.id) {
                        statusText = '等待对方接受';
                        buttonHtml = '<button class="cancel-request btn btn-secondary">取消请求</button>';
                    } else {
                        statusText = '对方已发送请求';
                        buttonHtml = '<button class="accept-request btn btn-primary">接受</button>';
                    }
                } else if (friendData.status === 'accepted') {
                    statusText = '已是好友';
                    buttonHtml = '<button class="chat-btn btn btn-primary">聊天</button>';
                } else if (friendData.status === 'blocked') {
                    statusText = '已屏蔽';
                    buttonHtml = '<button class="unblock-btn btn btn-secondary">解除屏蔽</button>';
                }
            } else {
                statusText = '不是好友';
                buttonHtml = '<button class="add-friend-btn btn btn-primary">添加好友</button>';
            }
            
            const resultItem = document.createElement('div');
            resultItem.className = 'friend-item';
            resultItem.dataset.userId = user.id;
            
            resultItem.innerHTML = `
                <div class="avatar">
                    ${user.avatar || generateAvatar(user.username)}
                </div>
                <div class="friend-info">
                    <div class="friend-name">${user.username}</div>
                    <div class="friend-status">${user.email || ''}</div>
                    <div class="friend-status text-gray-500">${statusText}</div>
                </div>
                <div>
                    ${buttonHtml}
                </div>
            `;
            
            // 添加按钮事件
            if (resultItem.querySelector('.add-friend-btn')) {
                resultItem.querySelector('.add-friend-btn').addEventListener('click', () => {
                    sendFriendRequest(user.id, user.username);
                    resultItem.remove();
                });
            } else if (resultItem.querySelector('.cancel-request')) {
                resultItem.querySelector('.cancel-request').addEventListener('click', () => {
                    cancelFriendRequest(user.id);
                    resultItem.remove();
                });
            } else if (resultItem.querySelector('.accept-request')) {
                resultItem.querySelector('.accept-request').addEventListener('click', () => {
                    acceptFriendRequest(user.id);
                    resultItem.remove();
                });
            } else if (resultItem.querySelector('.chat-btn')) {
                resultItem.querySelector('.chat-btn').addEventListener('click', () => {
                    closeModal();
                    switchToChat('private', user.id, user.username, '', user.avatar);
                });
            } else if (resultItem.querySelector('.unblock-btn')) {
                resultItem.querySelector('.unblock-btn').addEventListener('click', () => {
                    unblockUser(user.id);
                    resultItem.remove();
                });
            }
            
            resultsContainer.appendChild(resultItem);
        });
}

// 发送好友请求
export function sendFriendRequest(userId, username) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 向当前用户的好友列表添加请求
    db.ref('friends/' + currentUser.id + '/' + userId).set({
        status: 'pending',
        initiator: currentUser.id,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // 向目标用户的好友列表添加请求
    db.ref('friends/' + userId + '/' + currentUser.id).set({
        status: 'pending',
        initiator: currentUser.id,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    showNotification(`已向 ${username} 发送好友请求`, 'success');
}

// 取消好友请求
export function cancelFriendRequest(userId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 从当前用户的好友列表移除
    db.ref('friends/' + currentUser.id + '/' + userId).remove();
    
    // 从目标用户的好友列表移除
    db.ref('friends/' + userId + '/' + currentUser.id).remove();
    
    showNotification('好友请求已取消', 'info');
}

// 接受好友请求
export function acceptFriendRequest(userId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 更新当前用户的好友列表
    db.ref('friends/' + currentUser.id + '/' + userId).update({
        status: 'accepted',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // 更新目标用户的好友列表
    db.ref('friends/' + userId + '/' + currentUser.id).update({
        status: 'accepted',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // 获取好友信息
    db.ref('users/' + userId).once('value')
        .then((snapshot) => {
            const friend = snapshot.val();
            if (friend) {
                showNotification(`已接受 ${friend.username} 的好友请求`, 'success');
                // 添加到聊天列表
                addChatItem('private', userId, friend.username, '开始聊天吧', friend.avatar);
            }
        });
}

// 拒绝好友请求
export function declineFriendRequest(userId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 从当前用户的好友列表移除
    db.ref('friends/' + currentUser.id + '/' + userId).remove();
    
    // 从目标用户的好友列表移除
    db.ref('friends/' + userId + '/' + currentUser.id).remove();
    
    showNotification('已拒绝好友请求', 'info');
}

// 添加聊天项
function addChatItem(type, id, name, lastMessage, avatar) {
    const chatsList = document.getElementById('chats-list');
    
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

// 解除屏蔽用户
export function unblockUser(userId) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // 从当前用户的好友列表移除屏蔽状态
    db.ref('friends/' + currentUser.id + '/' + userId).remove();
    
    showNotification('已解除屏蔽', 'info');
}
    