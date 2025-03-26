document.addEventListener('DOMContentLoaded', async () => {
    const feedWrapper = document.querySelector('.feed-wrapper');
    
    // Load actual notes from database
    try {
        const notes = await db.getNotes();
        console.log("Loaded notes:", notes.length);

        // Create note cards for each note
        notes.forEach(note => {
            const noteCard = document.createElement('div');
            noteCard.className = 'note-card';
            noteCard.innerHTML = `
                <div class="note-content">
                    <h2>${note.heading || 'Untitled Note'}</h2>
                    <div>${note.content || 'No content'}</div>
                </div>
            `;
            feedWrapper.appendChild(noteCard);
        });
    } catch (err) {
        console.error("Error loading notes:", err);
        feedWrapper.innerHTML = '<div class="note-card"><div class="note-content"><h2>Error</h2><p>Could not load notes</p></div></div>';
    }

    // Navigation arrows functionality
    document.querySelector('.nav-up').addEventListener('click', () => {
        feedWrapper.scrollBy(0, -window.innerHeight);
    });

    document.querySelector('.nav-down').addEventListener('click', () => {
        feedWrapper.scrollBy(0, window.innerHeight);
    });
});
