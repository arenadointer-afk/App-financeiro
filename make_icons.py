import os
import subprocess

# Usamos exatamente o public/icon-512.png original (logo oficial $utello em fundo #08080C)
# para gerar todos os ícones do APK Android (Adaptive Icon, Launcher, Round, Status Bar e Splash Screens)!

os.makedirs("public/App", exist_ok=True)
for name in ["icon-512.png", "icon-192.png", "icon-hh512.png", "apple-touch-icon.png"]:
    if os.path.exists(f"public/{name}"):
        subprocess.run(["cp", f"public/{name}", f"public/App/{name}"], check=True)

# 1. Mipmaps do Android APK:
# - ic_launcher.png: Ícone completo nas dimensões de cada densidade
# - ic_launcher_round.png: Ícone redondo com máscara circular perfeita
# - ic_launcher_foreground.png: Camada de frente do Adaptive Icon (108dp onde a área segura central é 66dp)
#   Centralizamos o logo $utello dentro da área segura com fundo #08080C para nunca cortar o texto "$utello"!
mipmap_sizes = {
    "mipmap-mdpi": (48, 108, 66),
    "mipmap-hdpi": (72, 162, 100),
    "mipmap-xhdpi": (96, 216, 134),
    "mipmap-xxhdpi": (144, 324, 200),
    "mipmap-xxxhdpi": (192, 432, 268),
}

for folder, (launcher_px, fg_px, safe_px) in mipmap_sizes.items():
    target_dir = os.path.join("android/app/src/main/res", folder)
    os.makedirs(target_dir, exist_ok=True)

    # ic_launcher.png (quadrado com cantos arredondados originais)
    subprocess.run([
        "convert", "public/icon-512.png",
        "-resize", f"{launcher_px}x{launcher_px}",
        os.path.join(target_dir, "ic_launcher.png")
    ], check=True)

    # ic_launcher_round.png (redondo preenchendo todo o círculo com a logo centralizada)
    inner_round = int(launcher_px * 0.86)
    subprocess.run([
        "convert",
        "-size", f"{launcher_px}x{launcher_px}", "xc:none",
        "-fill", "#08080C",
        "-draw", f"circle {launcher_px/2},{launcher_px/2} {launcher_px/2},0",
        "(", "public/icon-512.png", "-resize", f"{inner_round}x{inner_round}", ")",
        "-gravity", "center", "-composite",
        os.path.join(target_dir, "ic_launcher_round.png")
    ], check=True)

    # ic_launcher_foreground.png (Adaptive Icon Foreground - centralizado na safe zone de 66dp)
    subprocess.run([
        "convert", "public/icon-512.png",
        "-resize", f"{safe_px}x{safe_px}",
        "-background", "#08080C",
        "-gravity", "center",
        "-extent", f"{fg_px}x{fg_px}",
        os.path.join(target_dir, "ic_launcher_foreground.png")
    ], check=True)

# 2. Ícone da Barra de Status / Notificações Android (Monocromático branco com fundo transparente)
# Extraímos apenas as letras brancas de public/icon-512.png tornando o fundo #08080C transparente!
drawable_dir = "android/app/src/main/res/drawable"
os.makedirs(drawable_dir, exist_ok=True)
for notif_name in ["ic_stat_sutello.png", "ic_stat_icon_config_sample.png"]:
    subprocess.run([
        "convert", "public/icon-512.png",
        "-fuzz", "20%", "-transparent", "#08080C",
        "-resize", "96x96",
        os.path.join(drawable_dir, notif_name)
    ], check=True)

# 3. Splash Screens em todas as resoluções do Android com a logo $utello centralizada em fundo #08080C
splash_targets = [
    ("drawable", 480, 320, 140),
    ("drawable-port-mdpi", 320, 480, 130),
    ("drawable-port-hdpi", 480, 800, 192),
    ("drawable-port-xhdpi", 720, 1280, 260),
    ("drawable-port-xxhdpi", 960, 1600, 340),
    ("drawable-port-xxxhdpi", 1280, 1920, 420),
    ("drawable-land-mdpi", 480, 320, 130),
    ("drawable-land-hdpi", 800, 480, 180),
    ("drawable-land-xhdpi", 1280, 720, 240),
    ("drawable-land-xxhdpi", 1600, 960, 300),
    ("drawable-land-xxxhdpi", 1920, 1280, 380),
]

for folder, w, h, logo_size in splash_targets:
    t_dir = os.path.join("android/app/src/main/res", folder)
    os.makedirs(t_dir, exist_ok=True)
    subprocess.run([
        "convert", "public/icon-512.png",
        "-resize", f"{logo_size}x{logo_size}",
        "-background", "#08080C",
        "-gravity", "center",
        "-extent", f"{w}x{h}",
        os.path.join(t_dir, "splash.png")
    ], check=True)

print("Todos os ícones Android APK (Launcher, Round, Adaptive Foreground, Status Bar e Splash) atualizados com o logo oficial $utello!")
