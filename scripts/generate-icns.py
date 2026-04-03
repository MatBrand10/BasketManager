from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow nao instalado. Rode: python -m pip install pillow")


src = Path("assets/icon.png")
dest = Path("assets/icon.icns")

if not src.exists():
    raise SystemExit(f"Arquivo nao encontrado: {src}")

img = Image.open(src).convert("RGBA")
img = img.resize((1024, 1024), Image.LANCZOS)

sizes = [(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)]
img.save(dest, sizes=sizes)

print(f"ICNS criado em {dest}")
