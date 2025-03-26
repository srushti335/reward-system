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

  // NEW: Array to track reviewed notes during the session
  let reviewedNotes = [];

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
      displayAllReviewsComplete();
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

  // Function to display the list of reviewed notes
  function displayReviewedNotes() {
    reviewsContainer.innerHTML = "<h2>Reviewed Notes</h2>";
    if (reviewedNotes.length === 0) {
        reviewsContainer.innerHTML += "<p>No notes were reviewed in this session.</p>";
    } else {
        reviewedNotes.forEach(note => {
            reviewsContainer.innerHTML += `
                <div class="reviewed-note">
                    <h3>${note.heading || 'Untitled Note'}</h3>
                    <div>${note.content}</div>
                </div>
            `;
        });
    }
    reviewsContainer.innerHTML += `<button id="back-to-progress" class="button">Back to Progress</button>`;
    document.getElementById('back-to-progress').addEventListener('click', () => {
        displayAllReviewsComplete();
    });
  }

  // Function to display "All reviews complete" message with the button
  function displayAllReviewsComplete() {
    reviewsContainer.innerHTML = `
        <p>All reviews completed!</p>
        <button id="view-reviewed-notes" class="button">View Reviewed Notes</button>
    `;
    document.getElementById('view-reviewed-notes').addEventListener('click', () => {
        displayReviewedNotes();
    });
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

        // Add the note to the reviewedNotes array
        if (!reviewedNotes.some(n => n.id === note.id)) {
            reviewedNotes.push(note);
        }

        // Automatically move to the next note
        if (currentIndex < currentReviewNotes.length - 1) {
            currentIndex++;
            displayNote(currentIndex);
        } else {
            displayAllReviewsComplete();
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

  // NEW: Track IDs of notes already reviewed or notified
  let reviewedNoteIds = new Set();
  let notifiedNoteIds = new Set();

  // Polling to check for new due notes and notify the user.
  setInterval(async () => {
    try {
        let updatedNotes = await db.getNotes();
        const now = new Date();

        updatedNotes.forEach(note => {
            if (note.nextReview && new Date(note.nextReview) <= now) {
                // Check if the note is already reviewed or notified
                if (!reviewedNoteIds.has(note.id) && !notifiedNoteIds.has(note.id)) {
                    // Add the note to the notification list
                    currentReviewNotes.push(note);
                    notifiedNoteIds.add(note.id);
                    addNotification(`New note "${note.heading || 'Untitled'}" added to review session.`);
                    updateProgress();
                }
            }
        });
    } catch (err) {
        console.error("Error during polling for new due notes:", err);
    }
  }, 15000); // Check every 15 seconds

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

  // BroadcastChannel for receiving due note notifications
  const broadcastChannel = new BroadcastChannel('note-due-channel');

  // Function to play a ding sound
  function playDingSound() {
      const audio = new Audio('ding.mp3'); // Ensure ding.mp3 is in the same directory
      audio.play();
  }

  // Listen for messages from the BroadcastChannel
  broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'note-due') {
          const { noteId, heading, content } = event.data;
          console.log(`Received due note notification: ${noteId}`);
          addNotification(`New note due: "${heading}"`);
          playDingSound();

          // Add the note to the current review session if not already present
          if (!currentReviewNotes.some(note => note.id === noteId)) {
              currentReviewNotes.push({ id: noteId, heading, content });
              updateProgress();
          }
      }
  };
});
