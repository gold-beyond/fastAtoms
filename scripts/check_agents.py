import urllib.request
import json

r = urllib.request.urlopen("http://localhost:8001/api/v1/agents")
data = json.loads(r.read())
for a in data.get("agents", []):
    print(f'{a["id"]}: {a.get("avatarUrl", "N/A")}')
