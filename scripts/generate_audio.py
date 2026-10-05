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
    index_path.write_text(
        json.dumps(audio_index, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"Indexed {len(audio_index)} unique items")

asyncio.run(main())
