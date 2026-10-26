// ==========================================
// TERMINAL INTRO REDIRECT CONTROLLER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Hold the brutalist loading screen for 2.5 seconds before transitioning to the main terminal
    setTimeout(() => {
        window.location.replace('./app.html');
    }, 2500);
});