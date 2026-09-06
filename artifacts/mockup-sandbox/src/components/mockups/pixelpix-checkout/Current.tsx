import { ArrowLeft, Check, Copy, Loader2, X } from "lucide-react";
import { useState } from "react";
import "./_group.css";

const pixCode =
  "00020126580014BR.GOV.BCB.PIX0136b1c8e43a-7db2-47bb-a14d-9d4e3f7c2a6b52040000530398654041.005802BR5913PIXELPIX LTDA6008SAOPAULO62070503***6304A1B2";

function MockQr() {
  const size = 29;
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const inFinder = (startRow: number, startColumn: number) =>
      row >= startRow &&
      row < startRow + 7 &&
      column >= startColumn &&
      column < startColumn + 7;
    const finderValue = (startRow: number, startColumn: number) => {
      const localRow = row - startRow;
      const localColumn = column - startColumn;
      return (
        localRow === 0 ||
        localRow === 6 ||
        localColumn === 0 ||
        localColumn === 6 ||
        (localRow >= 2 &&
          localRow <= 4 &&
          localColumn >= 2 &&
          localColumn <= 4)
      );
    };
    const dark =
      (inFinder(0, 0) && finderValue(0, 0)) ||
      (inFinder(0, size - 7) && finderValue(0, size - 7)) ||
      (inFinder(size - 7, 0) && finderValue(size - 7, 0)) ||
      (!inFinder(0, 0) &&
        !inFinder(0, size - 7) &&
        !inFinder(size - 7, 0) &&
        ((row * 13 + column * 7 + row * column) % 11 < 5 ||
          (row + column) % 9 === 0));
    return <span className={`pixelpix-qr-cell${dark ? " is-dark" : ""}`} key={index} />;
  });

  return (
    <div
      aria-label="QR Code Pix"
      className="pixelpix-qr"
      role="img"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {cells}
    </div>
  );
}

export function Current() {
  const [copied, setCopied] = useState(false);

  const copyPix = async () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="pixelpix-mockup-root">
      <section className="pixelpix-sheet" aria-label="Checkout Pix atual">
        <header className="pixelpix-sheet-header">
          <button className="pixelpix-button-ghost" type="button">
            <ArrowLeft size={15} />
            Voltar
          </button>
          <button className="pixelpix-button-ghost pixelpix-close" type="button">
            Fechar
          </button>
        </header>

        <div className="pixelpix-guided-heading" style={{ marginBottom: 18 }}>
          <div className="pixelpix-eyebrow">PAGAMENTO VIA PIX</div>
          <div className="pixelpix-price">R$ 1,00</div>
          <div className="pixelpix-subtle">
            Pixel #999.997 · reserva expira em 04:32
          </div>
        </div>

        <div className="pixelpix-destination">
          <span>Certificado enviado para</span>
          <strong>voce@exemplo.com</strong>
          <button type="button">Alterar e-mail</button>
        </div>

        <div className="pixelpix-layout">
          <div className="pixelpix-qr-wrap">
            <MockQr />
          </div>

          <div>
            <div className="pixelpix-pix-label">Chave copia e cola</div>
            <div className="pixelpix-pix-row">
              <span className="pixelpix-pix-key">{pixCode}</span>
              <button className="pixelpix-copy" onClick={copyPix} type="button">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="pixelpix-waiting">
              <Loader2 className="pixelpix-spinner" size={14} />
              Aguardando pagamento · 04:32
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}