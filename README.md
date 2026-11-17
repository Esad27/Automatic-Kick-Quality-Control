# Kick Quality Control

Kick yayınlarında kaliteyi her seferinde oynatıcı menüsünden değiştirmek istemediğim için kendi kullanımım amacıyla geliştirdiğim bir Chrome eklentisi. Yayının sunduğu en yüksek çözünürlüğü seçebiliyor, belirli bir çözünürlüğü tercih edebiliyor veya kalite yönetimini tamamen Kick'in otomatik moduna bırakabiliyorum.

Eklenti, kalite menüsünü açıp seçeneklere tıklamıyor. Kick'in kullandığı **Amazon IVS Player** ile uygulamanın mevcut kalite kontrol işlevi üzerinden iletişim kuruyor.

## Ekran görüntüleri

<p align="center">
  <img src="docs/screenshots/control-panel.png" alt="Kick Quality Control ayar paneli: 1080p60 kalitesi, kapalı Auto modu ve aktif bağlantı" width="315">
  &nbsp;&nbsp;
  <img src="docs/screenshots/quality-options.png" alt="Kick Quality Control çözünürlük seçenekleri: En yüksek, Auto, 1080p, 720p, 480p, 360p ve 160p" width="315">
</p>

<p align="center"><sub>Solda oynatıcı durumu ve kontroller; sağda kalite seçimi.</sub></p>

## Özellikler

- **En yüksek kaliteyi seçme:** Yayında sunulan en yüksek çözünürlüğü otomatik olarak tercih eder.
- **Sabit çözünürlük:** 1080p, 720p, 480p, 360p veya 160p seçilebilir.
- **Auto modu:** Kalite seçimi istenirse yeniden Kick'e bırakılabilir.
- **Aç/kapat kontrolü:** Eklenti simgesine tıklayarak kalite yönetimi devre dışı bırakılabilir. Kapatıldığında oynatıcıyı bir kez Auto moduna döndürmeyi dener.
- **Canlı durum bilgisi:** Aktif kaliteyi, Auto modunun açık olup olmadığını ve yayının sunduğu çözünürlükleri gösterir.
- **Şimdi uygula:** Sekmeyi yenilemeden seçilen tercihin yeniden uygulanmasını ister.
- **Kalıcı tercihler:** Ayarlar `chrome.storage.local` içinde tutulur ve Kick sekmeleri arasında paylaşılır.

## Kurulum

Bu proje **Manifest V3** kullanan, elle yüklenen bir Chrome eklentisidir. Chrome Web Store'da yayımlanmıyor.

1. Depoyu ZIP olarak indirip çıkar veya bilgisayarına klonla.
2. Chrome'da `chrome://extensions` adresini aç.
3. Sağ üstten **Geliştirici modu** seçeneğini etkinleştir.
4. **Paketlenmemiş öğe yükle** seçeneğine tıkla.
5. `manifest.json` dosyasının bulunduğu proje klasörünü seç.
6. Kick'te bir yayın aç veya açık olan Kick sekmesini yenile.

Eklentiye sık erişmek için Chrome araç çubuğuna sabitleyebilirsin. Önceki sürüm yüklüyse iki ayrı kalite kontrolünün çakışmaması için eskisini kapat.

## Nasıl kullanılır?

Kick'te bir yayın açıkken araç çubuğundaki **Kick Quality Control** simgesine tıkla. Panelin üstündeki anahtar kalite kontrolünü açıp kapatır. **Tercih edilen kalite** alanından seçim yaptığında ayar otomatik kaydedilir.

| Seçenek | Davranış |
| --- | --- |
| **En yüksek mevcut kalite** | Yayının sunduğu en yüksek çözünürlüğü seçer. Eşit çözünürlüklerde kare hızı ve bitrate dikkate alınır. |
| **Auto (Kick karar versin)** | Kalite seçimini IVS oynatıcısının otomatik moduna bırakır. |
| **1080p / 720p / 480p / 360p / 160p** | Önce tam eşleşen çözünürlüğü arar. Bulamazsa daha düşük en yakın seçeneğe geçer. Daha düşük seçenek de yoksa mevcut en düşük çözünürlüğü kullanır. |
| **Eklenti kapalı** | Kaliteyi zorlamayı bırakır; kapatılırken Auto moduna dönmeyi dener. |

**Aktif Kick sekmesi** bölümünde oynatıcının bildirdiği kaliteyi ve Auto durumunu görebilirsin. Örneğin **1080p60** ve **Auto modu: Kapalı** birlikte görünüyorsa oynatıcıda sabit kalite seçilmiştir. **Mevcut** satırı, o yayının gerçekten sunduğu kalite seçeneklerini listeler.

Yayıncı 1080p sunmuyorsa eklenti bu çözünürlüğü oluşturamaz. Ayrıca yüksek çözünürlük seçmek, yavaş veya kararsız bağlantılarda takılmasız oynatma garantisi vermez.

## Oynatıcıyı nasıl buldum?

İlk olarak Chrome DevTools üzerinden Kick'in kalite menüsünü inceledim. Menü React tarafından oluşturuluyordu; çözünürlük seçenekleri de `role="menuitemradio"` kullanan öğelerdi. Başlangıçta bu öğelerin tıklama olaylarını izledim. Fakat menüyü kodla açıp seçeneğe tıklamak güvenilir bir çözüm değildi. Menü durumu, olay sırası ve React bileşenlerinin yaşam döngüsü buna engel olabiliyordu.

Bunun üzerine arayüzü taklit etmek yerine **kalite değişimini yapan fonksiyonu** aradım. DevTools'ta olay işleyicilerini ve sayfanın derlenmiş JavaScript dosyalarını takip ederek şu çağrıya ulaştım:

```js
const player = getStore().ivsLivestreamPlayer;
player.setQuality(quality, adaptive);
```

Bu noktadan sonra parçalar netleşti:

1. **Kick, Amazon IVS Player kullanıyor.** İncelediğim pakette oynatıcı `create(...)` üzerinden oluşturuluyor ve IVS WebAssembly worker dosyaları tanımlanıyordu. Pakette `1.56.2` sürüm bilgisi yer alıyordu.
2. **Aktif oynatıcı uygulamanın durum deposunda tutuluyor.** `ivsLivestreamPlayer` alanı oynatıcı nesnesini veriyor. Kick'in `setQuality` işlemi hem IVS kalitesini değiştiriyor hem de arayüzdeki `currentQuality` durumunu güncelliyor.
3. **Store bir Turbopack modülünden dışa aktarılıyor.** İncelediğim derlemede modül kimliği `159838`, dışa aktarım adı ise `f` idi. Eklenti mevcut oynatıcı örneğine bu bağlantı üzerinden erişmeyi deniyor.

Böylece kalite menüsünü otomatik tıklatmaya gerek kalmadı. Eklenti doğrudan oynatıcının sunduğu kalite listesini okuyor ve Kick'in kendi kalite değiştirme işlemini çağırıyor.

Temel akışın sadeleştirilmiş hâli:

```js
const state = store.getState();
const player = state.ivsLivestreamPlayer;
const qualities = player.getQualities();

// Tercihe göre, yayının sunduğu kalite seçeneklerinden biri belirlenir.
state.setQuality(target, false);
```

Bu parça tek başına Console'a yapıştırılıp çalıştırılacak bir kod değil; eklentinin kullandığı yaklaşımı gösteriyor. Gerçek uygulamada oynatıcının hazır olması bekleniyor, reklam oynatılırken kalite zorlanmıyor ve aynı kalite için gereksiz çağrı yapılmıyor.

**Önemli:** `159838` ve `f`, Kick'in belgelenmiş bir API'si değil; yalnızca incelediğim derlemeye ait dahili tanımlayıcılar. Kick'in yapacağı bir güncelleme bu bağlantıyı değiştirebilir.

## Teknik yapı

Proje **JavaScript, HTML ve CSS** ile, **Chrome Extension Manifest V3** üzerinde geliştirildi. Arayüz için React kullanılmıyor; ayrı bir derleme aşaması veya harici paket kurulumu gerekmiyor.

```text
Chrome araç çubuğu / popup
       |
       | chrome.storage.local + chrome.tabs mesajları
       v
content.js          [ISOLATED world]
       |
       | window.postMessage
       v
main.js             [MAIN world]
       |
       v
Kick Turbopack store
       |
       v
Amazon IVS Player
(getQualities / setQuality)
```

| Dosya | Görevi |
| --- | --- |
| `manifest.json` | Eklentinin izinlerini, çalışacağı Kick adreslerini, popup'ı ve content script'leri tanımlar. |
| `popup.html` | Açılır ayar panelinin yapısını oluşturur. |
| `popup.css` | Panelin görünümünü düzenler. |
| `popup.js` | Kullanıcı tercihlerini kaydeder, aktif Kick sekmesinin durumunu sorgular ve **Şimdi uygula** işlemini gönderir. |
| `content.js` | Chrome eklenti API'leri ile sayfanın JavaScript ortamı arasında mesajlaşmayı sağlar. |
| `main.js` | Kick store'una bağlanmayı dener, oynatıcının durumunu izler ve seçilen kaliteyi uygular. |

`MAIN` ve `ISOLATED` ayrımı burada önemli: Chrome'un depolama ve sekme API'leri eklenti ortamında çalışırken Kick'in dahili oynatıcı nesnesi sayfa ortamında bulunuyor. `content.js`, iki ortam arasındaki iletişimi yürütüyor.

**Amazon IVS kütüphanesi bu depoya eklenmedi.** Oynatıcıyı Kick kendi sayfasında yüklüyor; eklenti yalnızca mevcut örneğe erişiyor. Eklentinin harici bir sunucuya izleme verisi gönderen işlevi yok. Kaydettiği tercihler, açık/kapalı durumu ile kalite seçiminden oluşuyor.

## Sınırlar ve sorun giderme

**Panelde “Bağlanıyor” yazıyor:** Kick'in oynatıcı modülü henüz yüklenmemiş olabilir. Bir yayın açıp sekmeyi yenile. Sorun bir Kick güncellemesinden sonra başladıysa Turbopack modül bağlantısı değişmiş olabilir.

**Bağlandı görünüyor ama kalite bilgisi yok:** Oynatıcı henüz hazır olmayabilir, reklam oynuyor olabilir veya yayının kalite listesi henüz alınmamış olabilir.

**Seçilen kalite korunmuyor:** Önce yayının gerçekten o çözünürlüğü sunduğunu kontrol et. Ayrıca Kick/IVS arka planda oynatma optimizasyonu uygulayabilir; incelediğim oynatıcı yapılandırmasında bu özellik açıktı.

**Eklenti yüklü ama tepki vermiyor:** Yeni yükleme veya güncellemeden sonra açık Kick sekmelerini yenile. Aynı anda başka bir kalite kontrol eklentisinin çalışmadığından da emin ol.

İstersen Kick sekmesinde DevTools Console'u açarak bağlantı durumunu inceleyebilirsin:

```js
window.__kickQualityControlV2?.getStatus()
```

Özellikle `connected`, `playerReady`, `currentQuality`, `auto` ve `error` alanlarına bak. `connected: true` olması, tek başına yayının hazır olduğunu veya kalite değişiminin tamamlandığını göstermez.

## Notlar

Bu eklentiyi kendi izleme alışkanlığımdaki küçük ama sürekli tekrarlanan bir sorunu çözmek için geliştirdim. **Kick veya Amazon tarafından hazırlanmış, onaylanmış ya da desteklenen resmî bir ürün değildir.** Kick ve Amazon IVS adları ilgili hak sahiplerine aittir.

Çalışma yöntemi Kick'in belgelenmemiş dahili yapısına bağlı olduğu için gelecek sürümlerde uyumluluk garantisi veremem. Ekran görüntüleri mevcut arayüzü gösterir; her yayın aynı kalite seçeneklerini sunmayabilir.
