import os
from PIL import Image
from rembg import remove
import json
import sys

# --- Paths ---
RAW_DIR = "assets/raw"  # AI-generated images
TEXTURE_DIR = "resource_pack/textures"
SCRIPT_DIR = "resource_pack/scripts"
MANIFEST_PATH = "resource_pack/manifest.json"

# --- Logging helpers ---
SUCCESS = "✅"
ERROR = "❌"

def log_success(msg):
    print(f"[SUCCESS] {SUCCESS} {msg}")

def log_error(msg):
    print(f"[ERROR] {ERROR} {msg}")

def exit_with_error(msg):
    log_error(msg)
    sys.exit(1)

# --- 1. Convert AI images to Minecraft textures ---
os.makedirs(TEXTURE_DIR, exist_ok=True)

ai_files = [f for f in os.listdir(RAW_DIR) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
if not ai_files:
    exit_with_error(f"No AI images found in {RAW_DIR}")

for file in ai_files:
    input_path = os.path.join(RAW_DIR, file)
    temp_path = "temp_no_bg.png"
    output_path = os.path.join(TEXTURE_DIR, os.path.splitext(file)[0] + ".png")

    # Remove background
    with open(input_path, "rb") as f:
        input_data = f.read()
    output_data = remove(input_data)
    with open(temp_path, "wb") as f:
        f.write(output_data)

    # Open and resize/pixelate
    img = Image.open(temp_path)
    img = img.resize((32, 32), Image.NEAREST)  # Minecraft pixel-art size
    img = img.convert("P", palette=Image.ADAPTIVE, colors=16)  # Reduce colors
    img.save(output_path)

    log_success(f"Converted AI image → Minecraft texture: {output_path}")

# --- 2. Validate manifest ---
if not os.path.exists(MANIFEST_PATH):
    exit_with_error(f"Manifest not found: {MANIFEST_PATH}")

try:
    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)
except json.JSONDecodeError as e:
    exit_with_error(f"Manifest JSON invalid: {e}")

required_keys = ["format_version", "header", "modules"]
for key in required_keys:
    if key not in manifest:
        exit_with_error(f"Missing key in manifest: {key}")
log_success("Manifest keys validated")

# --- 3. Validate modules ---
modules = manifest.get("modules", [])
if not modules:
    exit_with_error("No modules defined in manifest")

for module in modules:
    entry = module.get("entry")
    if not entry:
        exit_with_error(f"Module missing 'entry' field: {module}")
    entry_path = os.path.join("resource_pack", entry)
    if not os.path.exists(entry_path):
        exit_with_error(f"Script entry missing: {entry_path}")
log_success("All script entries exist")

# --- 4. Validate compiled scripts ---
if not os.path.exists(SCRIPT_DIR):
    exit_with_error(f"Scripts directory missing: {SCRIPT_DIR}")

js_files = [f for f in os.listdir(SCRIPT_DIR) if f.lower().endswith(".js")]
if not js_files:
    log_error(f"No compiled JS files found in {SCRIPT_DIR}")
else:
    log_success(f"Found {len(js_files)} compiled JS files")

# --- 5. Validate textures ---
textures = [f for f in os.listdir(TEXTURE_DIR) if f.lower().endswith(".png")]
if not textures:
    exit_with_error(f"No textures found in {TEXTURE_DIR}")
log_success(f"Found {len(textures)} textures")

print("\n🎮 Add-on check & texture conversion complete!")