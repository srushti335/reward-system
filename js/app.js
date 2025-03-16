// ...existing code...

let quill;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Quill editor
    quill = new Quill('#note-content-editor', {
        theme: 'snow',
        placeholder: 'Type your note here...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'], // Formatting buttons
                [{ 'list': 'ordered' }, { 'list': 'bullet' }], // Lists
                [{ 'header': [1, 2, 3, false] }], // Headings
                ['clean'] // Remove formatting
            ]
        }
    });

    const saveButton = document.getElementById('save-note');
    saveButton.addEventListener('click', async () => {
        const heading = document.getElementById('note-heading').value;
        const content = quill.root.innerHTML; // Get content from Quill editor
        const reviewEnabled = document.getElementById('toggle-review').checked;
        const note = {
            id: Date.now(),
            heading,
            content,
            reviewEnabled,
            createdAt: new Date(),
            // placeholder for connections
            connections: []
        };
        // save note to the database
        await db.saveNote(note);
        // schedule review if enabled
        if (reviewEnabled) {
            reviewScheduler.scheduleReview(note);
        }
        // update gamification status (stub)
        gamification.addNoteCreatedXP();
        // refresh notes display
        loadNotes();

        // NEW: Clear the editor fields after saving
        document.getElementById('note-heading').value = '';
        quill.root.innerHTML = '';
        document.getElementById('toggle-review').checked = true;
    });
    
    async function loadNotes() {
        const notes = await db.getNotes();
        const container = document.getElementById('notes-container');
        container.innerHTML = '';
        notes.forEach(note => {
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

            // NEW: Handle cases where content is missing or improperly formatted
            let content = note.content || 'No content available';
            if (!content.startsWith('<')) {
                content = `<p>${content}</p>`;
            }

            const manualControls = `
                <div class="manual-controls">
                    <button class="modify-schedule" data-noteid="${note.id}" data-direction="back">Decrease Interval</button>
                    <button class="modify-schedule" data-noteid="${note.id}" data-direction="forward">Increase Interval</button>
                </div>
            `;
            let noteEl = document.createElement('div');
            noteEl.classList.add('note-review-animation');
            noteEl.innerHTML = `
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

        // Attach event listeners for connection toggles
        document.querySelectorAll('.toggle-connections').forEach(btn => {
            btn.addEventListener('click', () => {
                const noteEl = btn.nextElementSibling;
                noteEl.style.display = noteEl.style.display === 'none' ? 'block' : 'none';
            });
        });
    }
    
    loadNotes();
    
    // NEW: Add event listeners for debug mode buttons
    const defaultBtn = document.getElementById('set-default-schedule');
    const optimizedBtn = document.getElementById('set-optimized-schedule');
    if(defaultBtn){
        defaultBtn.addEventListener('click', () => {
            reviewScheduler.setDefaultSchedule();
            alert("Default schedule activated for testing.");
        });
    }
    if(optimizedBtn){
        optimizedBtn.addEventListener('click', () => {
            reviewScheduler.setOptimizedSchedule();
            alert("Optimized schedule activated for testing.");
        });
    }
    
    // ...existing code...
});

// NEW: Add delegated event listener for dynamically generated "Review Now" buttons
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('review-now')) {
        const noteId = e.target.getAttribute('data-noteid');
        openReview(noteId);
    }
});

// NEW: Function to open the review interface for a note.
function openReview(noteId) {
    const reviewContainer = document.getElementById(`review-interface-${noteId}`);
    if (reviewContainer.innerHTML.trim() !== '') return; // Already open
    reviewContainer.innerHTML = `
        <p>How well did you recall this note?</p>
        <button class="review-feedback" data-noteid="${noteId}" data-rating="3">Easy</button>
        <button class="review-feedback" data-noteid="${noteId}" data-rating="2">Medium</button>
        <button class="review-feedback" data-noteid="${noteId}" data-rating="1">Hard</button>
        <p>Manually adjust review schedule:</p>
        <button class="modify-schedule" data-noteid="${noteId}" data-direction="back">Decrease Interval</button>
        <button class="modify-schedule" data-noteid="${noteId}" data-direction="forward">Increase Interval</button>
    `;
    // Attach feedback event listeners
    reviewContainer.querySelectorAll('.review-feedback').forEach(btn => {
        btn.addEventListener('click', () => {
            const rating = parseInt(btn.getAttribute('data-rating'));
            handleReviewFeedback(noteId, rating);
        });
    });
}

// NEW: Delegated listener for "modify-schedule" buttons.
document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('modify-schedule')) {
        const noteId = e.target.getAttribute('data-noteid');
        const direction = e.target.getAttribute('data-direction');
        console.log(`Modify button clicked for note ${noteId} with direction ${direction}`);
        modifyReviewSchedule(noteId, direction);
    }
});

// NEW: Function to modify review schedule for a note based on direction.
async function modifyReviewSchedule(noteId, direction) {
    console.log(`modifyReviewSchedule called for note ${noteId} direction ${direction}`);
    const notes = await db.getNotes();
    const note = notes.find(n => n.id == noteId);
    if (!note) {
        console.error(`Note ${noteId} not found`);
        return;
    }
    await reviewScheduler.modifySchedule(note, direction);
    console.log(`Modified schedule for note ${noteId} with direction ${direction}`);
    // Instead of calling loadNotes(), update the display for this note only.
    updateCountdownForNote(note);
}

// NEW: Function to process review feedback.
async function handleReviewFeedback(noteId, rating) {
    console.log(`Review feedback for note ${noteId}: Rating ${rating}`);
    const notes = await db.getNotes();
    let note = notes.find(n => n.id == noteId);
    if (!note) return;

    // Log performance data and update the review schedule
    reviewScheduler.adjustSchedule({ note: note, rating: rating, time: Date.now() });

    // NEW: Ensure XP is updated based on the rating
    gamification.updateXPFromReview(rating);

    // Remove the review interface after feedback
    document.getElementById(`review-interface-${noteId}`).innerHTML = '';

    // For a "Hard" rating, reset the schedule (starting back at slot 0)
    // For "Easy" or "Medium", leave reviewCount unchanged so schedule advances
    if (rating === 1) {
        note.reviewCount = 0;
    }

    // Re-schedule so that nextReview is updated based on reviewCount
    await reviewScheduler.scheduleReview(note);

    // Retrieve the updated note from DB and update its countdown display
    note = (await db.getNotes()).find(n => n.id == noteId);
    updateCountdownForNote(note);
}

// NEW: Update countdown timers every second as before.
function updateCountdowns() {
    document.querySelectorAll('.countdown[data-next-review]').forEach(elem => {
        const nextReviewTime = parseInt(elem.getAttribute('data-next-review'));
        const diffMs = nextReviewTime - Date.now();
        if(diffMs > 0){
            const totalSeconds = Math.floor(diffMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            elem.innerText = `Next review in: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            elem.innerHTML = `Review due! <button class="review-now" data-noteid="${elem.id.replace('countdown-', '')}">Review Now</button>`;
        }
    });
}
setInterval(updateCountdowns, 1000);

// NEW: Function to update the countdown display for a single note without reloading all notes.
function updateCountdownForNote(note) {
    const countdownElem = document.getElementById(`countdown-${note.id}`);
    if (!countdownElem) return;
    // Update data attribute with the new nextReview time.
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

// Added test function for app.js
function runAppTests() {
    console.log("Running app.js tests...");
    const dummyNote = {
        id: 123456,
        heading: "Test Note",
        content: "Content for test note",
        reviewEnabled: true,
        createdAt: new Date(),
        connections: []
    };
    db.saveNote(dummyNote).then(() => {
        console.log("Test note saved successfully.");
        return db.getNotes();
    }).then(notes => {
        let found = notes.find(n => n.id === 123456);
        console.log("Test note retrieval:", found ? "Success" : "Failure");
    }).catch(err => {
        console.error("Error in app tests:", err);
    });
}
window.runAppTests = runAppTests;
