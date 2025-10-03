/**
 * Modern Home Page Scroll Animations
 * Using Intersection Observer API for performance
 */

// Configuration
const CONFIG = {
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1,
    animationDelay: 50, // ms between staggered animations
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initScrollAnimations();
    initParallaxEffects();
    initFloatingElements();
    initSmoothScroll();
});

/**
 * Main scroll animations using Intersection Observer
 */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: CONFIG.rootMargin,
        threshold: CONFIG.threshold,
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = parseInt(element.getAttribute('data-delay') || '0');

                // Apply animation with delay
                setTimeout(() => {
                    element.classList.add('animate-in');
                }, delay);

                // Optionally unobserve after animation
                // observer.unobserve(element);
            } else {
                // Optional: Remove animation class when out of view
                // entry.target.classList.remove('animate-in');
            }
        });
    }, observerOptions);

    // Observe all elements with data-animate attribute
    const animatedElements = document.querySelectorAll('[data-animate]');
    animatedElements.forEach((el) => observer.observe(el));
}

/**
 * Parallax scrolling effect for hero section
 */
function initParallaxEffects() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    const heroImage = heroSection.querySelector('.hero-img');
    const gradientOrbs = heroSection.querySelectorAll('.gradient-orb');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.5;

        // Parallax for hero image
        if (heroImage) {
            heroImage.style.transform = `translateY(${rate * 0.3}px)`;
        }

        // Parallax for gradient orbs
        gradientOrbs.forEach((orb, index) => {
            const speed = 0.1 + (index * 0.05);
            orb.style.transform = `translate(${rate * speed}px, ${rate * speed}px)`;
        });
    });
}

/**
 * Floating animation for decorative elements
 */
function initFloatingElements() {
    const floatingElements = document.querySelectorAll('.float-item');

    floatingElements.forEach((element, index) => {
        // Randomize animation duration and delay
        const duration = 2 + Math.random() * 2; // 2-4s
        const delay = index * 0.5; // Stagger by 0.5s

        element.style.animationDuration = `${duration}s`;
        element.style.animationDelay = `${delay}s`;
    });
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for header
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Stagger animations for grid items
 */
function staggerGridAnimations() {
    const grids = document.querySelectorAll('.features-grid, .courses-grid, .benefits-grid, .testimonials-wrapper');

    grids.forEach(grid => {
        const items = grid.querySelectorAll('[data-animate]');
        items.forEach((item, index) => {
            const baseDelay = parseInt(item.getAttribute('data-delay') || '0');
            const staggerDelay = index * CONFIG.animationDelay;
            item.setAttribute('data-delay', baseDelay + staggerDelay);
        });
    });
}

/**
 * Add hover effects to cards
 */
function initCardInteractions() {
    const cards = document.querySelectorAll('.course-card, .feature-card, .benefit-card, .testimonial-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-12px) scale(1.02)';
        });

        card.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

/**
 * Animate numbers (counting effect)
 */
function animateNumbers() {
    const numberElements = document.querySelectorAll('.stats-number');

    numberElements.forEach(element => {
        const target = parseInt(element.textContent.replace(/\D/g, ''));
        const duration = 2000; // 2 seconds
        const step = target / (duration / 16); // 60fps
        let current = 0;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const timer = setInterval(() => {
                        current += step;
                        if (current >= target) {
                            element.textContent = target + '+';
                            clearInterval(timer);
                        } else {
                            element.textContent = Math.floor(current) + '+';
                        }
                    }, 16);
                    observer.unobserve(element);
                }
            });
        });

        observer.observe(element);
    });
}

/**
 * Progress bar on scroll
 */
function initScrollProgress() {
    // Create progress bar element
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0%;
    height: 4px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    z-index: 9999;
    transition: width 0.3s ease;
  `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.pageYOffset / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

/**
 * Lazy load images for better performance
 */
function initLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

/**
 * Add loading state for buttons
 */
function initButtonEffects() {
    const buttons = document.querySelectorAll('.btn');

    buttons.forEach(button => {
        button.addEventListener('click', function (e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;

            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple animation to styles
    if (!document.getElementById('ripple-animation')) {
        const style = document.createElement('style');
        style.id = 'ripple-animation';
        style.textContent = `
      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
        document.head.appendChild(style);
    }
}

/**
 * Cursor trail effect (optional, can be removed if too much)
 */
function initCursorTrail() {
    const coords = { x: 0, y: 0 };
    const circles = [];
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

    // Create circles
    for (let i = 0; i < 8; i++) {
        const circle = document.createElement('div');
        circle.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${colors[i % colors.length]};
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s;
    `;
        document.body.appendChild(circle);
        circles.push(circle);
    }

    window.addEventListener('mousemove', (e) => {
        coords.x = e.clientX;
        coords.y = e.clientY;
    });

    function animateCircles() {
        let x = coords.x;
        let y = coords.y;

        circles.forEach((circle, index) => {
            circle.style.left = x - 4 + 'px';
            circle.style.top = y - 4 + 'px';
            circle.style.opacity = (8 - index) / 8;

            const nextCircle = circles[index + 1] || circles[0];
            x += (nextCircle.offsetLeft - circle.offsetLeft) * 0.3;
            y += (nextCircle.offsetTop - circle.offsetTop) * 0.3;
        });

        requestAnimationFrame(animateCircles);
    }

    animateCircles();
}

/**
 * Initialize all animations
 */
function init() {
    staggerGridAnimations();
    initCardInteractions();
    animateNumbers();
    initScrollProgress();
    initLazyLoading();
    initButtonEffects();

    // Optional: Uncomment if you want cursor trail
    // initCursorTrail();
}

// Call init after a short delay to ensure everything is loaded
setTimeout(init, 100);

// Export functions for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initScrollAnimations,
        initParallaxEffects,
        initFloatingElements,
        initSmoothScroll,
    };
}
