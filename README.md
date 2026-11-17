# Kick Quality Control — Chrome eklentisi (v0.2.0)

Kick'te canlı yayının çözünürlüğünü **menü açmadan**, Kick'in kullandığı **Amazon IVS Player** üzerinden kontrol etmeyi dener. Chrome araç çubuğundaki simgesine tıklayarak aç/kapat ve kalite ayarı yapabilirsin.

> **Deneysel:** Kick'in yüklediğin JS paketindeki iç Turbopack modülü (`159838`, `f` dışa aktarımı) temel alındı. Bu dahili bağlantı Chrome'da gerçek Kick sayfasında doğrulanmış değildir ve site güncellenince değişebilir.

## Kurulum

1. ZIP dosyasını bir klasöre çıkar.
2. Chrome adres çubuğunda `chrome://extensions` sayfasını aç.
3. **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle** düğmesine bas ve `kick-max-quality` klasörünü seç.
5. Kick sekmesini **yenile**. Eklentiyi araç çubuğuna sabitle ve simgesine tıkla.

Eski sürümü kullanıyorsan onu kaldır veya devre dışı bırak: iki sürümün aynı anda kaliteyi değiştirmesi çakışabilir.

## Kullanım

- **Otomatik kalite kontrolü: Açık:** Eklenti tercihini oynatıcı hazır olduğunda ve kanal değiştiğinde uygulamayı dener.
- **Kapalı:** Eklenti kaliteyi zorlamaz. Açık durumdan kapatıldığında Auto moduna bir kez geri döner, sonra kontrolü Kick'e bırakır.
- **En yüksek mevcut kalite:** Yayının sunduğu en yüksek çözünürlüğü seçer (örneğin 1080p60).
- **Auto (Kick karar versin):** Amazon IVS otomatik bitrate/kalite seçimini etkinleştirir.
- **1080p / 720p / 480p / 360p / 160p:** İstenen yüksekliği hedefler. Kaynakta yoksa en yakın **daha düşük** mevcut çözünürlüğe döner. Hiç daha düşük yoksa mevcut en düşük çözünürlüğü seçer.
- **Şimdi uygula:** Etkin sekmede seçimi yeniden zorlamayı dener.
- **Aktif Kick sekmesi:** Gerçekte seçili IVS kalitesini, Auto modunun açık olup olmadığını ve akışın sunduğu kalite seçeneklerini gösterir.

Tercihler `chrome.storage.local` içinde tutulur ve tüm Kick sekmelerine uygulanır. Eklenti başka bir siteye erişmez ve harici sunucuya veri göndermez.

## Dosyalar ve mimari

### `manifest.json`

Manifest V3. Araç çubuğunda `popup.html` açar; `storage` ve `activeTab` yetkilerini ister; iki içerik betiğini Kick sayfalarında çalıştırır.

### `popup.html` + `popup.css` + `popup.js`

Kullanıcı arayüzü. `popup.js` kontrol değişince `chrome.storage.local.set({enabled,quality})` ile ayarları kaydeder. Aktif Kick sekmesinin durumunu `chrome.tabs.sendMessage` aracılığıyla sorar.

### `content.js` — Chrome'un ISOLATED ortamı

Chrome uzantı API'lerini kullanır (`chrome.storage`, `chrome.runtime`). Ayarları `window.postMessage` ile sayfa ortamına iletir ve popup'a oynatıcı durumunu geri döndürür.

### `main.js` — sayfanın MAIN ortamı

Kick'in JS modüllerine erişebilmek için aynı JavaScript ortamında çalışır. Turbopack'ın dahili modül kayıt yöntemini kullanarak `159838.f` store'una ulaşmayı dener.

Store bağlantısı başarılıysa:

```js
const state = store.getState();
const player = state.ivsLivestreamPlayer;
const qualities = player.getQualities();
const best = qualities.sort((a,b) => b.height - a.height)[0];
state.setQuality(best, false);
```

Yukarıdaki blok **özet amaçlıdır**; asıl `main.js` kodu kalite listesine filtre, FPS ve bitrate sıralaması, geri dönüş seçimi, Auto denetimi, tekrar çağrı koruması ve yeniden yükleme kontrolleri ekler.

`state.setQuality()` kullanılması, aynı zamanda Kick'in `currentQuality` store durumunun güncellenmesi içindir. Doğrudan `player.setQuality()` yalnızca yedek yöntemdir.

### `setQuality(quality, false)` neden `false`?

Amazon IVS Web Player'da ikinci `adaptive` parametresi `false` olduğunda kalite değişimi mevcut tamponun boşaltılmasıyla daha hızlı uygulanır. `true` ise tamponun sonuna kadar bekleyerek daha yumuşak geçiş yapar. Kalite sabit seçilince ABR (Auto) kapanır.

## Teknik kaynak bulguları

Yüklediğin `1qmgob0ivmvmz.js` dosyasından:

- Turbopack store modülü: `159838` ve `e.s(["f",0,N],159838)`.
- Store oluşturma: `N=(0,t.$)()((0,r.computed)(...))`.
- Oynatıcı: `initIVSPlayer` içinde `A.create(...)`, IVS 1.56.2 ve WASM worker.
- Kalite aksiyonu: `setQuality:(r,n)=>{let o=t().ivsLivestreamPlayer; ... o.setQuality(r,n) ... }`.
- Oynatıcı `READY` olduğunda `getQualities()` ve kayıtlı kalite tercihinin uygulanması.
- `QUALITY_CHANGED` olayında `currentQuality` değerinin güncellenmesi.
- Kick arka plan oynatma optimizasyonunu `switchDelayMs:60000` ile etkinleştirmiş. Arka plandaki sekmede kalite geçici olarak düşebilir.

## Hata ayıklama

Kick'te F12 > Console:

```js
window.__kickQualityControlV2?.getStatus()
```

Bağlantı varsa `connected:true`; aktif IVS oynatıcı varsa `playerReady:true` beklenir. Mevcut kalite ve Auto bilgisi de gösterilir.

```js
const store = window.__kickQualityControlV2?.getStore();
const player = store?.getState()?.ivsLivestreamPlayer;
console.log(player?.getQualities(), player?.getQuality(), player?.isAutoQualityMode());
```

### Sınırlamalar

- `connected:false`: Kick'in Turbopack API'si veya modül numarası değişmiş olabilir, ya da player chunk'ı henüz yüklenmemiştir. Popup kalite uygulandı iddiasında bulunmaz.
- `playerReady:false`: Oynatıcı/kaliteler hazır değildir. Yayın sayfası açıp yenilemeyi dene.
- Yayıncı tarafından sağlanmayan bir çözünürlük oluşturulamaz.
- 1080p gibi yüksek sabit kalite daha fazla bant genişliği ve takılma yaratabilir.
- Amazon IVS background optimization, sekme görünmüyorken geçici olarak kaliteyi değiştirebilir.
- Ayarların değişmesiyle sekme anında güncellenebilir; yeni eklenti sürümü yüklendiyse mevcut Kick sekmesini **yenilemen** gerekir.

## Kaynaklar

- Amazon IVS Web Player SDK: https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/web-getting-started.html
- Chrome MV3 content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
