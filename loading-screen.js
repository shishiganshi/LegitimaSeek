document.addEventListener('DOMContentLoaded', () => {
    const mainPage = sessionStorage.getItem('mainPage') || window.location.href.replace('loading-screen.html', 'main.html');
    sessionStorage.setItem('mainPage', mainPage);

    setTimeout(() => {
        window.location.href = mainPage;
    }, 7000);
});
