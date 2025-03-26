document.addEventListener('DOMContentLoaded', () => {
    const feedWrapper = document.querySelector('.feed-wrapper');
    
    // Sample notes for testing
    const sampleNotes = [
        { heading: "Note 1", content: "This is the first note" },
        { heading: "Note 2", content: "Second note content" },
        { heading: "Note 3", content: "Third note for review" }
    ];

    // Create note cards
    sampleNotes.forEach(note => {
        const noteCard = document.createElement('div');
        noteCard.className = 'note-card';
        noteCard.innerHTML = `
            <div class="note-content">
                <h2>${note.heading}</h2>
                <p>${note.content}</p>
            </div>
        `;
        feedWrapper.appendChild(noteCard);
    });

    // Navigation arrows functionality
    document.querySelector('.nav-up').addEventListener('click', () => {
        feedWrapper.scrollBy(0, -window.innerHeight);
    });

    document.querySelector('.nav-down').addEventListener('click', () => {
        feedWrapper.scrollBy(0, window.innerHeight);
    });
});
