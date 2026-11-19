#!/data/data/com.termux/files/usr/bin/bash
# Unduh APK terbaru dari GitHub Actions lewat Termux.
# Pakai: bash ~/hz-trip/tools/unduh-apk.sh        (tunggu build commit terakhir, lalu unduh)
#        bash ~/hz-trip/tools/unduh-apk.sh cepat  (langsung unduh artifact terbaru, tanpa menunggu)
set -e
R="hannezt12/hz-trip"
T=$(sed -n 's#^https://[^:]*:\([^@]*\)@github.com.*#\1#p' ~/.git-credentials | head -1)
[ -z "$T" ] && { echo "Token tidak ditemukan di ~/.git-credentials"; exit 1; }
API="https://api.github.com/repos/$R"
H=(-H "Authorization: Bearer $T" -H "Accept: application/vnd.github+json")
SHA=$(cd ~/hz-trip && git rev-parse HEAD)
if [ "$1" != "cepat" ]; then
  echo "Menunggu build commit ${SHA:0:7} ..."
  for i in $(seq 1 60); do
    J=$(curl -s "${H[@]}" "$API/actions/runs?head_sha=$SHA&per_page=1")
    ST=$(echo "$J" | grep -m1 '"status"' | sed 's/.*: "\(.*\)".*/\1/')
    CO=$(echo "$J" | grep -m1 '"conclusion"' | sed 's/.*: \(.*\),*/\1/' | tr -d '", ')
    echo "  status: ${ST:-belum ada} ${CO}"
    [ "$ST" = "completed" ] && break
    sleep 20
  done
  [ "$CO" != "success" ] && { echo "Build belum sukses ($CO). Cek tab Actions."; exit 1; }
fi
ID=$(curl -s "${H[@]}" "$API/actions/artifacts?name=hz-trip-apk&per_page=1" | grep -m1 '"id"' | tr -dc '0-9')
[ -z "$ID" ] && { echo "Artifact tidak ditemukan / kedaluwarsa"; exit 1; }
OUT=~/storage/downloads
mkdir -p "$OUT"; cd "$OUT"
curl -sL "${H[@]}" -o hz-trip-apk.zip "$API/actions/artifacts/$ID/zip"
unzip -o hz-trip-apk.zip && rm hz-trip-apk.zip
echo "Selesai. APK ada di Download: $(ls -t $OUT/*.apk | head -1)"
