// Global state
let selectedFile = null;
let currentDocument = null;
let documents = [];

// DOM elements
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const documentsList = document.getElementById('documentsList');
const tablesSection = document.getElementById('tablesSection');
const tablesList = document.getElementById('tablesList');
const tableEditor = document.getElementById('tableEditor');
const tableContent = document.getElementById('tableContent');
const backToDocuments = document.getElementById('backToDocuments');
const backToTables = document.getElementById('backToTables');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    uploadBox.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    uploadBtn.addEventListener('click', handleUpload);
    backToDocuments.addEventListener('click', showDocumentsView);
    backToTables.addEventListener('click', showTablesView);

    // Drag and drop
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            selectedFile = files[0];
            fileInput.files = files;
            uploadBtn.disabled = false;
            showToast(`File selected: ${selectedFile.name}`, 'success');
        }
    });
}

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        uploadBtn.disabled = false;
        showToast(`File selected: ${file.name}`, 'success');
    }
}

// Handle upload
async function handleUpload() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading"></span> Uploading...';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const document = await response.json();
        showToast('File uploaded successfully! Processing OCR...', 'success');

        // Reset form
        selectedFile = null;
        fileInput.value = '';
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = 'Upload & Process';

        // Reload documents
        setTimeout(() => loadDocuments(), 1000);

    } catch (error) {
        showToast('Upload failed: ' + error.message, 'error');
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = 'Upload & Process';
    }
}

// Load all documents
async function loadDocuments() {
    try {
        const response = await fetch('/api/documents');
        documents = await response.json();
        renderDocuments();
    } catch (error) {
        showToast('Failed to load documents', 'error');
    }
}

// Render documents list
function renderDocuments() {
    if (documents.length === 0) {
        documentsList.innerHTML = '<p class="empty-state">No documents uploaded yet</p>';
        return;
    }

    documentsList.innerHTML = documents.map(doc => {
        const statusClass = ['pending', 'processing', 'completed', 'failed'][doc.processed];
        const statusText = ['Pending', 'Processing', 'Completed', 'Failed'][doc.processed];

        return `
            <div class="document-card" onclick="viewDocument(${doc.id})">
                <h3>${doc.filename}</h3>
                <p class="document-meta">Uploaded: ${new Date(doc.upload_date).toLocaleString()}</p>
                <span class="status status-${statusClass}">${statusText}</span>
                <div class="card-actions" onclick="event.stopPropagation()">
                    ${doc.processed === 2 ? `<button class="btn btn-secondary" onclick="viewDocument(${doc.id})">View Tables</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteDocument(${doc.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// View document tables
async function viewDocument(documentId) {
    try {
        const response = await fetch(`/api/documents/${documentId}`);
        currentDocument = await response.json();

        if (currentDocument.processed !== 2) {
            showToast('Document is still processing', 'error');
            return;
        }

        showTablesView();
    } catch (error) {
        showToast('Failed to load document', 'error');
    }
}

// Show tables view
function showTablesView() {
    document.querySelector('.upload-section').style.display = 'none';
    document.querySelector('.documents-section').style.display = 'none';
    tablesSection.style.display = 'block';
    tableEditor.style.display = 'none';

    renderTables();
}

// Render tables
function renderTables() {
    if (!currentDocument || !currentDocument.tables || currentDocument.tables.length === 0) {
        tablesList.innerHTML = '<p class="empty-state">No tables found in this document</p>';
        return;
    }

    tablesList.innerHTML = currentDocument.tables.map(table => `
        <div class="table-card" onclick="editTable(${table.id})">
            <h3>Table ${table.table_number + 1}</h3>
            <p class="table-meta">Dimensions: ${table.rows} rows × ${table.columns} columns</p>
            <p class="table-meta">Confidence: ${(table.confidence * 100).toFixed(1)}%</p>
            <p class="table-meta">Extracted: ${new Date(table.extraction_date).toLocaleString()}</p>
            <div class="card-actions" onclick="event.stopPropagation()">
                <button class="btn btn-secondary" onclick="editTable(${table.id})">Edit Table</button>
                <button class="btn btn-danger" onclick="deleteTable(${table.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Edit table
async function editTable(tableId) {
    try {
        const response = await fetch(`/api/tables/${tableId}`);
        const table = await response.json();

        tablesSection.style.display = 'none';
        tableEditor.style.display = 'block';

        renderTableEditor(table);
    } catch (error) {
        showToast('Failed to load table', 'error');
    }
}

// Render table editor
function renderTableEditor(table) {
    // Create a 2D array for the table
    const grid = Array(table.rows).fill().map(() => Array(table.columns).fill(''));

    // Fill grid with cell data
    table.cells.forEach(cell => {
        if (cell.row_index < table.rows && cell.column_index < table.columns) {
            grid[cell.row_index][cell.column_index] = {
                id: cell.id,
                content: cell.content || ''
            };
        }
    });

    // Generate HTML table
    let html = '<table><thead><tr>';

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
            html += `
                <td>
                    <input
                        type="text"
                        value="${cell.content || ''}"
                        data-cell-id="${cell.id}"
                        onblur="updateCell(${cell.id}, this.value)"
                    />
                </td>
            `;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';
    tableContent.innerHTML = html;
}

// Update cell content
async function updateCell(cellId, content) {
    try {
        const response = await fetch(`/api/cells/${cellId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) throw new Error('Update failed');

        showToast('Cell updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update cell', 'error');
    }
}

// Delete document
async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const response = await fetch(`/api/documents/${documentId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Delete failed');

        showToast('Document deleted successfully', 'success');
        loadDocuments();
    } catch (error) {
        showToast('Failed to delete document', 'error');
    }
}

// Delete table
async function deleteTable(tableId) {
    if (!confirm('Are you sure you want to delete this table?')) return;

    try {
        const response = await fetch(`/api/tables/${tableId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Delete failed');

        showToast('Table deleted successfully', 'success');

        // Reload document
        viewDocument(currentDocument.id);
    } catch (error) {
        showToast('Failed to delete table', 'error');
    }
}

// Show documents view
function showDocumentsView() {
    document.querySelector('.upload-section').style.display = 'block';
    document.querySelector('.documents-section').style.display = 'block';
    tablesSection.style.display = 'none';
    tableEditor.style.display = 'none';

    loadDocuments();
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Auto-refresh documents every 5 seconds to update processing status
setInterval(() => {
    if (document.querySelector('.documents-section').style.display !== 'none') {
        loadDocuments();
    }
}, 5000);
