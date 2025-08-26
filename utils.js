// 工具函数: 生成聊天ID
export function getChatId(userId1, userId2) {
    // 确保聊天ID是一致的，与用户ID顺序无关
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

// 工具函数: 生成头像
export function generateAvatar(username) {
    if (!username) return '<i class="fa fa-user"></i>';
    
    // 取用户名的前两个字符作为头像
    const initials = username.substring(0, 2).toUpperCase();
    return `<span>${initials}</span>`;
}

// 工具函数: 显示通知
export function showNotification(message, type = 'info', onClick = null) {
    const notificationId = 'notify_' + Date.now();
    
    const notification = document.createElement('div');
    notification.id = notificationId;
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'exclamation-circle' :
                 'info-circle';
                 
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fa fa-${icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${type === 'success' ? '成功' : type === 'error' ? '错误' : '信息'}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">
            <i class="fa fa-times"></i>
        </button>
    `;
    
    // 添加点击事件
    if (onClick) {
        notification.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-close')) {
                onClick();
                removeNotification(notificationId);
            }
        });
        notification.style.cursor = 'pointer';
    }
    
    // 添加关闭事件
    notification.querySelector('.notification-close').addEventListener('click', () => {
        removeNotification(notificationId);
    });
    
    document.getElementById('notification-container').appendChild(notification);
    
    // 3秒后自动关闭
    setTimeout(() => {
        removeNotification(notificationId);
    }, 5000);
    
    return notificationId;
}

// 工具函数: 更新通知
export function updateNotification(notificationId, message, type = 'info') {
    const notification = document.getElementById(notificationId);
    if (!notification) return;
    
    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'exclamation-circle' :
                 'info-circle';
                 
    // 更新内容
    notification.querySelector('.notification-message').textContent = message;
    notification.querySelector('.notification-icon i').className = `fa fa-${icon}`;
    
    // 更新类型
    notification.className = `notification ${type}`;
}

// 工具函数: 移除通知
export function removeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(20px)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
}

// 工具函数: 打开模态框
export function openModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// 工具函数: 关闭模态框
export function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('show');
    document.body.style.overflow = '';
}

// 工具函数: 滚动到底部
export function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// 工具函数: 格式化文件大小
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 工具函数: HTML转义
export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 工具函数: 防抖
export function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
    