// ...existing code...
const gamification = (function () {
    let xp = 0;
    let level = 1;
    
    function addNoteCreatedXP() {
        xp += 10;
        checkLevel();
        updateDisplay();
    }
    
    function checkLevel() {
        // Simple level up system
        if (xp >= level * 100) {
            level++;
            alert("Level Up! You are now level " + level);
        }
    }
    
    function updateDisplay() {
        const display = document.getElementById('gamification-display');
        if(display){
            display.innerHTML = `XP: ${xp} | Level: ${level}`;
        }
    }
    
    // Allow external feedback for gamification adjustments
    function receiveFeedback(feedback) {
        // Use feedback to tweak rewards
        console.log('Received feedback:', feedback);
    }
    
    function updateXPFromReview(rating) {
        let xpGain = 0;
        // Award higher XP for easier reviews
        if (rating === 3) {
            xpGain = 20;
        } else if (rating === 2) {
            xpGain = 10;
        } else if (rating === 1) {
            xpGain = 5;
        }
        xp += xpGain;
        checkLevel();
        updateDisplay();
    }
    
    // ...existing code...
    
    return {
        addNoteCreatedXP,
        receiveFeedback,
        updateXPFromReview
        // ...existing code...
    };
})();

// Added test function for gamification.js
function runGamificationTests() {
    console.log("Running gamification.js tests...");
    gamification.addNoteCreatedXP();
    console.log("Added XP – check gamification display for updates.");
}
window.runGamificationTests = runGamificationTests;
