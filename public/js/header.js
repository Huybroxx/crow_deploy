// Active navigation highlighting
document.addEventListener('DOMContentLoaded', function () {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.header .nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');

        // Exact match for home page
        if (currentPath === '/' && href === '/') {
            link.parentElement.classList.add('active');
        }
        // Match for other pages
        else if (href !== '/' && currentPath.startsWith(href)) {
            link.parentElement.classList.add('active');
        }
    });
});

// Header hide/show on scroll
let lastScrollTop = 0;
const header = document.querySelector('.header');
const scrollThreshold = 100;

window.addEventListener('scroll', function () {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > scrollThreshold) {
        if (scrollTop > lastScrollTop) {
            // Scrolling down
            header.classList.add('hidden');
        } else {
            // Scrolling up
            header.classList.remove('hidden');
        }
    } else {
        // At top of page
        header.classList.remove('hidden');
    }

    lastScrollTop = scrollTop;
});
