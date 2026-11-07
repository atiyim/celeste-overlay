#!/bin/bash
# Android emülatöründe çökme testi: uygulamayı kurar, açar, geri/ana ekran tuşlarına basar, Android'in uygulamayı
# kapattığı durumları dener ve her adımda uygulamanın çökmediğini ve ekranın beyaz kalmadığını denetler.
# Kullanım: mobile/test/emulator.sh <apk> <çıktı klasörü>
APK="$1"; OUT="${2:-emu-out}"
P=com.bneceleste.celeste
mkdir -p "$OUT"
FAIL=0
log() { echo "$*" | tee -a "$OUT/steps.txt"; }
launch() { adb shell monkey -p $P -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; }
pid() { adb shell pidof $P | tr -d '\r'; }
shot() { adb exec-out screencap -p > "$OUT/$1.png"; }
# Ekran beyaz mı? (uygulama koyu renkli; ortalama parlaklık çok yüksekse WebView çizilmemiş demektir)
white() { python3 - "$OUT/$1.png" <<'PY'
import sys, zlib, struct
d = open(sys.argv[1], 'rb').read()
# PNG'yi ek kütüphane olmadan çöz: yalnızca IDAT verisinin kabaca parlaklığına bakılır.
i, chunks = 8, b''
while i < len(d):
    n = struct.unpack('>I', d[i:i+4])[0]; t = d[i+4:i+8]
    if t == b'IDAT': chunks += d[i+8:i+8+n]
    i += 12 + n
raw = zlib.decompress(chunks)
print(1 if sum(raw[::97]) / max(1, len(raw[::97])) > 200 else 0)
PY
}
check() { # $1 adım adı; $2: 1 = çalışmalı ve ekran beyaz olmamalı, 2 = yalnızca çalışmalı (Riot'un sayfası), 0 = denetim yok
  local p; p=$(pid)
  log "$1: pid=${p:-yok}"
  if [ "$2" != 0 ] && [ -z "$p" ]; then log "  HATA: uygulama çalışmıyor"; FAIL=1; fi
  if [ "$2" != 0 ]; then shot "$1"; fi
  if [ "$2" = 1 ] && [ "$(white "$1")" = 1 ]; then log "  HATA: ekran beyaz"; FAIL=1; fi
}

adb install -r "$APK" > "$OUT/install.txt" 2>&1 || { cat "$OUT/install.txt"; exit 1; }
adb logcat -c
launch; sleep 25; check 01-ilk-acilis 1
adb shell input keyevent KEYCODE_BACK; sleep 5; check 02-geri 0
launch; sleep 8; check 03-geri-sonra-acilis 1
adb shell input keyevent KEYCODE_HOME; sleep 4; launch; sleep 8; check 04-ana-ekran-sonra-acilis 1
adb shell input tap 160 270; sleep 15; check 05-giris-sayfasi 2
adb shell input keyevent KEYCODE_BACK; sleep 4; check 06-giris-sayfasinda-geri 2
adb shell am force-stop $P; sleep 2; launch; sleep 20; check 07-zorla-kapat-sonra-acilis 1
# Android ekranı kapatıp süreci açık bırakırsa (bellek darlığı, "etkinlikleri tutma"): bir sonraki açılış beyaz kalmamalı.
adb shell settings put global always_finish_activities 1
adb shell input keyevent KEYCODE_HOME; sleep 5; check 08-ekran-kapandi 0
launch; sleep 20; check 09-ekran-kapandiktan-sonra-acilis 1
adb shell settings put global always_finish_activities 0
adb shell input keyevent KEYCODE_HOME; sleep 3; adb shell am kill $P; sleep 3; check 10-arka-planda-kapatildi 0
launch; sleep 20; check 11-son-acilis 1

adb logcat -d > "$OUT/logcat.txt"
adb logcat -b crash -d > "$OUT/crash.txt"
if grep -q "$P" "$OUT/crash.txt"; then log "HATA: çökme kaydı var (crash.txt)"; FAIL=1; fi
if grep -qE "ANR in $P" "$OUT/logcat.txt"; then log "HATA: uygulama yanıt vermedi (ANR)"; FAIL=1; fi
[ "$FAIL" = 0 ] && log "SONUÇ: çökme yok" || log "SONUÇ: HATA"
exit $FAIL
