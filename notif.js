// Notifikasi terjadwal ReptilKu. Hanya aktif di aplikasi Android (Capacitor), di browser tidak melakukan apa-apa.
(function () {
  var Cap = window.Capacitor;
  var LN = Cap && Cap.Plugins && Cap.Plugins.LocalNotifications;
  var native = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

  window.jadwalkanPengingat = async function () { return false; };
  if (!native || !LN) return;

  var KANAL = 'pengingat';
  var HORIZON_HARI = 30, MAKS_PER_ITEM = 14, MAKS_TOTAL = 60;
  var DI_HALAMAN_PENGINGAT = /pengingat\.html$/.test(location.pathname);

  async function izin(minta) {
    try {
      var p = await LN.checkPermissions();
      if (p.display === 'granted') return true;
      if (!minta) return false;
      var r = await LN.requestPermissions();
      return r.display === 'granted';
    } catch (e) { return false; }
  }

  async function buatKanal() {
    try {
      await LN.createChannel({
        id: KANAL,
        name: 'Pengingat perawatan',
        description: 'Jadwal makan, bersih kandang, dan ganti air',
        importance: 4,
        visibility: 1,
        vibration: true
      });
    } catch (e) {}
  }

  function waktuDari(next, jam) {
    var t = String(next).split('-').map(Number);
    var j = String(jam || '18:00').split(':').map(Number);
    return new Date(t[0], t[1] - 1, t[2], j[0] || 0, j[1] || 0, 0);
  }

  function judul(it) {
    return String(it.jenis || 'Pengingat') + (it.hewan ? ' \u00b7 ' + it.hewan : '');
  }

  // Menjadwalkan ulang semua pengingat di HP ini. minta=true akan memunculkan permintaan izin bila perlu.
  window.jadwalkanPengingat = async function (items, minta) {
    try {
      var pending = await LN.getPending();
      if (pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(function (n) { return { id: n.id }; }) });
      }
      if (!items || !items.length) return true;
      if (!(await izin(!!minta))) return false;
      await buatKanal();

      var sekarang = Date.now();
      var batas = sekarang + HORIZON_HARI * 864e5;
      var daftar = [];
      var id = 1;

      items.forEach(function (it) {
        if (!it.next) return;
        var awal = waktuDari(it.next, it.jam);
        var step = Number(it.interval) || 0;
        for (var k = 0; k < MAKS_PER_ITEM; k++) {
          var w = new Date(awal.getTime());
          w.setDate(w.getDate() + k * step);
          if (w.getTime() > batas) break;
          if (w.getTime() > sekarang && daftar.length < MAKS_TOTAL) {
            daftar.push({
              id: id++,
              title: judul(it),
              body: 'Waktunya jadwal perawatan reptilmu.',
              channelId: KANAL,
              schedule: { at: w, allowWhileIdle: true }
            });
          }
          if (!step) break;
        }
      });

      if (daftar.length) await LN.schedule({ notifications: daftar });
      return true;
    } catch (e) {
      console.log('Notifikasi gagal dijadwalkan', e);
      return false;
    }
  };

  // Ketuk notifikasi, buka halaman Pengingat.
  try {
    LN.addListener('localNotificationActionPerformed', function () {
      if (!DI_HALAMAN_PENGINGAT) location.href = 'pengingat.html';
    });
  } catch (e) {}

  // Tombol tes, hanya tampil di halaman Pengingat dalam aplikasi.
  if (DI_HALAMAN_PENGINGAT) {
    document.addEventListener('DOMContentLoaded', function () {
      var b = document.createElement('button');
      b.textContent = 'Tes notifikasi (10 detik)';
      b.style.cssText = 'display:block;margin:20px auto 0;padding:11px 16px;border:0;border-radius:12px;background:#ebe8db;color:#173d2d;font:inherit;font-weight:600;cursor:pointer';
      b.onclick = async function () {
        if (!(await izin(true))) {
          alert('Izin notifikasi belum diberikan. Aktifkan lewat Pengaturan HP > Aplikasi > ReptilKu > Notifikasi.');
          return;
        }
        await buatKanal();
        await LN.schedule({
          notifications: [{
            id: 9999,
            title: 'Tes ReptilKu',
            body: 'Notifikasi berhasil muncul.',
            channelId: KANAL,
            schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }
          }]
        });
        alert('Tutup aplikasi sekarang. Notifikasi muncul sekitar 10 detik lagi.');
      };
      var wadah = document.querySelector('main') || document.body;
      wadah.appendChild(b);

      var c = document.createElement('button');
      c.textContent = 'Cek jadwal yang terdaftar di HP';
      c.style.cssText = b.style.cssText;
      c.onclick = async function () {
        try {
          var p = await LN.getPending();
          var n = (p.notifications || []);
          if (!n.length) { alert('Belum ada jadwal terdaftar di HP ini.'); return; }
          alert(n.length + ' jadwal terdaftar:\n' + n.slice(0, 8).map(function (x) {
            var at = x.schedule && x.schedule.at ? new Date(x.schedule.at) : null;
            return '- ' + x.title + ' \u2192 ' + (at && !isNaN(at) ? at.toLocaleString('id-ID') : '?');
          }).join('\n'));
        } catch (e) { alert('Gagal membaca jadwal: ' + e); }
      };
      wadah.appendChild(c);
    });
  }
})();
