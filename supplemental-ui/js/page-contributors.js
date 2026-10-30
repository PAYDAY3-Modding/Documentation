// Keep contributor markup outside toc-menu so the default UI never copies it
// into the generated Contents list or treats it as a section navigation link.
;(function () {
  var contributors = document.querySelector('.page-contributors')
  var home = document.querySelector('.page-sidebar-inner')
  if (!contributors || !home) return
  var mobile = window.matchMedia('(max-width: 1023.5px)')
  function placeContributors () {
    if (!mobile.matches) return home.appendChild(contributors)
    var target = document.querySelector('article.doc .toc.embedded') || document.querySelector('article.doc h1.page')
    if (target) target.insertAdjacentElement('afterend', contributors)
  }
  placeContributors()
  mobile.addEventListener('change', placeContributors)
})()
