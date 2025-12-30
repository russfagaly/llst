// ========== Global State ==========
const STATE = {
    token: localStorage.getItem('token') || null,
    user: null,
    collections: [],
    documents: [],
    currentDocument: null,
    currentView: 'dashboard'
};

// ========== API Helper ==========
const API = {
    baseURL: window.location.origin,

    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (STATE.token && !options.noAuth) {
            headers['Authorization'] = `Bearer ${STATE.token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Request failed');
            }

            return response.json();
        } catch (error) {
            throw error;
        }
    },

    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        return this.request('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
            noAuth: true
        });
    },

    async register(userData) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            noAuth: true
        });
    },

    async getCurrentUser() {
        return this.request('/api/auth/me');
    },

    async getCollections() {
        return this.request('/api/collections');
    },

    async createCollection(data) {
        return this.request('/api/collections', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getDocuments(collectionId = null) {
        const query = collectionId ? `?collection_id=${collectionId}` : '';
        return this.request(`/api/documents${query}`);
    },

    async getDocument(id) {
        return this.request(`/api/documents/${id}`);
    },

    async uploadDocument(file, collectionId) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (STATE.token) {
            headers['Authorization'] = `Bearer ${STATE.token}`;
        }

        const response = await fetch(`${this.baseURL}/api/upload?collection_id=${collectionId}`, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }

        return response.json();
    },

    async deleteDocument(id) {
        return this.request(`/api/documents/${id}`, { method: 'DELETE' });
    },

    async updateCell(cellId, content) {
        return this.request(`/api/cells/${cellId}`, {
            method: 'PUT',
            body: JSON.stringify({ content })
        });
    },

    // Admin endpoints
    async getUsers() {
        return this.request('/api/admin/users');
    },

    async grantAccess(userId, collectionId) {
        return this.request('/api/admin/permissions/grant', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, collection_id: collectionId })
        });
    },

    async revokeAccess(userId, collectionId) {
        return this.request('/api/admin/permissions/revoke', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, collection_id: collectionId })
        });
    }
};

// ========== UI Helper ==========
const UI = {
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    },

    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'flex';
    },

    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    },

    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Show selected view
        document.getElementById(`${viewName}View`).classList.add('active');
        document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

        STATE.currentView = viewName;
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    },

    getStatusText(status) {
        const statuses = ['Pending', 'Processing', 'Completed', 'Failed'];
        return statuses[status] || 'Unknown';
    },

    getStatusClass(status) {
        const classes = ['pending', 'processing', 'completed', 'failed'];
        return classes[status] || 'pending';
    }
};

// ========== Authentication ==========
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        UI.showLoading();
        const data = await API.login(username, password);
        
        STATE.token = data.access_token;
        localStorage.setItem('token', data.access_token);

        await initApp();
        UI.hideLoading();
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const userData = {
        full_name: document.getElementById('regFullName').value,
        username: document.getElementById('regUsername').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value
    };

    try {
        UI.showLoading();
        await API.register(userData);
        UI.hideLoading();
        UI.showToast('Registration successful! Please login.', 'success');
        
        // Switch to login tab
        document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        document.querySelector('[data-tab="login"]').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}

function handleLogout() {
    STATE.token = null;
    STATE.user = null;
    localStorage.removeItem('token');
    
    document.getElementById('authView').style.display = 'flex';
    document.getElementById('appView').style.display = 'none';
}

// ========== App Initialization ==========
async function initApp() {
    try {
        UI.showLoading();
        
        // Get current user
        STATE.user = await API.getCurrentUser();
        
        // Show app, hide auth
        document.getElementById('authView').style.display = 'none';
        document.getElementById('appView').style.display = 'flex';

        // Update UI with user info
        document.getElementById('userName').textContent = STATE.user.full_name || STATE.user.username;

        // Show admin nav if superuser
        if (STATE.user.is_superuser) {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = '';
                el.classList.add('show');
            });
        }

        // Load initial data
        await loadCollections();
        await loadDocuments();

        UI.hideLoading();
    } catch (error) {
        UI.hideLoading();
        UI.showToast('Session expired. Please login again.', 'error');
        handleLogout();
    }
}

// ========== Collections ==========
async function loadCollections() {
    try {
        STATE.collections = await API.getCollections();
        renderCollections();
        updateCollectionSelects();
    } catch (error) {
        UI.showToast('Failed to load collections', 'error');
    }
}

function renderCollections() {
    const grid = document.getElementById('collectionsGrid');
    
    if (STATE.collections.length === 0) {
        grid.innerHTML = '<p class="empty-state">No collections available. Contact admin for access.</p>';
        return;
    }

    grid.innerHTML = STATE.collections.map(col => `
        <div class="collection-card" onclick="filterByCollection(${col.id})">
            <h3>${col.name}</h3>
            <p>${col.description || 'No description'}</p>
            <div class="collection-stats">
                Created ${UI.formatDate(col.created_date)}
            </div>
        </div>
    `).join('');
}

function updateCollectionSelects() {
    const options = STATE.collections.map(col => 
        `<option value="${col.id}">${col.name}</option>`
    ).join('');

    document.getElementById('collectionFilter').innerHTML = 
        '<option value="">All Collections</option>' + options;
    document.getElementById('uploadCollectionSelect').innerHTML = 
        '<option value="">Choose a collection...</option>' + options;
    
    if (document.getElementById('permCollectionSelect')) {
        document.getElementById('permCollectionSelect').innerHTML = 
            '<option value="">Choose a collection...</option>' + options;
    }
}

async function createCollection(e) {
    e.preventDefault();

    const data = {
        name: document.getElementById('collectionName').value,
        description: document.getElementById('collectionDescription').value || null
    };

    try {
        UI.showLoading();
        await API.createCollection(data);
        UI.hideLoading();
        UI.showToast('Collection created successfully', 'success');
        UI.hideModal('createCollectionModal');
        
        document.getElementById('createCollectionForm').reset();
        await loadCollections();
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}

function filterByCollection(collectionId) {
    UI.switchView('dashboard');
    document.getElementById('collectionFilter').value = collectionId;
    loadDocuments(collectionId);
}

// ========== Documents ==========
async function loadDocuments(collectionId = null) {
    try {
        const filter = collectionId || document.getElementById('collectionFilter')?.value;
        STATE.documents = await API.getDocuments(filter || null);
        renderDocuments();
    } catch (error) {
        UI.showToast('Failed to load documents', 'error');
    }
}

function renderDocuments() {
    const grid = document.getElementById('documentsGrid');
    
    if (STATE.documents.length === 0) {
        grid.innerHTML = '<p class="empty-state">No documents yet. Upload your first baseball stats screenshot!</p>';
        return;
    }

    grid.innerHTML = STATE.documents.map(doc => {
        const statusText = UI.getStatusText(doc.processed);
        const statusClass = UI.getStatusClass(doc.processed);

        return `
            <div class="document-card" onclick="viewDocument(${doc.id})">
                <h3>${doc.filename}</h3>
                <p class="document-meta">Uploaded ${UI.formatDate(doc.upload_date)}</p>
                <span class="status status-${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

async function viewDocument(docId) {
    try {
        UI.showLoading();
        STATE.currentDocument = await API.getDocument(docId);
        UI.hideLoading();

        if (STATE.currentDocument.processed !== 2) {
            UI.showToast('Document is still processing. Please wait.', 'warning');
            return;
        }

        renderDocumentDetail();
        UI.switchView('documentDetail');
    } catch (error) {
        UI.hideLoading();
        UI.showToast('Failed to load document', 'error');
    }
}

function renderDocumentDetail() {
    const doc = STATE.currentDocument;
    
    document.getElementById('documentTitle').textContent = doc.filename;
    
    document.getElementById('documentInfo').innerHTML = `
        <h3>Document Information</h3>
        <p><strong>Filename:</strong> ${doc.filename}</p>
        <p><strong>Uploaded:</strong> ${UI.formatDate(doc.upload_date)}</p>
        <p><strong>Status:</strong> ${UI.getStatusText(doc.processed)}</p>
        <p><strong>Tables Found:</strong> ${doc.tables.length}</p>
    `;

    const container = document.getElementById('tablesContainer');
    
    if (doc.tables.length === 0) {
        container.innerHTML = '<p class="empty-state">No tables found in this document</p>';
        return;
    }

    container.innerHTML = doc.tables.map((table, idx) => {
        return `
            <div class="table-card">
                <h3>Table ${table.table_number + 1}</h3>
                <p>Dimensions: ${table.rows} rows × ${table.columns} columns</p>
                <p>Confidence: ${(table.confidence * 100).toFixed(1)}%</p>
                ${renderTable(table)}
            </div>
        `;
    }).join('');
}

function renderTable(table) {
    // Create 2D grid
    const grid = Array(table.rows).fill().map(() => Array(table.columns).fill(null));
    
    // Fill grid with cells
    table.cells.forEach(cell => {
        if (cell.row_index < table.rows && cell.column_index < table.columns) {
            grid[cell.row_index][cell.column_index] = cell;
        }
    });

    // Generate HTML
    let html = '<div class="editable-table"><table><thead><tr>';
    
    // Column headers
    for (let i = 0; i < table.columns; i++) {
        html += `<th>Column ${i + 1}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Table rows
    for (let i = 0; i < table.rows; i++) {
        html += '<tr>';
        for (let j = 0; j < table.columns; j++) {
            const cell = grid[i][j];
            const content = cell ? (cell.content || '') : '';
            const cellId = cell ? cell.id : '';
            
            html += `
                <td>
                    <input
                        type="text"
                        value="${content}"
                        data-cell-id="${cellId}"
                        onblur="handleCellUpdate(${cellId}, this.value)"
                    />
                </td>
            `;
        }
        html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
}

async function handleCellUpdate(cellId, content) {
    try {
        await API.updateCell(cellId, content);
        UI.showToast('Cell updated', 'success');
    } catch (error) {
        UI.showToast('Failed to update cell', 'error');
    }
}

async function handleDeleteDocument() {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        UI.showLoading();
        await API.deleteDocument(STATE.currentDocument.id);
        UI.hideLoading();
        UI.showToast('Document deleted', 'success');
        UI.switchView('dashboard');
        await loadDocuments();
    } catch (error) {
        UI.hideLoading();
        UI.showToast('Failed to delete document', 'error');
    }
}

// ========== File Upload ==========
async function handleUpload(e) {
    e.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const collectionId = document.getElementById('uploadCollectionSelect').value;

    if (!fileInput.files[0]) {
        UI.showToast('Please select a file', 'error');
        return;
    }

    if (!collectionId) {
        UI.showToast('Please select a collection', 'error');
        return;
    }

    try {
        UI.showLoading();
        await API.uploadDocument(fileInput.files[0], collectionId);
        UI.hideLoading();
        UI.showToast('File uploaded! Processing OCR...', 'success');
        UI.hideModal('uploadModal');
        
        document.getElementById('uploadForm').reset();
        document.querySelector('.upload-preview').style.display = 'none';
        document.querySelector('.upload-placeholder').style.display = 'block';
        
        await loadDocuments();
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}

// ========== Admin Functions ==========
async function loadUsers() {
    try {
        const users = await API.getUsers();
        renderUsersTable(users);
        updateUserSelect(users);
    } catch (error) {
        UI.showToast('Failed to load users', 'error');
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('usersTable');
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Full Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.full_name || '-'}</td>
                        <td>${user.is_superuser ? 'Admin' : 'User'}</td>
                        <td>${user.is_active ? 'Active' : 'Inactive'}</td>
                        <td>${user.last_login ? UI.formatDate(user.last_login) : 'Never'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function updateUserSelect(users) {
    const select = document.getElementById('permUserSelect');
    if (select) {
        select.innerHTML = '<option value="">Choose a user...</option>' + 
            users.map(u => `<option value="${u.id}">${u.username} (${u.email})</option>`).join('');
    }
}

async function handleGrantAccess() {
    const userId = document.getElementById('permUserSelect').value;
    const collectionId = document.getElementById('permCollectionSelect').value;

    if (!userId || !collectionId) {
        UI.showToast('Please select both user and collection', 'error');
        return;
    }

    try {
        UI.showLoading();
        await API.grantAccess(parseInt(userId), parseInt(collectionId));
        UI.hideLoading();
        UI.showToast('Access granted successfully', 'success');
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}

async function handleRevokeAccess() {
    const userId = document.getElementById('permUserSelect').value;
    const collectionId = document.getElementById('permCollectionSelect').value;

    if (!userId || !collectionId) {
        UI.showToast('Please select both user and collection', 'error');
        return;
    }

    if (!confirm('Are you sure you want to revoke access?')) return;

    try {
        UI.showLoading();
        await API.revokeAccess(parseInt(userId), parseInt(collectionId));
        UI.hideLoading();
        UI.showToast('Access revoked successfully', 'success');
    } catch (error) {
        UI.hideLoading();
        UI.showToast(error.message, 'error');
    }
}


// ========== Event Listeners ==========
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    if (STATE.token) {
        initApp();
    }

    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tabName}Form`).classList.add('active');
        });
    });

    // Auth forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            UI.switchView(view);
            
            // Load data for specific views
            if (view === 'admin') {
                loadUsers();
            }
        });
    });

    // Collection filter
    document.getElementById('collectionFilter')?.addEventListener('change', (e) => {
        loadDocuments(e.target.value || null);
    });

    // Upload button
    document.getElementById('uploadDocBtn')?.addEventListener('click', () => {
        UI.showModal('uploadModal');
    });

    // Create collection buttons
    document.getElementById('createCollectionBtn')?.addEventListener('click', () => {
        UI.showModal('createCollectionModal');
    });
    document.getElementById('adminCreateCollectionBtn')?.addEventListener('click', () => {
        UI.showModal('createCollectionModal');
    });

    // Forms
    document.getElementById('uploadForm')?.addEventListener('submit', handleUpload);
    document.getElementById('createCollectionForm')?.addEventListener('submit', createCollection);

    // File upload
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('fileInput');
    
    fileUploadArea?.addEventListener('click', () => fileInput.click());
    
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewImage').src = e.target.result;
                document.querySelector('.upload-placeholder').style.display = 'none';
                document.querySelector('.upload-preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('changeFileBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Drag and drop
    fileUploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#1e3a8a';
    });

    fileUploadArea?.addEventListener('dragleave', () => {
        fileUploadArea.style.borderColor = '#d1d5db';
    });

    fileUploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#d1d5db';
        
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                UI.hideModal(modalId);
            }
        });
    });

    // Back buttons
    document.getElementById('backToDashboard')?.addEventListener('click', () => {
        UI.switchView('dashboard');
    });

    document.getElementById('deleteDocumentBtn')?.addEventListener('click', handleDeleteDocument);

    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tabName}Tab`).classList.add('active');
        });
    });

    // Permission buttons
    document.getElementById('grantAccessBtn')?.addEventListener('click', handleGrantAccess);
    document.getElementById('revokeAccessBtn')?.addEventListener('click', handleRevokeAccess);

    // Auto-refresh documents every 5 seconds
    setInterval(() => {
        if (STATE.currentView === 'dashboard' && STATE.token) {
            loadDocuments();
        }
    }, 5000);
});

// Make functions global for onclick handlers
window.viewDocument = viewDocument;
window.filterByCollection = filterByCollection;
window.handleCellUpdate = handleCellUpdate;
