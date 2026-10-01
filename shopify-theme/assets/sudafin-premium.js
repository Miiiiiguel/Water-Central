(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('sudafin-premium-js');

  // Respetar preferencias de accesibilidad
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth <= 768;

  /* ── 1. Scroll Reveal ──────────────────────────────────────── */
  if (!reduced && 'IntersectionObserver' in window) {
    const targets = [
      ...document.querySelectorAll(
        'main .shopify-section, .product__info-container, ' +
        '.product__media-wrapper, .card, .product-card-wrapper, ' +
        '[class*="testimonial"], [class*="faq"], [class*="benefit"]'
      )
    ];

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('sudafin-is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach((el, i) => {
      el.classList.add('sudafin-reveal');
      el.style.setProperty('--sudafin-delay', `${Math.min(i * 30, 200)}ms`);
      observer.observe(el);
    });
  }

  /* ── 2. Cursor Glow (sólo desktop) ─────────────────────────── */
  if (!isMobile && !reduced) {
    let ticking = false;
    window.addEventListener('pointermove', (e) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        root.style.setProperty('--sudafin-x', `${e.clientX}px`);
        root.style.setProperty('--sudafin-y', `${e.clientY}px`);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ── 3. Confeti Dorado al añadir al carrito ─────────────────── */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest(
      '.product-form__submit, #_rsi-buy-now-button-overwrite, .btn-primary'
    );
    if (!btn || reduced) return;

    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 22; i++) {
      const dot = document.createElement('div');
      const size = 5 + Math.random() * 6;
      const colors = ['#d4af37', '#f9e29c', '#996515', '#ffffff', '#ffd700'];
      dot.style.cssText = [
        'position:fixed',
        `left:${cx}px`,
        `top:${cy}px`,
        `width:${size}px`,
        `height:${size}px`,
        `background:${colors[Math.floor(Math.random() * colors.length)]}`,
        'border-radius:50%',
        'z-index:10000',
        'pointer-events:none',
        'transform:translate(-50%,-50%)',
      ].join(';');
      document.body.appendChild(dot);

      const angle  = Math.random() * Math.PI * 2;
      const speed  = 3 + Math.random() * 7;
      let   vx     = Math.cos(angle) * speed;
      let   vy     = Math.sin(angle) * speed - 3; // leve impulso hacia arriba
      let   op     = 1;
      let   lx     = cx, ly = cy;

      const frame = () => {
        vy += 0.25; // gravedad
        lx += vx;
        ly += vy;
        op -= 0.025;
        dot.style.left    = `${lx}px`;
        dot.style.top     = `${ly}px`;
        dot.style.opacity = op;
        if (op > 0) requestAnimationFrame(frame);
        else dot.remove();
      };
      requestAnimationFrame(frame);
    }
  });

  /* ── 4. Parallax en imágenes de producto (RAF throttled) ────── */
  if (!reduced && !isMobile) {
    const imgs = Array.from(
      document.querySelectorAll('.product__media img, .card__media img')
    );
    if (imgs.length > 0) {
      let pending = false;
      window.addEventListener('scroll', () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          const scrolled = window.pageYOffset;
          imgs.forEach(img => {
            const yPos = -(scrolled * 0.04);
            img.style.transform = `translateY(${yPos}px) scale(1.05)`;
          });
          pending = false;
        });
      }, { passive: true });
    }
  }
})();
