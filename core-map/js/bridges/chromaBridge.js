(function () {
  'use strict';

  var SPRITE_MAP = {
    Tanks:     '../assets/units/animations/tank/tank-move.gif',
    Cavalry:   '../assets/units/animations/cavalry/cavalry-move.gif',
    Infantry:  '../assets/game-icons/infantry.png',
    Motorized: '../assets/game-icons/motorized.png',
    Artillery: '../assets/game-icons/artillery.png',
  };

  var FALLBACK = '../assets/game-icons/infantry.png';

  function getSprite(unitType) {
    if (typeof window.ChromaRenderer === 'undefined') {
      throw new Error('chromaBridge: window.ChromaRenderer not loaded');
    }
    var src = SPRITE_MAP[unitType] || FALLBACK;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;';

    window.ChromaRenderer.createSprite(src)
      .then(function (result) {
        var el = result.el;
        el.style.maxWidth  = '100%';
        el.style.maxHeight = '100%';
        el.style.imageRendering = 'pixelated';
        el.style.display = 'block';
        wrapper.appendChild(el);
      })
      .catch(function (err) {
        console.warn('chromaBridge: sprite load failed for "' + unitType + '":', err);
        var img = document.createElement('img');
        img.src = FALLBACK;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
        wrapper.appendChild(img);
      });

    return wrapper;
  }

  window.ChromaBridge = { getSprite: getSprite };
})();
