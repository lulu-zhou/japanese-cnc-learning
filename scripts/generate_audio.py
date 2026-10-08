import asyncio, hashlib, json, re
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
m = re.search(r"const DAYS=(\[.*?\]);\nlet day=", HTML, re.S)
if not m:
    raise SystemExit("Could not find DAYS data in index.html")
days = json.loads(m.group(1))

texts = []
for day in days:
    for word in day.get("words", []):
        if word and word[0]:
            texts.append(word[0])
    for sent in day.get("sentences", []):
        if sent and sent[0]:
            texts.append(sent[0])


# Extra fixed training phrases used by pattern substitution drills.
EXTRA_TEXTS = [
    "図面を確認します。","寸法を確認します。","在庫を確認します。","納期を確認します。","現品を確認します。",
    "外径を測定します。","内径を測定します。","深さを測定します。","位置度を測定します。","面粗さを測定します。",
    "寸法不良が発生しました。","設備故障が発生しました。","傷が発生しました。","びびりが発生しました。","異常摩耗が発生しました。",
    "原因は工具摩耗です。","原因は確認不足です。","原因は清掃不足です。","原因は位置ずれです。","原因は設定ミスです。",
    "暫定対策として全数検査を実施します。","暫定対策として対象品を隔離します。","暫定対策として出荷を保留します。","暫定対策として在庫を選別します。","暫定対策として再検査を実施します。",
    "納期への影響はありません。","機能への影響はありません。","性能への影響はありません。","品質への影響はありません。","生産への影響はありません。",
    "明日出荷する予定です。","午後に復旧する予定です。","治具を交換する予定です。","全数検査を実施する予定です。","条件を変更する予定です。"
]
texts.extend(EXTRA_TEXTS)
KANJI_FAMILY_TEXTS = [
  "生産性",
  "生産計画",
  "生産管理",
  "量産",
  "増産",
  "管理",
  "品質管理",
  "管理値",
  "確認",
  "確定",
  "確保",
  "測定",
  "実測",
  "測定値",
  "改善",
  "改訂",
  "改造",
  "検査",
  "検討",
  "点検",
  "工程",
  "工具",
  "工数",
  "加工",
  "品質",
  "製品",
  "品番",
  "定置"
]
texts.extend(KANJI_FAMILY_TEXTS)

# v13 specialized Chinese-native exercises share the exact strings played in the browser.
practice_file = ROOT / "data" / "practice-v13.json"
if practice_file.exists():
    practice = json.loads(practice_file.read_text(encoding="utf-8"))
    for group in ("endings", "particles", "traps", "confusions", "listening"):
        for question in practice.get(group, []):
            audio = question.get("audio")
            if audio and isinstance(audio, str):
                texts.append(audio)

# unique, preserve order
seen=set(); unique=[]
for t in texts:
    if t not in seen:
        seen.add(t); unique.append(t)

out = ROOT / "audio"
out.mkdir(exist_ok=True)
index_path = out / "audio-index.json"
audio_index = {}

VOICE = "ja-JP-NanamiNeural"

async def make_one(text):
    key = hashlib.sha1(text.encode("utf-8")).hexdigest()[:16]
    rel = f"audio/{key}.mp3"
    dst = ROOT / rel
    audio_index[text] = rel
    if dst.exists() and dst.stat().st_size > 500:
        return
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(str(dst))
    print("generated", rel, text)

async def main():
    # Keep concurrency conservative so the endpoint is not hammered.
    sem = asyncio.Semaphore(4)
    async def guarded(t):
        async with sem:
            try:
                await make_one(t)
            except Exception as e:
                print("FAILED", t, repr(e))
    await asyncio.gather(*(guarded(t) for t in unique))
    missing = [t for t in unique if not (ROOT / audio_index[t]).exists() or (ROOT / audio_index[t]).stat().st_size <= 500]
    if missing:
        raise RuntimeError(f"Audio generation incomplete: {len(missing)} missing; examples={missing[:5]}")
    index_path.write_text(
        json.dumps(audio_index, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Indexed {len(audio_index)} unique items")

asyncio.run(main())
