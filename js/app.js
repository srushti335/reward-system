let quill;

document.addEventListener('DOMContentLoaded', () => {
    // Create floating toolbar element with specific toolbar options
    const toolbarElement = document.createElement('div');
    toolbarElement.id = 'floating-toolbar';
    toolbarElement.className = 'ql-toolbar ql-floating';
    toolbarElement.innerHTML = `
        <span class="ql-formats">
            <button class="ql-bold"></button>
            <button class="ql-italic"></button>
            <button class="ql-underline"></button>
        </span>
        <span class="ql-formats">
            <button class="ql-list" value="ordered"></button>
            <button class="ql-list" value="bullet"></button>
        </span>
        <span class="ql-formats">
            <select class="ql-header">
                <option value="1">Heading 1</option>
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
                <option selected>Normal</option>
            </select>
        </span>
    `;

    document.body.appendChild(toolbarElement);

    // Initialize Quill with custom toolbar
    quill = new Quill('#note-content-editor', {
        theme: 'snow',
        placeholder: 'Type your note here...',
        modules: {
            toolbar: {
                container: '#floating-toolbar'
            }
        }
    });

    // Add keyboard binding for Markdown-like heading shortcuts
    quill.keyboard.addBinding({
        key: 32,               // space key
        collapsed: true,
        prefix: /^#{1,3}$/     // Matches "#" or "##" or "###"
    }, function(range, context) {
        const headerLevel = context.prefix.length; // '#' -> 1, '##' -> 2, etc.
        quill.deleteText(range.index - context.prefix.length, context.prefix.length);
        quill.formatLine(range.index - context.prefix.length, 1, { header: headerLevel });
    });

    // Listen for selection changes in the Quill editor
    quill.on('selection-change', function (range) {
        const toolbar = document.getElementById('floating-toolbar');
        if (range && range.length > 0) {
            toolbar.style.display = 'block';
            requestAnimationFrame(() => {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    const margin = 10;
                    let top = rect.top - toolbar.offsetHeight - margin;
                    if (top < margin) {
                        top = rect.bottom + margin;
                    }
                    let left = rect.left;
                    const viewportWidth = window.innerWidth;
                    if (left + toolbar.offsetWidth > viewportWidth) {
                        left = viewportWidth - toolbar.offsetWidth - margin;
                    }
                    if (left < margin) {
                        left = margin;
                    }
                    toolbar.style.top = `${top}px`;
                    toolbar.style.left = `${left}px`;
                }
            });
        } else {
            toolbar.style.display = 'none';
        }
    });

    // Hide toolbar when clicking outside the editor
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ql-editor') && !e.target.closest('.ql-toolbar')) {
            document.getElementById('floating-toolbar').style.display = 'none';
        }
    });

    // Dark mode toggle
    const darkModeButton = document.getElementById('toggle-dark-mode');
    darkModeButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        darkModeButton.innerText = isDarkMode ? 'Light Mode' : 'Dark Mode';
    });

    // Save note functionality
    const saveButton = document.getElementById('save-note');
    saveButton.addEventListener('click', async () => {
        const heading = document.getElementById('note-heading').value;
        const content = quill.root.innerHTML;
        const reviewEnabled = document.getElementById('toggle-review').checked;
        if (window.currentEditingNoteId) {
            const notes = await db.getNotes();
            let note = notes.find(n => n.id == window.currentEditingNoteId);
            if (note) {
                note.heading = heading;
                note.content = content;
                note.reviewEnabled = reviewEnabled;
                await db.saveNote(note);
            }
            window.currentEditingNoteId = null;
        } else {
            const note = {
                id: Date.now(),
                heading,
                content,
                reviewEnabled,
                createdAt: new Date(),
                connections: []
            };
            await db.saveNote(note);
            if (reviewEnabled) {
                reviewScheduler.scheduleReview(note);
            }
            gamification.addNoteCreatedXP();
        }
        loadNotes();
        document.getElementById('note-heading').value = '';
        quill.root.innerHTML = '';
        document.getElementById('toggle-review').checked = true;
    });

    // Load notes on page load
    loadNotes();

    async function loadNotes() {
        const notes = await db.getNotes();
        const container = document.getElementById('notes-container');
        container.innerHTML = '';
        notes.forEach(note => {
            const optionsMenu = `
                <div class="note-options" data-noteid="${note.id}">
                    ⋮
                    <div class="note-dropdown" style="display:none;">
                        <button class="edit-note" data-noteid="${note.id}">Edit</button>
                        <button class="delete-note" data-noteid="${note.id}">Delete</button>
                    </div>
                </div>`;
            let noteEl = document.createElement('div');
            noteEl.classList.add('note-review-animation');
            noteEl.innerHTML = `
                ${optionsMenu}
                <h3>${note.heading || 'Untitled Note'}</h3>
                <div>${note.content}</div>
            `;

            // Add click handler for the note
            noteEl.addEventListener('click', (e) => {
                // Don't open popup if clicking options menu
                if (e.target.closest('.note-options')) return;
                
                // Create and show popup
                const popup = document.createElement('div');
                popup.className = 'popup-overlay';
                popup.innerHTML = `
                    <div class="popup-content">
                        <button class="popup-close">×</button>
                        <button class="popup-edit">Edit</button>
                        <div class="content-view">
                            <h2>${note.heading || 'Untitled Note'}</h2>
                            <div>${note.content}</div>
                        </div>
                        <div class="editor-container"></div>
                        <button class="popup-save">Save Changes</button>
                    </div>
                `;
                
                document.body.appendChild(popup);

                // Force browser reflow before adding active class
                popup.getBoundingClientRect();

                // Add active class in next frame
                requestAnimationFrame(() => {
                    popup.classList.add('active');
                });

                // Setup edit functionality
                const popupContent = popup.querySelector('.popup-content');
                const editButton = popup.querySelector('.popup-edit');
                const saveButton = popup.querySelector('.popup-save');
                const editorContainer = popup.querySelector('.editor-container');
                let quillEditor = null;

                editButton.addEventListener('click', () => {
                    if (!quillEditor) {
                        quillEditor = createQuillEditor(editorContainer, note.content);
                    }
                    popupContent.classList.add('editing');
                });

                saveButton.addEventListener('click', async () => {
                    const updatedContent = quillEditor.root.innerHTML;
                    note.content = updatedContent;
                    await db.saveNote(note);
                    popupContent.classList.remove('editing');
                    popup.querySelector('.content-view div').innerHTML = updatedContent;
                    loadNotes(); // Refresh the notes list
                });

                // Close handlers
                const closePopup = () => {
                    popup.classList.remove('active');
                    setTimeout(() => popup.remove(), 300);
                };

                popup.querySelector('.popup-close').addEventListener('click', closePopup);
                popup.addEventListener('click', (e) => {
                    if (e.target === popup) closePopup();
                });
            });

            container.appendChild(noteEl);
        });

        document.querySelectorAll('.note-options').forEach(menu => {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = menu.querySelector('.note-dropdown');
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            });
        });

        document.querySelectorAll('.edit-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-noteid');
                editNote(noteId);
            });
        });

        document.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.getAttribute('data-noteid');
                deleteNote(noteId);
            });
        });
    }

    async function editNote(noteId) {
        const notes = await db.getNotes();
        const note = notes.find(n => n.id == noteId);
        if (note) {
            document.getElementById('note-heading').value = note.heading;
            quill.root.innerHTML = note.content;
            document.getElementById('toggle-review').checked = note.reviewEnabled;
            window.currentEditingNoteId = noteId;
        }
    }

    async function deleteNote(noteId) {
        const confirmed = confirm("Are you sure you want to delete this note?");
        if (!confirmed) return;
        try {
            await db.deleteNoteFromDB(noteId);
            loadNotes();
            alert("Note deleted successfully!");
        } catch (err) {
            console.error("Error deleting note:", err);
            alert("Failed to delete note.");
        }
    }

    // Play button and sidebar functionality
    const playButton = document.getElementById('play-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebar-close');

    playButton.addEventListener('click', () => {
        sidebar.classList.add('open');
    });

    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && e.target !== playButton) {
            sidebar.classList.remove('open');
        }
    });
});

function createQuillEditor(container, content) {
    // Create Quill editor
    const editor = new Quill(container, {
        theme: 'snow',
        modules: {
            toolbar: {
                container: '#floating-toolbar'
            }
        }
    });
    
    // Set content
    editor.root.innerHTML = content;
    
    return editor;
}