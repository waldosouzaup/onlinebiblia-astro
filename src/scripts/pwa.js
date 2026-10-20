// PWA Registration, Offline Caching & Install Manager for Online Bíblia

let deferredPrompt = null;
let isOfflineReady = false;

// Check if running as standalone PWA
function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Detect iOS devices
function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Show a temporary floating toast
function showPwaToast(message, duration = 4000) {
  let toast = document.getElementById('pwa-system-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pwa-system-toast';
    toast.className = 'pwa-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.innerHTML = message;
  toast.classList.add('is-visible');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, duration);
}

// Check if full Bible data is stored in CacheStorage
async function checkBibleCacheStatus() {
  if (!('caches' in window)) return false;
  try {
    const dataCache = await caches.open('onlinebiblia-data-v1');
    const ptMatch = await dataCache.match('/data/bible-pt.json');
    isOfflineReady = Boolean(ptMatch);
    updateOfflineStatusUI();
    return isOfflineReady;
  } catch (_) {
    return false;
  }
}

// Download and cache complete Bible data
async function downloadBibleDataOffline() {
  if (!('caches' in window)) return;
  const statusBadges = document.querySelectorAll('[data-pwa-offline-status]');
  statusBadges.forEach((b) => {
    b.textContent = 'Baixando Bíblia para leitura offline...';
    b.classList.add('is-syncing');
  });

  try {
    const dataCache = await caches.open('onlinebiblia-data-v1');
    const coreCache = await caches.open('onlinebiblia-core-v1');

    // Pre-cache core shell
    const coreUrls = [
      '/',
      '/biblia/',
      '/en/bible/',
      '/concordancia/',
      '/offline.html',
      '/site.webmanifest',
      '/favicon.svg',
      '/icon-192.png',
      '/icon-512.png'
    ];
    await Promise.all(
      coreUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) await coreCache.put(url, res);
        } catch (_) {}
      })
    );

    // Pre-cache full Bible data
    const dataUrls = [
      '/data/bible-pt.json',
      '/data/bible-en.json',
      '/data/concordance.json',
      '/data/devotional.json'
    ];
    await Promise.all(
      dataUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) await dataCache.put(url, res);
        } catch (_) {}
      })
    );

    isOfflineReady = true;
    updateOfflineStatusUI();
    showPwaToast('✓ Bíblia completa baixada! Pronta para uso sem internet.');
  } catch (err) {
    console.warn('[PWA] Erro ao sincronizar Bíblia offline:', err);
  }
}

// Update UI elements across current page
function updateOfflineStatusUI() {
  const statusBadges = document.querySelectorAll('[data-pwa-offline-status]');
  statusBadges.forEach((badge) => {
    badge.classList.remove('is-syncing');
    if (isOfflineReady) {
      badge.innerHTML = '<span class="pwa-dot-green"></span> <span>Bíblia 100% pronta para ler offline</span>';
      badge.setAttribute('title', 'Todos os 66 livros e 1.189 capítulos estão salvos no aparelho');
    } else {
      badge.innerHTML = '<span class="pwa-dot-amber"></span> <span>Toque para baixar a Bíblia offline</span>';
      badge.setAttribute('title', 'Clique para baixar todos os livros e ler sem internet');
    }
  });

  const installButtons = document.querySelectorAll('[data-pwa-install]');
  const isInstalled = isRunningStandalone();

  installButtons.forEach((btn) => {
    if (isInstalled) {
      btn.hidden = true;
    } else {
      btn.hidden = false;
    }
  });
}

// Show iOS Install Instructions Modal
function showIosInstallModal() {
  let modal = document.getElementById('ios-install-dialog');
  if (!modal) {
    modal = document.createElement('dialog');
    modal.id = 'ios-install-dialog';
    modal.className = 'ios-install-modal';
    modal.innerHTML = `
      <div class="modal-card">
        <button type="button" class="modal-close-btn" id="close-ios-install" aria-label="Fechar">✕</button>
        <div class="modal-header">
          <div class="support-icon-badge" aria-hidden="true">📲</div>
          <h3>Instalar no iPhone / iPad</h3>
        </div>
        <div class="modal-body">
          <p class="modal-lead">Tenha a Bíblia Sagrada completa na tela inicial do seu aparelho para ler mesmo sem conexão de internet:</p>
          <ol class="ios-steps-list">
            <li>Toque no botão de <strong>Compartilhar</strong> do Safari <span class="ios-share-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> (na barra inferior do navegador).</li>
            <li>Role as opções e selecione <strong>Adicionar à Tela de Início</strong> (ícone com um sinal <strong>+</strong>).</li>
            <li>Toque em <strong>Adicionar</strong> no canto superior direito.</li>
          </ol>
          <p class="modal-gratitude">Pronto! O ícone da Online Bíblia será criado e funcionará sem internet!</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="modal-secondary-btn" id="dismiss-ios-install">Entendi</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    };
    modal.querySelector('#close-ios-install')?.addEventListener('click', close);
    modal.querySelector('#dismiss-ios-install')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        close();
      }
    });
  }

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
}

// Trigger installation prompt
async function triggerPwaInstall() {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        showPwaToast('📲 Instalando a Online Bíblia...');
        // Download all files immediately
        downloadBibleDataOffline();
      }
      deferredPrompt = null;
    } catch (_) {}
  } else if (isIosDevice() && !isRunningStandalone()) {
    showIosInstallModal();
  } else if (isRunningStandalone()) {
    showPwaToast('✓ A Bíblia já está instalada no seu aparelho!');
  } else {
    // If not supported natively or prompt expired, ensure offline files are saved
    downloadBibleDataOffline();
  }
}

// Setup buttons and listeners on page load
function setupPwaUI() {
  updateOfflineStatusUI();

  // Install buttons (Header, Mobile Nav, Footer)
  const installButtons = document.querySelectorAll('[data-pwa-install]');
  installButtons.forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      triggerPwaInstall();
    };
  });

  // Offline status badges (clickable to trigger/ensure offline download)
  const statusBadges = document.querySelectorAll('[data-pwa-offline-status]');
  statusBadges.forEach((badge) => {
    badge.onclick = (e) => {
      e.preventDefault();
      downloadBibleDataOffline();
    };
  });
}

// Initialize Service Worker and PWA hooks
function initPwa() {
  // Check online/offline network transitions
  window.addEventListener('online', () => {
    showPwaToast('✓ Conexão com a internet restabelecida.', 3000);
  });

  window.addEventListener('offline', () => {
    showPwaToast('📡 Modo Offline ativado. Você pode continuar lendo todos os 66 livros da Bíblia sem internet.', 6000);
  });

  // Capture beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    updateOfflineStatusUI();
  });

  // Capture appinstalled event
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    updateOfflineStatusUI();
    showPwaToast('🎉 Online Bíblia instalada com sucesso! A Bíblia completa está pronta para você ler offline.');
    downloadBibleDataOffline();
  });

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Listen for update
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showPwaToast('Nova versão disponível. Atualizando em segundo plano...');
                }
              };
            }
          };
          // Verify cache after registration
          checkBibleCacheStatus();
        })
        .catch((err) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', err);
        });

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BIBLE_DOWNLOAD_COMPLETE') {
          isOfflineReady = true;
          updateOfflineStatusUI();
        }
      });
    });
  }

  checkBibleCacheStatus();
}

// Initial invocation
initPwa();
setupPwaUI();

// Support Astro ClientRouter page transitions
document.addEventListener('astro:page-load', () => {
  setupPwaUI();
  checkBibleCacheStatus();
});
