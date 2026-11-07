// Service worker ReptilKu.
// Naikkan angka versi ini setiap kali kamu mengubah file di daftar ASET.
const VERSI = 'reptilku-v5';
const ASET = ['./', './index.html', '. /pakan.html', '. /toko.html', './manifest.json'];

// Data hidup (login, database) tidak boleh disimpan di cache.
const LEWATI = ['firestore.googleapis.com', 'identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(ASET)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (LEWATI.includes(url.hostname)) return;

  // Halaman HTML: coba internet dulu supaya update langsung terlihat, cadangan dari cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const salin = res.clone(); caches.open(VERSI).then(c => c.put('./index.html', salin)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // File lain (gambar, library Firebase, ikon): pakai cache dulu, perbarui di belakang layar
  e.respondWith(
    caches.match(req).then(ada => {
      const dariInternet = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const salin = res.clone(); caches.open(VERSI).then(c => c.put(req, salin)); }
        return res;
      }).catch(() => ada);
      return ada || dariInternet;
    })
  );
});
