const reviewScheduler = (function () {
    // Placeholder NN model initialization with TensorFlow.js
    let model;
    
    async function initModel() {
        // Simple sequential model stub – train and optimize later.
        model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [3], units: 10, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
        model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });
        // ...existing code...
    }
    
    // Default review intervals in milliseconds:
    // 1 minute, 3 minutes, 90 minutes, 8 hours, 23 hours
    let reviewIntervals = [
        1 * 60 * 1000,
        3 * 60 * 1000,
        90 * 60 * 1000,
        8 * 60 * 60 * 1000,
        23 * 60 * 60 * 1000
    ];
    
    // NEW: Function to set default schedule intervals
    function setDefaultSchedule() {
        reviewIntervals = [
            1 * 60 * 1000,
            3 * 60 * 1000,
            90 * 60 * 1000,
            8 * 60 * 60 * 1000,
            23 * 60 * 60 * 1000
        ];
        console.log("Schedule set to default intervals");
    }
    
    // NEW: Function to set optimized schedule intervals (for testing)
    function setOptimizedSchedule() {
        reviewIntervals = [
            30 * 1000,      // 30 sec
            1 * 60 * 1000,  // 1 min
            3 * 60 * 1000,  // 3 min
            10 * 60 * 1000, // 10 min
            30 * 60 * 1000  // 30 min
        ];
        console.log("Schedule set to optimized intervals");
    }
    
    // For demo, we schedule review using default intervals.
    async function scheduleReview(note) {
        // Initialize reviewCount if not set.
        note.reviewCount = note.reviewCount || 0;
        // Use the appropriate delay based on reviewCount (or last defined delay if exceeded)
        const delay = reviewIntervals[note.reviewCount] || reviewIntervals[reviewIntervals.length - 1];
        const nextReview = new Date(Date.now() + delay);
        // NEW: assign nextReview to note so UI can display countdown
        note.nextReview = nextReview;
        // Increment review count for the next review schedule
        note.reviewCount++;
        console.log(`Scheduled review for note ${note.id} at ${nextReview}`);
        // NEW: Wait until the note is updated in the database with the new nextReview time
        await db.saveNote(note);
        console.log(`Note ${note.id} updated with nextReview time.`);
    }
    
    // NEW: Function to modify the review schedule manually.
    async function modifySchedule(note, direction) {
        // Compute current level (using reviewCount - 1 because scheduleReview increments it).
        let currentLevel = ((note.reviewCount || 1) - 1);
        if (direction === 'back') {
            currentLevel = Math.max(currentLevel - 1, 0);
        } else if (direction === 'forward') {
            currentLevel = Math.min(currentLevel + 1, reviewIntervals.length - 1);
        }
        note.reviewCount = currentLevel + 1; // set new level
        const delay = reviewIntervals[currentLevel];
        note.nextReview = new Date(Date.now() + delay);
        console.log(`Modified review schedule for note ${note.id} to level ${currentLevel} with delay ${delay}ms`);
        await db.saveNote(note);
        return note;
    }
    
    // Stub for re-training schedule based on performance
    function adjustSchedule(performanceData) {
        // Use model.predict() to compute next review time adjustments
        // ...existing code...
    }
    
    initModel();
    
    return {
        scheduleReview,
        adjustSchedule,
        setDefaultSchedule,
        setOptimizedSchedule,
        modifySchedule
        // ...existing code...
    };
})();

// Added test function for reviewScheduler.js
function runReviewSchedulerTests() {
    console.log("Running reviewScheduler.js tests...");
    const dummyNote = {
        id: 654321,
        heading: "Scheduler Test",
        content: "Review test",
        reviewEnabled: true,
        createdAt: new Date(),
        connections: []
    };
    reviewScheduler.scheduleReview(dummyNote);
    console.log("Scheduled review test logged.");
}
window.runReviewSchedulerTests = runReviewSchedulerTests;
