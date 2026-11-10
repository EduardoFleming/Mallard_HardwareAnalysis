"""Gera o ícone multi-resolução do Mallard para Windows usando Pillow."""

import sys
from pathlib import Path

from PIL import Image, ImageDraw


def render(size):
    scale = 4
    side = size * scale
    im = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)

    def p(value):
        return round(value * scale)

    # Fundo em mosaico arredondado, como o ícone do Mallard no cabeçalho.
    draw.rounded_rectangle((p(1), p(1), p(63), p(63)), radius=p(14), fill="#1F2A24")

    # Corpo e pescoço do pato-real.
    draw.polygon([(p(17), p(31)), (p(39), p(33)), (p(38), p(45)), (p(42), p(57)), (p(9), p(57)), (p(14), p(45))], fill="#2FA86B")
    draw.ellipse((p(14), p(10), p(43), p(39)), fill="#2FA86B")

    # Brilho da cabeça e separação da plumagem.
    draw.arc((p(16), p(11), p(39), p(34)), start=198, end=258, fill="#8BD8AE", width=p(2))
    draw.line([(p(17), p(41)), (p(24), p(45)), (p(37), p(42))], fill="#D9EEE0", width=p(3))

    # Bico dourado e olho pixelado.
    draw.polygon([(p(40), p(20)), (p(56), p(23)), (p(56), p(29)), (p(41), p(30))], fill="#E9C23A")
    draw.rectangle((p(31), p(17), p(35), p(21)), fill="#0B0F0D")

    im = im.resize((size, size), Image.Resampling.LANCZOS)
    return im


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: generateIcon.py <caminho-de-saida.ico>")
    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    render(256).save(output, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"Ícone gerado: {output}")


if __name__ == "__main__":
    main()
