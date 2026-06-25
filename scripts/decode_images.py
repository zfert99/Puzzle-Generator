import base64, re, sys

with open(r'c:\Users\user\Documents\BiscuittArcade\Puzzle-Generator\Docs\Research\Puzzle Website Strategy Analysis.md', 'r', encoding='utf-8') as f:
    content = f.read()

images = re.findall(r'\[image(\d+)\]: <data:image/png;base64,([^>]+)>', content)

from PIL import Image
import io

out_lines = []
for img_id, b64 in images:
    data = base64.b64decode(b64)
    out_lines.append(f"=== Image {img_id} ===")
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    w, h = img.size
    for y in range(h):
        line = ""
        for x in range(w):
            r, g, b, a = img.getpixel((x, y))
            if a < 128 or (r > 200 and g > 200 and b > 200):
                line += "."
            else:
                line += "#"
        out_lines.append(line)

with open(r'C:\Users\user\.gemini\antigravity-ide\brain\036390a2-9d8e-4dd9-9e7d-f045d6a8d228\scratch\decoded_output.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(out_lines))
