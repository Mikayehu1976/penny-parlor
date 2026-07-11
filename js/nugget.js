/* Penny Parlor — the cartoon gold nugget, drawn as inline SVG.
   One irregular faceted lump with a cartoon outline and a sparkle. */

var PP = window.PP || {};
window.PP = PP;

(function () {

  var SVG =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M50 7 L80 16 L93 48 L79 84 L44 93 L14 75 L7 38 Z" ' +
      'fill="#e8ac3a" stroke="#6b4a12" stroke-width="6" stroke-linejoin="round"/>' +
    '<polygon points="42,44 64,38 68,56 46,62" fill="#f0bd50"/>' +
    '<polygon points="30,20 52,15 42,34 24,36" fill="#f7cf6f"/>' +
    '<polygon points="68,62 84,50 76,80 54,86" fill="#c58a22"/>' +
    '<polygon points="20,42 32,60 16,66" fill="#d99a2b"/>' +
    '<path d="M70 14 L73 22 L81 25 L73 28 L70 36 L67 28 L59 25 L67 22 Z" fill="#fffbe8"/>' +
    '</svg>';

  /* inner markup for an element that already has class="nugget" */
  PP.nuggetInner = function (value) {
    return SVG + '<span class="nugget-num">' + value + '</span>';
  };

  /* a complete nugget element */
  PP.nuggetHTML = function (value, extraClass) {
    return '<div class="nugget ' + (extraClass || '') + '">' + PP.nuggetInner(value) + '</div>';
  };
})();
