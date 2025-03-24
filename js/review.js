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

  // NEW: Global variables for navigation and notifications
  let currentIndex = 0;
  let currentReviewNotes = reviewNotes; // all due notes for this session
  let notifications = [];

  // Function to update the progress bar.
  function updateProgress() {
    const percentage = totalDue === 0 ? 100 : Math.round((completedCount / totalDue) * 100);
    progressBar.style.width = percentage + "%";
    progressText.textContent = `${percentage}% Completed`;
    console.log(`Progress updated: ${percentage}% (${completedCount}/${totalDue})`);
  }
  updateProgress();

  // Function to display a specific note
  function displayNote(index) {
    reviewsContainer.innerHTML = ""; // clear container
    if (currentReviewNotes.length === 0) {
      reviewsContainer.innerHTML = "<p>All reviews completed!</p>";
      return;
    }
    // Clamp index in valid range
    if (index < 0) index = 0;
    if (index >= currentReviewNotes.length) index = currentReviewNotes.length - 1;
    currentIndex = index;
    const note = currentReviewNotes[currentIndex];
    // NEW: Display current note number and total
    const noteCountHTML = `<div class="note-count">Note ${currentIndex + 1} of ${currentReviewNotes.length}</div>`;
    const noteContentHTML = `
      <h3>${note.heading || 'Untitled Note'}</h3>
      <div>${note.content}</div>
      <div class="review-feedback-buttons">
        <button class="review-feedback" data-rating="3" data-noteid="${note.id}">Easy</button>
        <button class="review-feedback" data-rating="2" data-noteid="${note.id}">Medium</button>
        <button class="review-feedback" data-rating="1" data-noteid="${note.id}">Hard</button>
      </div>
      <div class="navigation-buttons">
         <button id="prev-note">Previous</button>
         <button id="next-note">Next</button>
      </div>
    `;
    reviewsContainer.innerHTML = noteCountHTML + noteContentHTML;
  }

  // Initial display.
  displayNote(0);

  // Navigation button event listeners.
  reviewsContainer.addEventListener('click', (e) => {
    if (e.target.id === 'prev-note') {
      if (currentIndex > 0) {
         displayNote(currentIndex - 1);
      }
    }
    if (e.target.id === 'next-note') {
      if (currentIndex < currentReviewNotes.length - 1) {
         displayNote(currentIndex + 1);
      }
    }
  });

  // NEW global flag for feedback processing
  let processingFeedback = false;

  // Listen for review feedback clicks.
  reviewsContainer.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('review-feedback')) return;
    e.stopPropagation();

    if (processingFeedback) {
        console.log("Feedback already processing; ignoring duplicate click.");
        return;
    }

    processingFeedback = true;
    const noteId = e.target.getAttribute('data-noteid');
    const rating = parseInt(e.target.getAttribute('data-rating'));

    console.log("Review feedback clicked. Rating:", rating, "for note:", noteId);

    const noteIndex = currentReviewNotes.findIndex(n => n.id == noteId);
    if (noteIndex === -1) {
        console.error("Note not found in session:", noteId);
        processingFeedback = false;
        return;
    }

    let note = currentReviewNotes[noteIndex];

    try {
        // Update the note's review status and schedule
        note.reviewedToday = true;
        await db.saveNote(note);
        console.log("Note saved successfully:", note.id);

        gamification.updateXPFromReview(rating);
        console.log("XP updated for note:", note.id, "with rating:", rating);

        await reviewScheduler.scheduleReview(note);
        console.log("Review scheduled for note:", note.id);

        // Increment completed count and update progress bar
        completedCount++;
        updateProgress();

        addNotification(`Note "${note.heading || 'Untitled'}" reviewed as ${rating === 3 ? 'Easy' : rating === 2 ? 'Medium' : 'Hard'}.`);

        // Remove reviewed note and verify remaining count
        currentReviewNotes.splice(noteIndex, 1);
        console.log("Remaining review notes:", currentReviewNotes.length);

        // Display the next note or show completion message
        if (currentReviewNotes.length === 0) {
            reviewsContainer.innerHTML = "<p>All reviews completed!</p>";
        } else {
            if (currentIndex >= currentReviewNotes.length) {
                currentIndex = currentReviewNotes.length - 1;
            }
            displayNote(currentIndex);
        }
    } catch (err) {
        console.error("Error processing review feedback:", err);
    }

    processingFeedback = false;
  });

  // NEW: Notification functions

  // Show a floating notification that fades out.
  function addNotification(message) {
    const floating = document.createElement('div');
    floating.className = 'floating-notification';
    floating.textContent = message;
    document.body.appendChild(floating);
    setTimeout(() => {
       floating.classList.add('fade-out');
       setTimeout(() => { floating.remove(); }, 1000);
    }, 3000);
    // Also add to persistent notifications.
    notifications.push({ message, timestamp: new Date() });
    renderNotifications();
  }

  // Render the persistent notifications in the panel.
  function renderNotifications() {
    const notifContainer = document.getElementById('notifications-container');
    if (!notifContainer) return;
    notifContainer.innerHTML = "";
    notifications.forEach((notif, index) => {
       const notifDiv = document.createElement('div');
       notifDiv.className = 'notification-item';
       notifDiv.innerHTML = `${notif.message} <button class="delete-notif" data-index="${index}">X</button>`;
       notifContainer.appendChild(notifDiv);
    });
  }

  // Listen for deleting individual notifications and clearing all.
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-notif')) {
       const idx = e.target.getAttribute('data-index');
       notifications.splice(idx, 1);
       renderNotifications();
    }
    if (e.target.id === 'clear-notifs') {
       notifications = [];
       renderNotifications();
    }
  });

  // NEW: Polling to check for new due notes and notify the user.
  setInterval(async () => {
    let updatedNotes = await db.getNotes();
    const now = new Date();
    updatedNotes.forEach(note => {
      if (note.nextReview && new Date(note.nextReview) <= now) {
         const exists = currentReviewNotes.find(n => n.id == note.id);
         if (!exists) {
            currentReviewNotes.push(note);
            addNotification(`New note "${note.heading || 'Untitled'}" added to review session.`);
            updateProgress();
         }
      }
    });
  }, 15000); // check every 15 seconds

  // NEW: Toggle notifications panel when clicking the notification icon.
  const notifIcon = document.getElementById('notification-icon');
  const notifPanel = document.getElementById('notifications-panel');
  if (notifIcon) {
    notifIcon.addEventListener('click', () => {
      if (notifPanel.style.display === 'none' || notifPanel.style.display === '') {
           notifPanel.style.display = 'block';
      } else {
           notifPanel.style.display = 'none';
      }
    });
  }
});
