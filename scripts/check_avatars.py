import os
import hashlib

d = r"D:\AI-Agent\fastAtoms\app\frontend\public\avatars"
files = sorted([f for f in os.listdir(d) if f.endswith(".svg")])
hashes = set()
for f in files:
    fp = os.path.join(d, f)
    h = hashlib.md5(open(fp, "rb").read()).hexdigest()
    hashes.add(h)
    print(f"  {f}: {os.path.getsize(fp)} bytes, MD5={h[:12]}...")

print(f"\nUnique: {len(hashes)}/{len(files)} - {'ALL GOOD' if len(hashes) == len(files) else 'DUPLICATES!'}")
