import { auth, db } from './config.js';
import { initAuthEvents, handleLogout, getCurrentUser, setCurrentUser, updateUserUI, resetAuthUI } from './auth.js';
import { initChatEvents, initChatRefs, loadChats, listenForNewMessages, listenForUserStatusChanges, getTypingRef } from './chat.js';
import { initFriendsEvents, loadFriends } from './friends.js';
import { showNotification } from './utils.js';

// 全局变量
let userPresenceRef = null;
let bansRef = null;

// 初始化应用
function initApp() {
    // 初始化各个模块的事件监听
    initAuthEvents();
    initChatEvents();
    initFriendsEvents();
    
    // 监听认证状态变化
    auth.onAuthStateChanged((user) => {
        if (user) {
            // 用户已登录
            initUser(user);
        } else {
            // 用户未登录
            resetApp();
        }
    });
}

// 初始化用户
function initUser(user) {
    if (!user) return;
    
    // 获取用户信息
    db.ref('users/' + user.uid).once('value')
        .then((snapshot) => {
            const userData = snapshot.val();
            const currentUser = {
                id: user.uid,
                ...userData
            };
            
            // 设置当前用户
            setCurrentUser(currentUser);
            
            // 初始化Firebase引用
            initFirebaseRefs();
            
            // 检查是否被封禁
            checkIfBanned();
            
            // 更新UI
            updateUserUI(currentUser);
            
            // 设置在线状态
            setUserOnlineStatus(true);
            
            // 初始化聊天引用
            initChatRefs();
            
            // 加载聊天和好友
            loadChats();
            loadFriends();
            
            // 监听新消息
            listenForNewMessages();
            
            // 监听用户状态变化
            listenForUserStatusChanges();
        });
}

// 初始化Firebase引用
function initFirebaseRefs() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    userPresenceRef = db.ref('presence/' + currentUser.id);
    bansRef = db.ref('bans');
}

// 检查是否被封禁
function checkIfBanned() {
    const currentUser = getCurrentUser();
    if (!currentUser || !bansRef) return;
    
    bansRef.child(currentUser.id).once('value')
        .then((snapshot) => {
            const banInfo = snapshot.val();
            if (banInfo) {
                const now = Date.now();
                // 检查封禁是否已过期
                if (!banInfo.expiresAt || now < banInfo.expiresAt) {
                    // 用户被封禁
                    showBanMessage(banInfo);
                    handleLogout(userPresenceRef, getTypingRef());
                } else {
                    // 封禁已过期，移除封禁记录
                    bansRef.child(currentUser.id).remove();
                }
            }
        });
}

// 显示封禁消息
function showBanMessage(banInfo) {
    let message = `您的账号已被封禁。\n原因: ${banInfo.reason || '未说明'}\n`;
    
    if (banInfo.expiresAt) {
        const expiresDate = new Date(banInfo.expiresAt);
        message += `解封时间: ${expiresDate.toLocaleString()}`;
    } else {
        message += '这是永久封禁。';
    }
    
    alert(message);
}

// 设置用户在线状态
function setUserOnlineStatus(isOnline) {
    if (!getCurrentUser() || !userPresenceRef) return;
    
    userPresenceRef.set({
        isOnline: isOnline,
        lastActive: firebase.database.ServerValue.TIMESTAMP
    });
    
    // 监听连接状态，断开连接时自动设置为离线
    if (isOnline) {
        db.ref('.info/connected').on('value', (snap) => {
            if (snap.val() === false) {
                return;
            }
            
            userPresenceRef.onDisconnect().update({
                isOnline: false,
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
        });
    }
}

// 重置应用
function resetApp() {
    // 清理监听器
    if (userPresenceRef) userPresenceRef.off();
    if (bansRef) bansRef.off();
    
    // 重置认证界面
    resetAuthUI();
}

// 当页面加载完成后初始化应用
window.onload = initApp;
    