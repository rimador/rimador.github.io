(function () {
  var body = document.body;
  if (!body) return;

  // L'arrel del lloc la calcula components.js, que es carrega abans que aquest
  // fitxer. El valor de reserva només actua si algú carrega menu.js tot sol.
  var arrel = typeof ARREL === 'string' ? ARREL : '/';

  var navHTML = /*html*/`
    <button type="button" class="menu-close" aria-label="Tanca el menú"></button>
    <nav aria-label="Menú principal">
      <a href="${arrel}">Rimador.cat</a>
      <a href="${arrel}joc/">El Joc del Rimar</a>
      <div class="menu-grup" role="group" aria-labelledby="menu-grup-llistes">
        <p class="menu-grup__titol" id="menu-grup-llistes"><span class="menu-grup__ratlla"></span>Llistes</p>
        <a href="${arrel}llistes/llista_heptasilabs.html">Mots heptasil·làbics</a>
        <a href="${arrel}llistes/llista_mots_de7.html">Mots de set síl·labes</a>
        <a href="${arrel}llistes/llista_naufragues.html">Paraules nàufragues</a>
        <span class="menu-grup__ratlla menu-grup__ratlla--tanca"></span>
      </div>
      <a href="${arrel}dades.html">Estadístiques</a>
      <a href="${arrel}nosaltres.html">Qui som?</a>
      <a href="${arrel}dialectes.html">Els dialectes</a>
      <a href="${arrel}historial_canvis.html">Historial de canvis</a>
      <a href="${arrel}error.html">Has trobat un error?</a>
    </nav>
  `;

  // Eliminem la línia del cafè que anava al menú:
  //   <a href="https://ko-fi.com/rimadorcat" target="_blank" rel="noopener">Regala'ns un cafè</a>


  var paperWindow = document.createElement('div');
  paperWindow.id = 'paper-window';

  var paperBack = document.createElement('div');
  paperBack.id = 'paper-back';
  paperBack.innerHTML = navHTML;

  var paperFront = document.createElement('div');
  paperFront.id = 'paper-front';

  while (body.firstChild) {
    paperFront.appendChild(body.firstChild);
  }

  paperWindow.appendChild(paperBack);
  paperWindow.appendChild(paperFront);
  body.appendChild(paperWindow);

  var menuBtn = document.getElementById('menuToggleBtn');
  var closeBtn = paperBack.querySelector('.menu-close');
  var nav = paperBack.querySelector('nav');

  function offsetDins(el, arrel) {
    var x = 0, y = 0;
    while (el && el !== arrel) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent;
    }
    return { x: x, y: y };
  }

  function placeCloseButton() {
    if (!closeBtn || !menuBtn) return;
    var pos = offsetDins(menuBtn, paperFront);
    var top = pos.y - paperWindow.scrollTop;
    var alt = menuBtn.offsetHeight;
    if (top + alt <= 0 || top >= window.innerHeight) {
      closeBtn.removeAttribute('style');
      if (nav) nav.style.paddingTop = '';
      return;
    }
    closeBtn.style.top = top + 'px';
    closeBtn.style.left = pos.x + 'px';
    closeBtn.style.right = 'auto';
    closeBtn.style.width = menuBtn.offsetWidth + 'px';
    closeBtn.style.height = alt + 'px';
    if (nav) nav.style.paddingTop = (top + alt + 34) + 'px';
  }

  var TILT_DEG = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--rmn-inclinacio')) || 10;
  var SIN_TILT = Math.sin(TILT_DEG * Math.PI / 180);
  var CLEARANCE = 40;   
  var MIN_PIVOT = 1200;
  var pivotOffset = MIN_PIVOT;

  var range = document.createRange();
  function textWidth(el) {
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  }

  function recalcPivot() {
    var links = paperBack.querySelectorAll('nav a, nav .menu-grup__titol');
    var needed = MIN_PIVOT;
    for (var i = 0; i < links.length; i++) {
      var rect = links[i].getBoundingClientRect();
      var lliureCal = window.innerWidth - rect.right + textWidth(links[i]) + CLEARANCE;
      needed = Math.max(needed, rect.bottom + lliureCal / SIN_TILT);
    }
    var maxim = 0.85 * window.innerWidth / SIN_TILT;
    pivotOffset = Math.min(needed, Math.max(MIN_PIVOT, maxim));
  }

  function updateTransformOrigin() {
    var y = paperWindow.scrollTop + pivotOffset;
    paperFront.style.transformOrigin = 'center ' + y + 'px';
  }

  function refresh() {
    placeCloseButton();
    recalcPivot();
    updateTransformOrigin();
  }

  paperWindow.addEventListener('scroll', updateTransformOrigin);
  window.addEventListener('resize', refresh);
  refresh();

  var isOpen = false;

  function openMenu() {
    isOpen = true;
    refresh();
    paperWindow.classList.add('rmn-tilt');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    isOpen = false;
    paperWindow.classList.remove('rmn-tilt');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMenu);
  }

  paperFront.addEventListener('click', function () {
    if (isOpen) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeMenu();
  });
})();