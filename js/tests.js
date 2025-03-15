document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("run-tests").addEventListener("click", () => {
        console.clear();
        console.log("Running all tests...");
        window.runDBTests && window.runDBTests();
        window.runAppTests && window.runAppTests();
        window.runReviewSchedulerTests && window.runReviewSchedulerTests();
        window.runGamificationTests && window.runGamificationTests();
    });
});
