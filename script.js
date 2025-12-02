// State management
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';
let notificationPermission = Notification.permission;

// DOM elements
const todoInput = document.getElementById('todoInput');
const todoDate = document.getElementById('todoDate');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const todoCount = document.getElementById('todoCount');
const overdueCount = document.getElementById('overdueCount');
const emptyState = document.getElementById('emptyState');
const filterButtons = document.querySelectorAll('.filter-btn');
const notificationBtn = document.getElementById('notificationBtn');
const notificationStatus = document.getElementById('notificationStatus');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    todoDate.setAttribute('min', today);
    
    renderTodos();
    updateStats();
    updateNotificationStatus();
    checkOverdueTasks();
    
    // Check for notifications every minute
    setInterval(checkOverdueTasks, 60000);
    
    // Add event listeners
    addBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    
    notificationBtn.addEventListener('click', requestNotificationPermission);
    
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTodos();
        });
    });
});

// Add new todo
function addTodo() {
    const text = todoInput.value.trim();
    if (text === '') return;
    
    const dueDate = todoDate.value || null;
    
    const todo = {
        id: Date.now(),
        text: text,
        completed: false,
        dueDate: dueDate,
        createdAt: new Date().toISOString()
    };
    
    todos.unshift(todo);
    saveTodos();
    todoInput.value = '';
    todoDate.value = '';
    renderTodos();
    updateStats();
    checkOverdueTasks();
    todoInput.focus();
}

// Toggle todo completion
function toggleTodo(id) {
    todos = todos.map(todo => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    saveTodos();
    renderTodos();
    updateStats();
    checkOverdueTasks();
}

// Delete todo
function deleteTodo(id) {
    todos = todos.filter(todo => todo.id !== id);
    saveTodos();
    renderTodos();
    updateStats();
}

// Filter todos
function getFilteredTodos() {
    switch(currentFilter) {
        case 'active':
            return todos.filter(todo => !todo.completed);
        case 'completed':
            return todos.filter(todo => todo.completed);
        default:
            return todos;
    }
}

// Render todos
function renderTodos() {
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        todoList.style.display = 'none';
        emptyState.classList.add('show');
    } else {
        todoList.style.display = 'block';
        emptyState.classList.remove('show');
    }
    
    todoList.innerHTML = filteredTodos.map(todo => {
        const dueDate = todo.dueDate ? new Date(todo.dueDate + 'T00:00:00') : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = dueDate && dueDate < today && !todo.completed;
        const isToday = dueDate && dueDate.getTime() === today.getTime() && !todo.completed;
        
        let dateDisplay = '';
        if (dueDate) {
            const dateStr = formatDate(dueDate);
            if (isOverdue) {
                dateDisplay = `<span class="todo-date overdue">Overdue: ${dateStr}</span>`;
            } else if (isToday) {
                dateDisplay = `<span class="todo-date today">Due today: ${dateStr}</span>`;
            } else {
                dateDisplay = `<span class="todo-date">Due: ${dateStr}</span>`;
            }
        }
        
        return `
        <li class="todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue-item' : ''}" data-id="${todo.id}">
            <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" onclick="toggleTodo(${todo.id})"></div>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                ${dateDisplay}
            </div>
            <button class="delete-btn" onclick="deleteTodo(${todo.id})" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </li>
    `;
    }).join('');
}

// Update statistics
function updateStats() {
    const activeCount = todos.filter(todo => !todo.completed).length;
    todoCount.textContent = `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} remaining`;
    
    const overdue = getOverdueTasks();
    if (overdue.length > 0) {
        overdueCount.textContent = `${overdue.length} overdue`;
        overdueCount.style.display = 'inline-block';
    } else {
        overdueCount.style.display = 'none';
    }
}

// Get overdue tasks
function getOverdueTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return todos.filter(todo => {
        if (todo.completed || !todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate + 'T00:00:00');
        return dueDate < today;
    });
}

// Check for overdue tasks and send notifications
function checkOverdueTasks() {
    if (notificationPermission !== 'granted') return;
    
    const overdue = getOverdueTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check for overdue tasks
    overdue.forEach(todo => {
        const lastNotified = localStorage.getItem(`notified_${todo.id}`);
        const todayStr = today.toISOString().split('T')[0];
        
        if (lastNotified !== todayStr) {
            showNotification(
                'Task Overdue!',
                `"${todo.text}" was due on ${formatDate(new Date(todo.dueDate + 'T00:00:00'))}`
            );
            localStorage.setItem(`notified_${todo.id}`, todayStr);
        }
    });
    
    // Check for tasks due today
    todos.forEach(todo => {
        if (todo.completed || !todo.dueDate) return;
        
        const dueDate = new Date(todo.dueDate + 'T00:00:00');
        if (dueDate.getTime() === today.getTime()) {
            const lastNotified = localStorage.getItem(`notified_today_${todo.id}`);
            const now = new Date();
            const hour = now.getHours();
            
            // Notify once in the morning (between 8-10 AM)
            if (hour >= 8 && hour < 10 && lastNotified !== today.toISOString().split('T')[0]) {
                showNotification(
                    'Task Due Today!',
                    `"${todo.text}" is due today`
                );
                localStorage.setItem(`notified_today_${todo.id}`, today.toISOString().split('T')[0]);
            }
        }
    });
}

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('This browser does not support notifications');
        return;
    }
    
    if (notificationPermission === 'denied') {
        alert('Notifications are blocked. Please enable them in your browser settings.');
        return;
    }
    
    if (notificationPermission === 'granted') {
        alert('Notifications are already enabled!');
        return;
    }
    
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    updateNotificationStatus();
    
    if (permission === 'granted') {
        showNotification('Notifications Enabled', 'You will now receive reminders for your tasks!');
    }
}

// Show notification
function showNotification(title, body) {
    if (notificationPermission !== 'granted') return;
    
    const notification = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23667eea"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
        tag: 'todo-notification',
        requireInteraction: false
    });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
    
    setTimeout(() => notification.close(), 5000);
}

// Update notification status display
function updateNotificationStatus() {
    if (notificationPermission === 'granted') {
        notificationStatus.textContent = 'Notifications Enabled';
        notificationBtn.classList.add('enabled');
    } else if (notificationPermission === 'denied') {
        notificationStatus.textContent = 'Notifications Blocked';
        notificationBtn.classList.add('blocked');
    } else {
        notificationStatus.textContent = 'Enable Notifications';
        notificationBtn.classList.remove('enabled', 'blocked');
    }
}

// Format date for display
function formatDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) {
        return 'Today';
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    } else {
        const options = { month: 'short', day: 'numeric', year: dateOnly.getFullYear() !== today.getFullYear() ? 'numeric' : undefined };
        return dateOnly.toLocaleDateString('en-US', options);
    }
}

// Save to localStorage
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

