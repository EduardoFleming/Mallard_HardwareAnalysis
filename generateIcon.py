"""Gera o ícone multi-resolução do Mallard para Windows usando Pillow."""

import sys
import struct
from pathlib import Path

from PIL import Image, ImageDraw


def render(size):
    scale = 4
    # Desenho em coordenadas lógicas 64x64 com supersampling. O canvas não
    # pode crescer junto com o tamanho do destino, senão o pato fica minúsculo.
    side = 64 * scale
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

    return im.resize((size, size), Image.Resampling.LANCZOS)


def _dib_frame(size):
    """Codifica um frame ICO como DIB clássico BGRA + máscara AND Windows."""
    image = render(size)
    pixels = image.load()

    # BITMAPINFOHEADER: a altura é duplicada porque contém XOR e AND masks.
    header = struct.pack(
        "<IiiHHIIiiII",
        40, size, size * 2, 1, 32, 0, size * size * 4,
        0, 0, 0, 0,
    )
    xor = bytearray()
    for y in range(size - 1, -1, -1):
        for x in range(size):
            red, green, blue, alpha = pixels[x, y]
            xor.extend((blue, green, red, alpha))

    # Para ícones de 32 bits, Windows Vista+ usa o canal alfa. A máscara AND
    # deve ficar zerada; duplicar transparência nela faz alguns shell views
    # apagarem também o fundo opaco e sobrar só partes coloridas do pato.
    row_bytes = ((size + 31) // 32) * 4
    mask = bytearray(row_bytes * size)
    return header + xor + mask


def write_ico(path):
    """Grava um ICO multi-resolução com frames DIB, sem PNG dentro do ICO."""
    sizes = [16, 24, 32, 48, 64, 128, 256]
    frames = [_dib_frame(size) for size in sizes]
    directory_size = 6 + 16 * len(sizes)
    entries = bytearray()
    offset = directory_size
    for size, frame in zip(sizes, frames):
        dimension = 0 if size == 256 else size
        entries.extend(struct.pack(
            "<BBBBHHII",
            dimension, dimension, 0, 0, 1, 32, len(frame), offset,
        ))
        offset += len(frame)
    Path(path).write_bytes(struct.pack("<HHH", 0, 1, len(sizes)) + entries + b"".join(frames))


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: generateIcon.py <caminho-de-saida.ico>")
    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    write_ico(output)
    print(f"Ícone gerado: {output}")


if __name__ == "__main__":
    main()
