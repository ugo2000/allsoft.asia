// ==================== AllSoft.asia - Main JS ====================
// Lightweight, no dependencies.

document.addEventListener('DOMContentLoaded', function() {
  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('open');
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item').forEach(function(i) {
        i.classList.remove('open');
      });
      // Open clicked if it was closed
      if (!wasOpen) item.classList.add('open');
    });
  });

  // Contact form (front-end only, prevents default)
  const contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.textContent = '\u53d1\u9001\u4e2d...';
      btn.disabled = true;
      setTimeout(function() {
        btn.textContent = '\u2713 \u53d1\u9001\u6210\u529f\uff01';
        contactForm.reset();
        setTimeout(function() {
          btn.textContent = original;
          btn.disabled = false;
        }, 3000);
      }, 1200);
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Animated stat counters
  const stats = document.querySelectorAll('[data-count]');
  if (stats.length > 0 && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count);
          let current = 0;
          const step = Math.max(1, Math.ceil(target / 40));
          const timer = setInterval(function() {
            current += step;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = current.toLocaleString();
          }, 30);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    stats.forEach(function(s) { obs.observe(s); });
  }
});
