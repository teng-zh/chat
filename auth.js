import { auth, db } from './config.js';
import { showNotification } from './utils.js';

// 全局变量
let currentUser = null;

// DOM元素
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const anonymousLoginBtn = document.getElementById('anonymous-login-btn');
const logoutBtn = document.getElementById('logout-btn');

// 初始化认证事件监听
export function initAuthEvents() {
    // 登录/注册标签切换
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
    
    // 登录/注册按钮
    loginBtn.addEventListener('click', handleLogin);
    registerBtn.addEventListener('click', handleRegister);
    anonymousLoginBtn.addEventListener('click', handleAnonymousLogin);
    logoutBtn.addEventListener('click', handleLogout);
}

// 处理登录
function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    
    if (!email || !password) {
        showNotification('请输入邮箱和密码', 'error');
        return;
    }
    
    const persistence = rememberMe ? 'local' : 'session';
    
    auth.setPersistence(persistence)
        .then(() => {
            return auth.signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            // 登录成功后会触发auth状态变化，由app.js处理
        })
        .catch((error) => {
            console.error('登录错误:', error);
            showNotification('登录失败: ' + error.message, 'error');
        });
}

// 处理注册
function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const confirmPassword = document.getElementById('register-confirm-password').value.trim();
    
    if (!username || !email || !password || !confirmPassword) {
        showNotification('请填写所有字段', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('两次输入的密码不一致', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('密码长度至少为6个字符', 'error');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // 保存用户信息
            return db.ref('users/' + user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                avatar: generateAvatar(username)
            });
        })
        .then(() => {
            showNotification('注册成功', 'success');
            // 注册成功后会触发auth状态变化，由app.js处理
        })
        .catch((error) => {
            console.error('注册错误:', error);
            showNotification('注册失败: ' + error.message, 'error');
        });
}

// 处理匿名登录
function handleAnonymousLogin() {
    auth.signInAnonymously()
        .then((userCredential) => {
            const user = userCredential.user;
            
            // 为匿名用户创建临时信息
            const tempUsername = '匿名用户' + Math.floor(Math.random() * 1000);
            
            // 保存用户信息
            return db.ref('users/' + user.uid).set({
                username: tempUsername,
                isAnonymous: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                avatar: generateAvatar(tempUsername)
            });
        })
        .then(() => {
            showNotification('匿名登录成功', 'success');
            // 登录成功后会触发auth状态变化，由app.js处理
        })
        .catch((error) => {
            console.error('匿名登录错误:', error);
            showNotification('登录失败: ' + error.message, 'error');
        });
}

// 处理登出
export function handleLogout(userPresenceRef, typingRef) {
    // 更新在线状态
    if (userPresenceRef) {
        userPresenceRef.set({
            isOnline: false,
            lastActive: firebase.database.ServerValue.TIMESTAMP
        });
    }
    
    // 清除正在输入状态
    if (typingRef) {
        typingRef.remove();
    }
    
    auth.signOut()
        .then(() => {
            // 登出后会触发auth状态变化，由app.js处理
            showNotification('已成功登出', 'success');
        })
        .catch((error) => {
            console.error('登出错误:', error);
            showNotification('登出失败: ' + error.message, 'error');
        });
}

// 获取当前用户
export function getCurrentUser() {
    return currentUser;
}

// 设置当前用户
export function setCurrentUser(user) {
    currentUser = user;
}

// 生成头像
function generateAvatar(username) {
    if (!username) return '<i class="fa fa-user"></i>';
    
    // 取用户名的前两个字符作为头像
    const initials = username.substring(0, 2).toUpperCase();
    return `<span>${initials}</span>`;
}

// 重置认证界面
export function resetAuthUI() {
    // 切换到认证界面
    chatContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    
    // 清空表单
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
    document.getElementById('register-confirm-password').value = '';
    
    // 切换到登录标签
    loginTab.click();
}

// 更新用户界面显示
export function updateUserUI(user) {
    if (!user) return;
    
    // 切换到聊天界面
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    
    // 更新用户信息显示
    document.getElementById('current-user-name').textContent = user.username;
    document.getElementById('current-user-avatar').innerHTML = user.avatar;
}
    