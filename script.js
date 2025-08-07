let tasks = [];
        let editingTaskId = null;
        let draggedElement = null;
        let notificationInterval = null;
        let notifiedTasks = new Set(); // Track which tasks have been notified

        // Initialize app with live updates
        document.addEventListener('DOMContentLoaded', function() {
            loadTasks();
            renderTasks();
            updateProgress();
            initializeDarkMode();
            setupPriorityRadios();
            checkNotificationPermission();
            startNotificationChecker();
            startLiveUpdateSystem();
        });

        // Optimized display update system
        function startLiveUpdateSystem() {
            // Periodic sync check to ensure display stays current
            setInterval(() => {
                const currentTaskCount = document.querySelectorAll('.task-card').length;
                const actualTaskCount = tasks.length;
                
                // If counts don't match, re-render
                if (currentTaskCount !== actualTaskCount) {
                    console.log('Display sync issue detected, updating...');
                    renderTasks();
                    updateProgress();
                }
            }, 3000);
            
            // Update when window gains focus (user returns to tab)
            window.addEventListener('focus', () => {
                renderTasks();
                updateProgress();
            });
        }

        // Task management functions
        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        function openAddTaskModal() {
            try {
                editingTaskId = null;
                
                // Check if modal elements exist
                const modalTitle = document.getElementById('modalTitle');
                const saveButtonText = document.getElementById('saveButtonText');
                const taskModal = document.getElementById('taskModal');
                
                if (!modalTitle || !saveButtonText || !taskModal) {
                    showAlert('❌ Modal error!', 'Modal elements are missing. Please refresh the page.', 'error');
                    return;
                }
                
                modalTitle.textContent = 'Add New Task';
                saveButtonText.textContent = 'Add Task';
                
                // Reset form manually to ensure clean state
                const titleInput = document.getElementById('taskTitle');
                const dueDateInput = document.getElementById('taskDueDate');
                const categorySelect = document.getElementById('taskCategory');
                
                if (titleInput) titleInput.value = '';
                if (dueDateInput) {
                    dueDateInput.value = '';
                    dueDateInput.style.borderColor = '';
                    dueDateInput.style.backgroundColor = '';
                }
                if (categorySelect) categorySelect.value = 'personal';
                
                // Set default priority and ensure it's properly selected
                const allPriorityInputs = document.querySelectorAll('input[name="priority"]');
                allPriorityInputs.forEach(input => input.checked = false);
                
                const mediumPriority = document.querySelector('input[name="priority"][value="medium"]');
                if (mediumPriority) {
                    mediumPriority.checked = true;
                } else {
                    showAlert('❌ Form error!', 'Priority options are not available. Please refresh the page.', 'error');
                    return;
                }
                
                updatePrioritySelection();
                taskModal.classList.remove('hidden');
                
                // Focus on title input with a small delay to ensure modal is visible
                setTimeout(() => {
                    const titleInput = document.getElementById('taskTitle');
                    if (titleInput) {
                        titleInput.focus();
                    }
                }, 100);
                
            } catch (error) {
                console.error('Error opening add task modal:', error);
                showAlert('❌ Something went wrong!', `Could not open the task form: ${error.message}. Please refresh the page and try again.`, 'error');
            }
        }

        function openEditTaskModal(taskId) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            editingTaskId = taskId;
            document.getElementById('modalTitle').textContent = 'Edit Task';
            document.getElementById('saveButtonText').textContent = 'Update Task';
            
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDueDate').value = task.dueDate || '';
            document.getElementById('taskCategory').value = task.category;
            document.querySelector(`input[name="priority"][value="${task.priority}"]`).checked = true;
            updatePrioritySelection();
            
            document.getElementById('taskModal').classList.remove('hidden');
            document.getElementById('taskTitle').focus();
        }

        function closeTaskModal() {
            document.getElementById('taskModal').classList.add('hidden');
            editingTaskId = null;
        }

        function saveTask(event) {
            event.preventDefault();
            
            try {
                // Get form elements with error handling
                const titleElement = document.getElementById('taskTitle');
                const dueDateElement = document.getElementById('taskDueDate');
                const categoryElement = document.getElementById('taskCategory');
                
                if (!titleElement || !dueDateElement || !categoryElement) {
                    showAlert('❌ Form error!', 'Form elements are missing. Please refresh the page and try again.', 'error');
                    return;
                }

                const title = titleElement.value.trim();
                const dueDate = dueDateElement.value;
                const category = categoryElement.value;
                const priorityElement = document.querySelector('input[name="priority"]:checked');

                // Validation checks with specific error messages
                if (!title) {
                    showAlert('❌ Task title is required!', 'Please enter a title for your task.', 'error');
                    titleElement.focus();
                    return;
                }

                if (title.length > 100) {
                    showAlert('❌ Title too long!', 'Task title must be 100 characters or less.', 'error');
                    titleElement.focus();
                    return;
                }

                if (!priorityElement) {
                    showAlert('❌ Priority not selected!', 'Please select a priority level for your task.', 'error');
                    return;
                }

                // Validate due date if provided
                if (dueDate) {
                    const selectedDate = new Date(dueDate);
                    const now = new Date();
                    
                    // Check if date is valid
                    if (isNaN(selectedDate.getTime())) {
                        showAlert('❌ Invalid date format!', 'Please select a valid date and time.', 'error');
                        dueDateElement.focus();
                        return;
                    }

                    // Check if date is in the past (allow 1 minute buffer for current time)
                    const oneMinuteAgo = new Date(now.getTime() - 60000);
                    if (selectedDate < oneMinuteAgo) {
                        showAlert('⏰ Past date selected!', 'The due date cannot be in the past. Please select a future date and time.', 'warning');
                        dueDateElement.focus();
                        return;
                    }

                    // Validate year (must be 4 digits, between 2024 and 2099)
                    const year = selectedDate.getFullYear();
                    if (year < 2024 || year > 2099) {
                        showAlert('📅 Invalid year!', 'Please select a year between 2024 and 2099.', 'error');
                        dueDateElement.focus();
                        return;
                    }
                }

                // Check for duplicate tasks (same title and category) - but allow if user confirms
                const isDuplicate = tasks.some(task => 
                    task.id !== editingTaskId && 
                    task.title.toLowerCase() === title.toLowerCase() && 
                    task.category === category &&
                    !task.completed
                );

                if (isDuplicate) {
                    showAlert('⚠️ Similar task exists!', 'A task with the same title and category already exists. Creating anyway...', 'warning');
                }

                const taskData = {
                    title,
                    dueDate: dueDate || null,
                    category,
                    priority: priorityElement.value,
                    completed: false,
                    createdAt: new Date().toISOString()
                };

                if (editingTaskId) {
                    const taskIndex = tasks.findIndex(t => t.id === editingTaskId);
                    if (taskIndex !== -1) {
                        tasks[taskIndex] = { ...tasks[taskIndex], ...taskData };
                        showAlert('✅ Task updated!', 'Your task has been successfully updated.', 'success');
                    } else {
                        showAlert('❌ Update failed!', 'Could not find the task to update. Please try again.', 'error');
                        return;
                    }
                } else {
                    const newTask = {
                        id: generateId(),
                        ...taskData
                    };
                    tasks.push(newTask);
                    showAlert('🎉 Task added!', `Task "${title}" has been successfully created.`, 'success');
                }

                // Save and update UI immediately
                saveTasks();
                closeTaskModal();
                
                // Immediate display update - no delays needed
                renderTasks();
                updateProgress();
                
                // Single additional render to ensure display is current
                setTimeout(() => {
                    renderTasks();
                    updateProgress();
                }, 10);

            } catch (error) {
                console.error('Error saving task:', error);
                showAlert('❌ Something went wrong!', `Error details: ${error.message}. Please try again or refresh the page.`, 'error');
            }
        }

        function deleteTask(taskId) {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            const task = tasks.find(t => t.id === taskId);
            
            if (taskElement && task) {
                taskElement.classList.add('task-removing');
                
                setTimeout(() => {
                    tasks = tasks.filter(t => t.id !== taskId);
                    saveTasks();
                    renderTasks();
                    updateProgress();
                    
                    showAlert('🗑️ Task deleted!', `"${task.title}" has been removed.`, 'success');
                }, 400);
            }
        }

        function toggleTaskComplete(taskId) {
            try {
                const task = tasks.find(t => t.id === taskId);
                if (!task) {
                    console.error('Task not found:', taskId);
                    showAlert('❌ Error!', 'Task not found. Please refresh the page.', 'error');
                    return;
                }

                task.completed = !task.completed;
                
                // Clear notification tracking when task is completed
                if (task.completed) {
                    notifiedTasks.delete(`overdue-${taskId}`);
                    notifiedTasks.delete(`upcoming-${taskId}`);
                    notifiedTasks.delete(`soon-${taskId}`);
                    
                    // Show completion notification
                    showBrowserNotification(
                        `✅ Task Completed: ${task.title}`,
                        'Great job! Keep up the good work!',
                        '🎉'
                    );
                    
                    showAlert('🎉 Task Completed!', `"${task.title}" has been marked as complete.`, 'success');
                } else {
                    showAlert('📋 Task Reopened!', `"${task.title}" has been marked as incomplete.`, 'info');
                }
                
                saveTasks();
                renderTasks();
                updateProgress();
                
                // Single additional render for instant feedback
                setTimeout(() => {
                    renderTasks();
                    updateProgress();
                }, 10);
                
            } catch (error) {
                console.error('Error toggling task completion:', error);
                showAlert('❌ Something went wrong!', `Could not update task: ${error.message}`, 'error');
            }
        }

        function renderTasks() {
            const taskList = document.getElementById('taskList');
            
            if (!taskList) {
                console.error('Task list element not found');
                return;
            }
            
            // Clear existing content first
            taskList.innerHTML = '';
            
            const searchInput = document.getElementById('searchInput');
            const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
            
            let filteredTasks = tasks;
            
            // Apply search filter
            if (searchTerm) {
                filteredTasks = tasks.filter(task => 
                    task.title.toLowerCase().includes(searchTerm) ||
                    task.category.toLowerCase().includes(searchTerm)
                );
            }

            // Check if all tasks are completed
            const allCompleted = tasks.length > 0 && tasks.every(task => task.completed);
            
            // Handle empty states
            if (filteredTasks.length === 0) {
                let emptyStateHTML = '';
                
                if (searchTerm) {
                    // No search results
                    emptyStateHTML = `
                        <div class="empty-state text-center py-16">
                            <div class="text-8xl mb-6">🔍</div>
                            <h3 class="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-3">No tasks found</h3>
                            <p class="text-gray-500 dark:text-gray-400 text-lg">Try adjusting your search terms</p>
                        </div>
                    `;
                } else if (tasks.length === 0) {
                    // No tasks at all
                    emptyStateHTML = `
                        <div class="empty-state text-center py-16">
                            <p class="text-gray-400 dark:text-gray-500 text-lg font-light">No tasks found. Add a task to get started!</p>
                        </div>
                    `;
                }
                
                taskList.innerHTML = emptyStateHTML;
                return;
            }
            
            // Check if all tasks are completed (and we have tasks)
            if (allCompleted) {
                const completedStateHTML = `
                    <div class="empty-state celebration text-center py-16">
                        <div class="text-8xl mb-6">✅</div>
                        <h3 class="text-2xl font-bold text-green-600 dark:text-green-400 mb-3">All tasks completed!</h3>
                        <p class="text-gray-600 dark:text-gray-300 text-lg mb-6">Fantastic work! You've completed all your tasks.</p>
                        <div class="flex justify-center space-x-4">
                            <button 
                                onclick="openAddTaskModal()" 
                                class="btn-primary text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center space-x-2"
                            >
                                <i class="fas fa-plus"></i>
                                <span>Add More Tasks</span>
                            </button>
                            <button 
                                onclick="clearCompletedTasks()" 
                                class="btn-secondary text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg font-semibold inline-flex items-center space-x-2"
                            >
                                <i class="fas fa-broom"></i>
                                <span>Clear Completed</span>
                            </button>
                        </div>
                    </div>
                `;
                taskList.innerHTML = completedStateHTML;
                return;
            }
            
            // Render task cards with numbering
            const tasksHTML = filteredTasks.map((task, index) => {
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                const isOverdue = dueDate && dueDate < new Date() && !task.completed;
                const dueDateText = dueDate ? 
                    `<div class="text-xs ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500 dark:text-gray-400'} flex items-center mt-2">
                        <i class="fas fa-clock mr-1"></i>
                        ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        ${isOverdue ? ' <span class="text-red-600 font-bold ml-1">(Overdue!)</span>' : ''}
                    </div>` : '';

                const highlightedTitle = searchTerm ? 
                    highlightSearchTerm(task.title, searchTerm) : task.title;

                return `
                    <div 
                        class="task-card ${task.completed ? 'completed' : ''} rounded-xl border priority-${task.priority} cursor-move transition-all duration-300"
                        data-task-id="${task.id}"
                        draggable="true"
                        ondragstart="handleDragStart(event)"
                        ondragover="handleDragOver(event)"
                        ondrop="handleDrop(event)"
                        ondragend="handleDragEnd(event)"
                    >
                        <div class="flex items-start justify-between">
                                <div class="flex items-start space-x-4 flex-1">
                                    <button 
                                        onclick="toggleTaskComplete('${task.id}')"
                                        class="mt-1 w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-green-500 border-green-500 shadow-lg' : 'border-gray-300 dark:border-gray-500 hover:border-green-400'} flex items-center justify-center transition-all duration-200 hover:scale-110"
                                    >
                                        ${task.completed ? '<i class="fas fa-check text-white text-sm"></i>' : ''}
                                    </button>
                                    <div class="flex-1">
                                        <h3 class="task-title font-semibold text-lg text-gray-800 dark:text-white mb-2">${highlightedTitle}</h3>
                                        <div class="flex items-center space-x-3 mb-2">
                                            <span class="category-${task.category} text-white text-xs px-3 py-1 rounded-full font-semibold shadow-sm">
                                                ${task.category.charAt(0).toUpperCase() + task.category.slice(1)}
                                            </span>
                                            <span class="text-xs px-3 py-1 rounded-full font-semibold ${getPriorityClasses(task.priority)}">
                                                ${getPriorityIcon(task.priority)} ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                            </span>
                                        </div>
                                        ${dueDateText}
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2 ml-4">
                                    <button 
                                        onclick="openEditTaskModal('${task.id}')"
                                        class="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                                        title="Edit task"
                                    >
                                        <i class="fas fa-edit text-sm"></i>
                                    </button>
                                    <button 
                                        onclick="deleteTask('${task.id}')"
                                        class="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                                        title="Delete task"
                                    >
                                        <i class="fas fa-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            taskList.innerHTML = tasksHTML;
            
            // Force a reflow to ensure rendering
            taskList.offsetHeight;
        }

        function highlightSearchTerm(text, searchTerm) {
            if (!searchTerm) return text;
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            return text.replace(regex, '<span class="search-highlight">$1</span>');
        }

        function getPriorityClasses(priority) {
            switch(priority) {
                case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700';
                case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700';
                case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700';
                default: return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600';
            }
        }

        function getPriorityIcon(priority) {
            switch(priority) {
                case 'high': return '<i class="fas fa-exclamation-triangle mr-1"></i>';
                case 'medium': return '<i class="fas fa-minus-circle mr-1"></i>';
                case 'low': return '<i class="fas fa-arrow-down mr-1"></i>';
                default: return '';
            }
        }

        function clearCompletedTasks() {
            const completedCount = tasks.filter(t => t.completed).length;
            if (completedCount === 0) {
                showAlert('ℹ️ No completed tasks', 'There are no completed tasks to clear.', 'info');
                return;
            }

            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            renderTasks();
            updateProgress();
            
            showAlert('🧹 Tasks cleared!', `Removed ${completedCount} completed task${completedCount !== 1 ? 's' : ''}.`, 'success');
        }

        function updateProgress() {
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.completed).length;
            const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

            document.getElementById('progressBar').style.width = `${percentage}%`;
            document.getElementById('progressText').textContent = `${completedTasks} of ${totalTasks} completed`;
        }

        // Search functionality with instant updates
        function searchTasks() {
            // Clear any existing search timeout
            if (window.searchTimeout) {
                clearTimeout(window.searchTimeout);
            }
            
            // Immediate update for instant feedback
            renderTasks();
            
            // Debounce search for better performance
            window.searchTimeout = setTimeout(() => {
                renderTasks();
            }, 100);
        }

        // Sort functionality with immediate updates
        function sortTasks() {
            const sortBy = document.getElementById('sortSelect').value;
            
            // Create a copy of tasks to sort
            let sortedTasks = [...tasks];
            
            switch(sortBy) {
                case 'dueDate':
                    sortedTasks.sort((a, b) => {
                        if (!a.dueDate && !b.dueDate) return 0;
                        if (!a.dueDate) return 1;
                        if (!b.dueDate) return -1;
                        return new Date(a.dueDate) - new Date(b.dueDate);
                    });
                    break;
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    sortedTasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
                    break;
                case 'category':
                    sortedTasks.sort((a, b) => a.category.localeCompare(b.category));
                    break;
                default:
                    sortedTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            }
            
            // Update the global tasks array
            tasks = sortedTasks;
            
            // Immediately save and update display
            saveTasks();
            renderTasks();
            updateProgress();
            
            // Show feedback to user
            const sortLabels = {
                'dueDate': 'due date',
                'priority': 'priority level',
                'category': 'category',
                'default': 'creation date'
            };
            
            if (sortBy !== 'default') {
                showAlert('✅ Tasks sorted!', `Tasks are now sorted by ${sortLabels[sortBy]}.`, 'success');
            }
        }

        // Drag and drop functionality
        function handleDragStart(event) {
            const taskCard = event.target.closest('.task-card');
            if (!taskCard) return;
            
            draggedElement = taskCard;
            taskCard.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', taskCard.dataset.taskId);
        }

        function handleDragOver(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            
            const taskList = document.getElementById('taskList');
            const afterElement = getDragAfterElement(taskList, event.clientY);
            const dragging = document.querySelector('.dragging');
            
            if (!dragging) return;
            
            if (afterElement == null) {
                taskList.appendChild(dragging);
            } else {
                taskList.insertBefore(dragging, afterElement);
            }
        }

        function handleDrop(event) {
            event.preventDefault();
            
            const draggedTaskId = event.dataTransfer.getData('text/plain');
            if (!draggedTaskId) return;
            
            // Get new order based on DOM
            const taskElements = Array.from(document.querySelectorAll('.task-card'));
            const newOrder = taskElements.map(el => el.dataset.taskId).filter(Boolean);
            
            // Reorder tasks array
            const reorderedTasks = [];
            newOrder.forEach(taskId => {
                const task = tasks.find(t => t.id === taskId);
                if (task) reorderedTasks.push(task);
            });
            
            // Add any missing tasks (safety check)
            tasks.forEach(task => {
                if (!reorderedTasks.find(t => t.id === task.id)) {
                    reorderedTasks.push(task);
                }
            });
            
            tasks = reorderedTasks;
            saveTasks();
            
            // Re-render to ensure consistency
            setTimeout(() => {
                renderTasks();
                updateProgress();
            }, 50);
        }

        function handleDragEnd(event) {
            const taskCard = event.target.closest('.task-card');
            if (taskCard) {
                taskCard.classList.remove('dragging');
            }
            draggedElement = null;
        }

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // Enhanced Dark mode functionality with smooth transitions
        function toggleDarkMode() {
            const html = document.documentElement;
            const isDarkMode = html.classList.contains('dark');
            
            // Add transition class for smooth theme switching
            html.style.transition = 'background-color 0.3s ease, color 0.3s ease';
            
            if (isDarkMode) {
                html.classList.remove('dark');
                localStorage.setItem('darkMode', 'false');
                showAlert('☀️ Light mode enabled!', 'Switched to light theme.', 'success');
            } else {
                html.classList.add('dark');
                localStorage.setItem('darkMode', 'true');
                showAlert('🌙 Dark mode enabled!', 'Switched to dark theme.', 'success');
            }
            
            // Remove transition after animation completes
            setTimeout(() => {
                html.style.transition = '';
            }, 300);
        }

        function initializeDarkMode() {
            const savedDarkMode = localStorage.getItem('darkMode');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            // Apply dark mode based on saved preference or system preference
            if (savedDarkMode === 'true' || (!savedDarkMode && prefersDark)) {
                document.documentElement.classList.add('dark');
            }
            
            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!localStorage.getItem('darkMode')) {
                    if (e.matches) {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }
                }
            });
        }

        // Priority radio button styling
        function setupPriorityRadios() {
            const priorityLabels = document.querySelectorAll('input[name="priority"]');
            priorityLabels.forEach(radio => {
                radio.addEventListener('change', updatePrioritySelection);
            });
            updatePrioritySelection();
        }

        function updatePrioritySelection() {
            const priorityLabels = document.querySelectorAll('input[name="priority"]');
            priorityLabels.forEach(radio => {
                const label = radio.closest('label');
                if (radio.checked) {
                    label.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
                } else {
                    label.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
                }
            });
        }

        // Local storage functions
        function saveTasks() {
            localStorage.setItem('todoTasks', JSON.stringify(tasks));
        }

        function loadTasks() {
            const savedTasks = localStorage.getItem('todoTasks');
            if (savedTasks) {
                tasks = JSON.parse(savedTasks);
            }
        }

        // Notification functionality
        function checkNotificationPermission() {
            if ('Notification' in window && Notification.permission === 'default') {
                document.getElementById('notificationBanner').classList.remove('hidden');
            }
        }

        function requestNotificationPermission() {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    hideNotificationBanner();
                    if (permission === 'granted') {
                        showNotification('Notifications enabled!', 'You\'ll now receive reminders for upcoming tasks.');
                    }
                });
            }
        }

        function hideNotificationBanner() {
            document.getElementById('notificationBanner').classList.add('hidden');
        }

        function showNotification(title, body, icon = '📋') {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                    body: body,
                    icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
                    requireInteraction: true
                });
            }
        }

        // Enhanced notification function with better control
        function showBrowserNotification(title, body, icon = '📋', requireInteraction = false) {
            // Check if notifications are supported and permitted
            if (!('Notification' in window)) {
                console.log('Browser notifications not supported');
                return;
            }

            if (Notification.permission === 'granted') {
                // Create notification with sound and vibration
                const notification = new Notification(title, {
                    body: body,
                    icon: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${icon}</text></svg>`,
                    requireInteraction: requireInteraction,
                    tag: 'todo-task', // Prevents duplicate notifications
                    badge: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📋</text></svg>`,
                    timestamp: Date.now(),
                    silent: false, // Allow sound
                    vibrate: [200, 100, 200] // Vibration pattern for mobile
                });

                // Add click handler to focus the app
                notification.onclick = function() {
                    window.focus();
                    notification.close();
                };

                // Auto-close non-critical notifications after 8 seconds
                if (!requireInteraction) {
                    setTimeout(() => {
                        notification.close();
                    }, 8000);
                }

                // Show in-app alert as backup
                showAlert(title, body, requireInteraction ? 'error' : 'warning');

            } else if (Notification.permission === 'default') {
                // Request permission and show notification if granted
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        showBrowserNotification(title, body, icon, requireInteraction);
                    } else {
                        // Fallback to in-app alert
                        showAlert(title, body, requireInteraction ? 'error' : 'warning');
                    }
                });
            } else {
                // Permission denied, use in-app alert
                showAlert(title, body, requireInteraction ? 'error' : 'warning');
            }
        }

        // Alert system for user feedback
        function showAlert(title, message, type = 'info') {
            // Remove existing alerts
            const existingAlert = document.getElementById('customAlert');
            if (existingAlert) {
                existingAlert.remove();
            }

            const alertColors = {
                success: 'bg-green-500 border-green-600',
                error: 'bg-red-500 border-red-600',
                warning: 'bg-yellow-500 border-yellow-600',
                info: 'bg-blue-500 border-blue-600'
            };

            const alertHTML = `
                <div id="customAlert" class="fixed top-4 right-4 z-50 max-w-sm w-full mx-4 transform transition-all duration-300 ease-in-out translate-x-full opacity-0">
                    <div class="${alertColors[type]} text-white p-4 rounded-lg shadow-lg border-l-4">
                        <div class="flex items-start">
                            <div class="flex-1">
                                <h4 class="font-semibold text-sm mb-1">${title}</h4>
                                <p class="text-sm opacity-90">${message}</p>
                            </div>
                            <button onclick="closeAlert()" class="ml-3 text-white hover:text-gray-200 transition-colors">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', alertHTML);
            
            // Animate in
            setTimeout(() => {
                const alert = document.getElementById('customAlert');
                if (alert) {
                    alert.classList.remove('translate-x-full', 'opacity-0');
                    alert.classList.add('translate-x-0', 'opacity-100');
                }
            }, 100);

            // Auto close after 5 seconds
            setTimeout(() => {
                closeAlert();
            }, 5000);
        }

        function closeAlert() {
            const alert = document.getElementById('customAlert');
            if (alert) {
                alert.classList.add('translate-x-full', 'opacity-0');
                setTimeout(() => {
                    alert.remove();
                }, 300);
            }
        }

        // Validate date input in real-time
        function validateDateInput(input) {
            const selectedDate = new Date(input.value);
            const now = new Date();
            
            if (input.value && selectedDate < now) {
                input.style.borderColor = '#ef4444';
                input.style.backgroundColor = '#fef2f2';
                showAlert('⏰ Past date selected!', 'Please select a future date and time.', 'warning');
                
                // Reset to current time after 2 seconds
                setTimeout(() => {
                    input.style.borderColor = '';
                    input.style.backgroundColor = '';
                }, 2000);
            } else {
                input.style.borderColor = '';
                input.style.backgroundColor = '';
            }
        }

        function startNotificationChecker() {
            // Check for tasks every 30 seconds for better responsiveness
            notificationInterval = setInterval(() => {
                const now = new Date();
                
                // Check for overdue tasks
                const overdueTasks = tasks.filter(task => {
                    if (!task.dueDate || task.completed) return false;
                    const dueDate = new Date(task.dueDate);
                    return dueDate < now;
                });

                // Check for upcoming tasks (15 minutes before)
                const upcomingTasks = tasks.filter(task => {
                    if (!task.dueDate || task.completed) return false;
                    const dueDate = new Date(task.dueDate);
                    const timeDiff = dueDate - now;
                    return timeDiff > 0 && timeDiff <= 15 * 60 * 1000;
                });

                // Check for tasks due in 1 hour
                const soonTasks = tasks.filter(task => {
                    if (!task.dueDate || task.completed) return false;
                    const dueDate = new Date(task.dueDate);
                    const timeDiff = dueDate - now;
                    return timeDiff > 15 * 60 * 1000 && timeDiff <= 60 * 60 * 1000;
                });

                // Send notifications for overdue tasks
                overdueTasks.forEach(task => {
                    const notificationKey = `overdue-${task.id}`;
                    if (!notifiedTasks.has(notificationKey)) {
                        const dueDate = new Date(task.dueDate);
                        const hoursOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60));
                        const minutesOverdue = Math.floor((now - dueDate) / (1000 * 60));
                        
                        let overdueText = '';
                        if (hoursOverdue > 0) {
                            overdueText = `${hoursOverdue} hour${hoursOverdue !== 1 ? 's' : ''} overdue`;
                        } else {
                            overdueText = `${minutesOverdue} minute${minutesOverdue !== 1 ? 's' : ''} overdue`;
                        }
                        
                        showBrowserNotification(
                            `⚠️ OVERDUE: ${task.title}`,
                            `This task is ${overdueText}. Please complete it now!`,
                            '🚨',
                            true // requireInteraction for overdue tasks
                        );
                        
                        notifiedTasks.add(notificationKey);
                        // Re-notify overdue tasks every 30 minutes
                        setTimeout(() => {
                            notifiedTasks.delete(notificationKey);
                        }, 30 * 60 * 1000);
                    }
                });

                // Send notifications for upcoming tasks (15 minutes)
                upcomingTasks.forEach(task => {
                    const notificationKey = `upcoming-${task.id}`;
                    if (!notifiedTasks.has(notificationKey)) {
                        const dueDate = new Date(task.dueDate);
                        const minutesLeft = Math.ceil((dueDate - now) / (1000 * 60));
                        showBrowserNotification(
                            `⏰ Task Due Soon: ${task.title}`,
                            `Due in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}. Get ready to complete it!`,
                            '⏰'
                        );
                        
                        notifiedTasks.add(notificationKey);
                    }
                });

                // Send notifications for tasks due in 1 hour
                soonTasks.forEach(task => {
                    const notificationKey = `soon-${task.id}`;
                    if (!notifiedTasks.has(notificationKey)) {
                        const dueDate = new Date(task.dueDate);
                        const minutesLeft = Math.ceil((dueDate - now) / (1000 * 60));
                        showBrowserNotification(
                            `📋 Upcoming Task: ${task.title}`,
                            `Due in ${minutesLeft} minutes. Start preparing!`,
                            '📋'
                        );
                        
                        notifiedTasks.add(notificationKey);
                    }
                });

            }, 30000); // Check every 30 seconds for better responsiveness
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', function(event) {
            // Ctrl/Cmd + N to add new task
            if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
                event.preventDefault();
                openAddTaskModal();
            }
            
            // Escape to close modal
            if (event.key === 'Escape') {
                closeTaskModal();
            }
        });

        // Close modal when clicking outside
        document.getElementById('taskModal').addEventListener('click', function(event) {
            if (event.target === this) {
                closeTaskModal();
            }
        });

        (function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'96b6fb3cb3e89361',t:'MTc1NDU3MTg4My4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();