document.addEventListener('DOMContentLoaded', async () => {
  const reviewsContainer = document.getElementById('reviews-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  // Load all notes from the database.
  let notes = await db.getNotes();
  console.log("Total notes:", notes.length);

  // Use current time to determine due reviews (nextReview in the past or equal to now)
  const now = new Date();
  console.log("Now:", now);

  // Filter notes that are due for review.
  let reviewNotes = notes.filter(note => {
    if (!note.nextReview) {
      console.log(`Note ${note.id} has no nextReview`);
      return false;
    }
    let reviewDate = new Date(note.nextReview);
    console.log(`Note ${note.id} nextReview:`, reviewDate);
    return reviewDate <= now;
  });
  const totalDue = reviewNotes.length;
  let completedCount = 0;
  console.log("Notes due for review:", totalDue);

  // Function to update the progress bar.
  function updateProgress() {
    const percentage = totalDue === 0 ? 100 : Math.round((completedCount / totalDue) * 100);
    progressBar.style.width = percentage + "%";
    progressText.textContent = `${percentage}% Completed`;
  }
  updateProgress();

  // Function to render the next review note.
  function displayNextNote() {
    reviewsContainer.innerHTML = ""; // Clear the container.
    if (reviewNotes.length === 0) {
      reviewsContainer.innerHTML = "<p>All reviews completed!</p>";
      return;
    }
    // Get the first note.
    const note = reviewNotes[0];
    // Create HTML elements for the note and rating buttons.
    const noteDiv = document.createElement('div');
    noteDiv.classList.add('review-note');
    noteDiv.innerHTML = `
      <h3>${note.heading || 'Untitled Note'}</h3>
      <div>${note.content}</div>
      <div class="review-feedback-buttons">
        <button class="review-feedback" data-rating="3" data-noteid="${note.id}">Easy</button>
        <button class="review-feedback" data-rating="2" data-noteid="${note.id}">Medium</button>
        <button class="review-feedback" data-rating="1" data-noteid="${note.id}">Hard</button>
      </div>
    `;
    reviewsContainer.appendChild(noteDiv);
  }

  // Initial display.
  displayNextNote();

  // Listen for review feedback clicks.
  reviewsContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('review-feedback')) {
      const noteId = e.target.getAttribute('data-noteid');
      const rating = parseInt(e.target.getAttribute('data-rating'));
      // Get and remove the current note from the reviewNotes array.
      const currentNoteIndex = reviewNotes.findIndex(n => n.id == noteId);
      if (currentNoteIndex === -1) return;
      let note = reviewNotes.splice(currentNoteIndex, 1)[0];
      // Mark note as reviewed and update schedule.
      note.reviewedToday = true;
      await db.saveNote(note);
      gamification.updateXPFromReview(rating);
      // Optionally adjust review schedule.
      await reviewScheduler.scheduleReview(note);
      completedCount++;
      updateProgress();
      // Display the next note.
      displayNextNote();
    }
  });
});
