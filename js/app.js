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

    // NEW: Add keyboard binding for Markdown-like heading shortcuts.
    quill.keyboard.addBinding({
        key: 32,               // space key
        collapsed: true,
        prefix: /^#{1,3}$/     // Matches "#" or "##" or "###"
    }, function(range, context) {
        // Determine header level from number of '#' characters
        const headerLevel = context.prefix.length; // '#' -> 1, '##' -> 2, etc.
        // Delete the '#' characters before the cursor.
        quill.deleteText(range.index - context.prefix.length, context.prefix.length);
        // Apply header format to current line.
        quill.formatLine(range.index - context.prefix.length, 1, { header: headerLevel });
    });

    // Revert selection-change handler to previous version:
    // Listen for selection changes in the Quill editor.
    quill.on('selection-change', function (range) {
        const toolbar = document.getElementById('floating-toolbar');
        
        // If there is a selection (non-collapsed range with some content selected)
        if (range && range.length > 0) {
            // Show the floating toolbar.
            toolbar.style.display = 'block';

            // Use requestAnimatiI want to use go and wailsonFrame to ensure the selection has been properly rendered.
            requestAnimationFrame(() => {
                const selection = window.getSelection();
                
                // Proceed if there's at least one range in the current selection.
                if (selection.rangeCount > 0) {
                    // Get the bounding rectangle for the first range of the selection.
                    const rect = selection.getRangeAt(0).getBoundingClientRect();
                    const margin = 10;  // Margin to avoid edge clipping.
                    
                    // Calculate the initial top position above the selection.
                    let top = rect.top - toolbar.offsetHeight - margin;
                    
                    // If not enough space above, position the toolbar below the selection.
                    if (top < margin) {
                        top = rect.bottom + margin;
                    }
                    
                    // Initially align the toolbar's left with the selection's left.
                    let left = rect.left;
                    const viewportWidth = window.innerWidth;
                    
                    // Adjust left position if toolbar overflows the right edge of the viewport.
                    if (left + toolbar.offsetWidth > viewportWidth) {
                        left = viewportWidth - toolbar.offsetWidth - margin;
                    }
                    
                    // Ensure the toolbar doesn't go off the left edge.
                    if (left < margin) { 
                        left = margin; 
                    }
                    
                    // Apply the calculated position to the toolbar.
                    toolbar.style.top = `${top}px`;
                    toolbar.style.left = `${left}px`;
                }
            });
        } else {
            // Hide the toolbar if selection is collapsed or absent.
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

    // Save note functionality (create or update based on window.currentEditingNoteId)
    const saveButton = document.getElementById('save-note');
    saveButton.addEventListener('click', async () => {
        const heading = document.getElementById('note-heading').value;
        const content = quill.root.innerHTML;
        const reviewEnabled = document.getElementById('toggle-review').checked;
        if (window.currentEditingNoteId) {
            // Update existing note
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
            // Create new note
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

    // LOAD NOTES on page load
    loadNotes();  // added to load saved notes immediately on page load

    // Load notes and inject vertical (kebab) menu for options
    async function loadNotes() {
        const notes = await db.getNotes();
        console.log("Loaded notes count:", notes.length); // Debug log
        const container = document.getElementById('notes-container');
        container.innerHTML = ''; // Clear container
        notes.forEach(note => {
            // Countdown HTML
            let countdownHTML = '';
            if (note.nextReview) {
                const diff = new Date(note.nextReview) - Date.now();
                if (diff > 0) {
                    countdownHTML = `<div id="countdown-${note.id}" class="countdown" data-next-review="${new Date(note.nextReview).getTime()}">Calculating...</div>`;
                } else {
                    countdownHTML = `<div id="countdown-${note.id}" class="countdown" data-next-review="${new Date(note.nextReview).getTime()}">Review due! <button class="review-now" data-noteid="${note.id}">Review Now</button></div>`;
                }
            } else {
                countdownHTML = `<div class="countdown">No review scheduled</div>`;
            }
            // Format note content if not HTML
            let content = note.content || 'No content available';
            if (!content.startsWith('<')) {
                content = `<p>${content}</p>`;
            }
            // Manual schedule controls
            const manualControls = `
                <div class="manual-controls">
                    <button class="modify-schedule" data-noteid="${note.id}" data-direction="back">Decrease Interval</button>
                    <button class="modify-schedule" data-noteid="${note.id}" data-direction="forward">Increase Interval</button>
                </div>`;
            // Vertical 3-dot options menu
            const optionsMenu = `
                <div class="note-options" data-noteid="${note.id}">
                    ⋮
                    <div class="note-dropdown" style="display:none;">
                        <button class="edit-note" data-noteid="${note.id}">Edit</button>
                        <button class="delete-note" data-noteid="${note.id}">Delete</button>
                    </div>
                </div>`;
            // Build note element
            let noteEl = document.createElement('div');
            noteEl.classList.add('note-review-animation');
            noteEl.innerHTML = `
                ${optionsMenu}
                <h3>${note.heading || 'Untitled Note'}</h3>
                <div>${content}</div>
                ${countdownHTML}
                ${manualControls}
                <button class="toggle-connections" data-noteid="${note.id}">Show Connections</button>
                <div class="connections" style="display:none;">
                    ${note.connections && note.connections.length ? note.connections.join(', ') : 'No connections'}
                </div>
                <div id="review-interface-${note.id}" class="review-interface"></div>
            `;
            container.appendChild(noteEl);
        });
        
        // Attach event listeners for the dropdown menu and other controls
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
        document.querySelectorAll('.toggle-connections').forEach(btn => {
            btn.addEventListener('click', () => {
                const con = btn.nextElementSibling;
                con.style.display = con.style.display === 'none' ? 'block' : 'none';
            });
        });
    }

    // Edit note: load note into the editor for updating
    async function editNote(noteId) {
        const notes = await db.getNotes();
        const note = notes.find(n => n.id == noteId);
        if (note) {
            document.getElementById('note-heading').value = note.heading;
            quill.root.innerHTML = note.content;
            document.getElementById('toggle-review').checked = note.reviewEnabled;
            window.currentEditingNoteId = noteId;
            document.getElementById('new-note').scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Delete note: confirm, try deletion and reload notes with feedback
    async function deleteNote(noteId) {
        const confirmed = confirm("Are you sure you want to delete this note?");
        if (!confirmed) return;
        try {
            // Call the delete function from the db module.
            await db.deleteNoteFromDB(noteId);
            loadNotes();  // refresh notes display after deletion
            alert("Note deleted successfully!");
        } catch (err) {
            console.error("Error deleting note:", err);
            alert("Failed to delete note.");
        }
    }

    // Update countdown timers every second
    function updateCountdowns() {
        document.querySelectorAll('.countdown[data-next-review]').forEach(elem => {
            const nextReviewTime = parseInt(elem.getAttribute('data-next-review'));
            const diffMs = nextReviewTime - Date.now();
            if(diffMs > 0) {
                const totalSeconds = Math.floor(diffMs / 1000);
                const hours = Math.floor(totalSeconds / 3600);
                const minutes = Math.floor((totalSeconds % 3600) / 60);
                const seconds = totalSeconds % 60;
                elem.innerText = `Next review in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                elem.innerHTML = `Review due! <button class="review-now" data-noteid="${elem.id.replace('countdown-','')}">Review Now</button>`;
            }
        });
    }
    setInterval(updateCountdowns, 1000);

    // Open review interface for a note
    function openReview(noteId) {
        const reviewContainer = document.getElementById(`review-interface-${noteId}`);
        if (reviewContainer.innerHTML.trim() !== '') return;
        reviewContainer.innerHTML = `
            <p>How well did you recall this note?</p>
            <button class="review-feedback" data-noteid="${noteId}" data-rating="3">Easy</button>
            <button class="review-feedback" data-noteid="${noteId}" data-rating="2">Medium</button>
            <button class="review-feedback" data-noteid="${noteId}" data-rating="1">Hard</button>
            <p>Manually adjust review schedule:</p>
            <button class="modify-schedule" data-noteid="${noteId}" data-direction="back">Decrease Interval</button>
            <button class="modify-schedule" data-noteid="${noteId}" data-direction="forward">Increase Interval</button>
        `;
        reviewContainer.querySelectorAll('.review-feedback').forEach(btn => {
            btn.addEventListener('click', () => {
                const rating = parseInt(btn.getAttribute('data-rating'));
                handleReviewFeedback(noteId, rating);
            });
        });
    }

    // Delegate "Review Now" button clicks
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('review-now')) {
            const noteId = e.target.getAttribute('data-noteid');
            openReview(noteId);
        }
    });

    // Listen for modify-schedule button clicks
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('modify-schedule')) {
            const noteId = e.target.getAttribute('data-noteid');
            const direction = e.target.getAttribute('data-direction');
            console.log(`Modify button clicked for note ${noteId} with direction ${direction}`);
            modifyReviewSchedule(noteId, direction);
        }
    });

    async function modifyReviewSchedule(noteId, direction) {
        console.log(`modifyReviewSchedule called for note ${noteId} direction ${direction}`);
        const notes = await db.getNotes();
        const note = notes.find(n => n.id == noteId);
        if (!note) {
            console.error(`Note ${noteId} not found`);
            return;
        }
        await reviewScheduler.modifySchedule(note, direction);
        updateCountdownForNote(note);
    }

    async function handleReviewFeedback(noteId, rating) {
        console.log(`Review feedback for note ${noteId}: Rating ${rating}`);
        const notes = await db.getNotes();
        let note = notes.find(n => n.id == noteId);
        if (!note) return;
        reviewScheduler.adjustSchedule({ note, rating, time: Date.now() });
        gamification.updateXPFromReview(rating);
        document.getElementById(`review-interface-${noteId}`).innerHTML = '';
        if (rating === 1) {
            note.reviewCount = 0;
        }
        await reviewScheduler.scheduleReview(note);
        note = (await db.getNotes()).find(n => n.id == noteId);
        updateCountdownForNote(note);
    }

    function updateCountdownForNote(note) {
        const countdownElem = document.getElementById(`countdown-${note.id}`);
        if (!countdownElem) return;
        countdownElem.setAttribute('data-next-review', new Date(note.nextReview).getTime());
        const diffMs = new Date(note.nextReview) - Date.now();
        if (diffMs > 0) {
            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            countdownElem.innerText = `Next review in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            countdownElem.innerHTML = `Review due! <button class="review-now" data-noteid="${note.id}">Review Now</button>`;
        }
    }

    // Run app tests if defined
    window.runAppTests && window.runAppTests();
    
    // After initializing Quill and appending the floating toolbar, add:
    const headerSelect = document.querySelector('.ql-header');
    if(headerSelect){
        headerSelect.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // After the existing code that initializes Quill and the selection-change handler, add:

    quill.root.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
            // Allow the deletion to occur, then check the selection immediately
            setTimeout(() => {
                let sel = quill.getSelection();
                if (!sel || sel.length === 0) {
                    document.getElementById('floating-toolbar').style.display = 'none';
                }
            }, 0);
        }
    });
});

// BroadcastChannel for notifying due notes
const broadcastChannel = new BroadcastChannel('note-due-channel');

// Function to notify when a note becomes due
function notifyDueNotes() {
    const now = new Date();
    db.getNotes().then(notes => {
        notes.forEach(note => {
            if (note.nextReview && new Date(note.nextReview) <= now) {
                broadcastChannel.postMessage({
                    type: 'note-due',
                    noteId: note.id,
                    heading: note.heading || 'Untitled Note',
                    content: note.content || 'No content available'
                });
                console.log(`Broadcasted due note: ${note.id}`);
            }
        });
    });
}

// Check for due notes every 15 seconds
setInterval(notifyDueNotes, 15000);