import subprocess

# Vamos criar um SVG elegante e idêntico ao logotipo fornecido pelo usuário:
# Fundo preto com bordas arredondadas (squircle), texto branco "$utello"
# O '$' com barra vertical estilizada e a tipografia bold geométrica sans-serif

svg_content_512 = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="115" ry="115" fill="#050508"/>
  <g fill="#FFFFFF" text-anchor="middle" dominant-baseline="central">
    <text x="256" y="258" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="114" letter-spacing="-1">
      <tspan fill="#FFFFFF">$</tspan>utello
    </text>
  </g>
</svg>'''

with open("icon-temp.svg", "w") as f:
    f.write(svg_content_512)

# Converter com ImageMagick convert ou rsvg
subprocess.run(["convert", "-background", "none", "icon-temp.svg", "-resize", "512x512", "public/icon-512.png"])
subprocess.run(["convert", "-background", "none", "icon-temp.svg", "-resize", "192x192", "public/icon-192.png"])
subprocess.run(["convert", "-background", "none", "icon-temp.svg", "-resize", "512x512", "public/icon-hh512.png"])
subprocess.run(["convert", "-background", "none", "icon-temp.svg", "-resize", "180x180", "public/apple-touch-icon.png"])

# Também criar dentro de /public/App/ caso alguém acesse por /App/
import os
os.makedirs("public/App", exist_ok=True)
for name in ["icon-512.png", "icon-192.png", "icon-hh512.png", "apple-touch-icon.png"]:
    subprocess.run(["cp", f"public/{name}", f"public/App/{name}"])

print("Ícones gerados com sucesso!")
