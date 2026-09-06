import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ScanLine,
  Smartphone,
  X,
} from "lucide-react";
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

export function Guided() {
  const [copied, setCopied] = useState(false);

  const copyPix = async () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="pixelpix-mockup-root pixelpix-guided">
      <section className="pixelpix-sheet" aria-label="Checkout Pix orientado">
        <header className="pixelpix-sheet-header">
          <button className="pixelpix-button-ghost" type="button">
            <ArrowLeft size={15} />
            Voltar
          </button>
          <button className="pixelpix-button-ghost pixelpix-close" type="button">
            Fechar
            <X size={15} />
          </button>
        </header>

        <div className="pixelpix-guided-header">
          <div className="pixelpix-guided-heading">
            <div className="pixelpix-eyebrow">PAGAMENTO VIA PIX</div>
            <h1>Revele seu pixel</h1>
            <p>
              Escolha uma das formas abaixo para pagar. Assim que a Efí confirmar
              o pagamento, seu pixel será revelado automaticamente.
            </p>
          </div>
          <div className="pixelpix-guided-summary">
            <span>Você vai pagar</span>
            <strong>R$ 1,00</strong>
            <small>Reserva expira em 04:32</small>
          </div>
        </div>

        <div className="pixelpix-destination">
          <span>Certificado enviado para</span>
          <strong>voce@exemplo.com</strong>
          <button type="button">Alterar e-mail</button>
        </div>

        <div className="pixelpix-guided-payment">
          <article className="pixelpix-qr-card">
            <div className="pixelpix-step">
              <span className="pixelpix-step-number">1</span>
              Leia o QR Code Pix
            </div>
            <p className="pixelpix-step-help">
              Abra o app do seu banco e aponte a câmera para o código.
            </p>
            <div className="pixelpix-qr-wrap">
              <MockQr />
            </div>
            <span className="pixelpix-scan-note">
              <ScanLine size={14} />
              Confira o valor antes de confirmar
            </span>
          </article>

          <article className="pixelpix-copy-card">
            <div className="pixelpix-step">
              <span className="pixelpix-step-number">2</span>
              Ou copie e cole a chave Pix
            </div>
            <p className="pixelpix-step-help">
              Use esta opção se estiver acessando o banco no mesmo celular.
            </p>
            <div className="pixelpix-or">ou</div>
            <div className="pixelpix-pix-row">
              <span className="pixelpix-pix-key">{pixCode}</span>
              <button className="pixelpix-copy" onClick={copyPix} type="button">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar código"}
              </button>
            </div>
          </article>
        </div>

        <footer className="pixelpix-guided-footer">
          <div className="pixelpix-confirmation-note">
            <CheckCircle2 size={16} />
            <span>Pagamento confirmado automaticamente</span>
          </div>
          <button className="pixelpix-change-email" type="button">
            Alterar e-mail do certificado
          </button>
        </footer>
      </section>
    </main>
  );
}