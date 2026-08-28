// ── Shared Navbar ──
// Injects the navbar into #navbar-placeholder and sets the active link
// based on the current page filename.

(function () {
  const navHTML = `
<nav class="navbar">
  <div class="container">
    <a href="index.html" class="logo">
      <img src="logo.png" alt="Yogeash Nehra Logo" class="logo-image">
    </a>
    <ul class="nav-links">
      <li><a href="index.html"    class="nav-item" data-page="index">Home</a></li>
      <li><a href="ai-lab.html"        class="nav-item" data-page="ai-lab">AI Lab</a></li>
      <li><a href="stack.html"         class="nav-item" data-page="stack">Stack</a></li>
      <li><a href="projects.html"      class="nav-item" data-page="projects">Projects</a></li>
      <li><a href="/live"              class="nav-item" data-page="live">Live</a></li>
      <li><a href="resume.html"        class="nav-item" data-page="resume">Resume</a></li>
      <li><a href="https://www.linkedin.com/in/yogeash-nehra/" class="nav-item">Contact</a></li>
    </ul>
    <div class="hamburger" id="nav-toggle" aria-label="Open navigation" tabindex="0">
      <span></span><span></span><span></span>
    </div>
  </div>
  <div class="nav-overlay" id="nav-overlay"></div>
</nav>`;

  // Inject HTML
  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) {
    placeholder.outerHTML = navHTML;
  } else {
    document.body.insertAdjacentHTML('afterbegin', navHTML);
  }

  // Mark active link
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  document.querySelectorAll('.nav-item[data-page]').forEach(function (link) {
    if (link.dataset.page === page) link.classList.add('active');
  });

  // Mobile toggle
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.querySelector('.nav-links');
  const navOverlay = document.getElementById('nav-overlay');

  function openNav()  { navLinks.classList.add('open');    navOverlay.classList.add('open'); }
  function closeNav() { navLinks.classList.remove('open'); navOverlay.classList.remove('open'); }

  navToggle.addEventListener('click', function () {
    navLinks.classList.contains('open') ? closeNav() : openNav();
  });
  navOverlay.addEventListener('click', closeNav);
  document.querySelectorAll('.nav-links .nav-item').forEach(function (l) {
    l.addEventListener('click', closeNav);
  });
})();
