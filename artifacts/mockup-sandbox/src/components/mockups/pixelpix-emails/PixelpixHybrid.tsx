import type { ReactNode } from "react";

const boltPieces = [
  { left: "23%", top: "14%", height: "1px", width: "54%", transform: "rotate(90deg)" },
  { left: "58%", top: "14%", height: "1px", width: "54%", transform: "rotate(90deg)" },
  { left: "23%", top: "50%", height: "1px", width: "54%", transform: "rotate(90deg)" },
  { left: "58%", top: "50%", height: "1px", width: "54%", transform: "rotate(90deg)" },
  { left: "50%", top: "23%", height: "1px", width: "100%", transform: "rotate(0deg)" },
  { left: "50%", top: "58%", height: "1px", width: "100%", transform: "rotate(0deg)" },
];

function PixelpixMark({ light = false }: { light?: boolean }) {
  const square = light ? "#17382a" : "#b9fa59";
  const empty = light ? "rgba(23,56,42,.16)" : "rgba(185,250,89,.18)";

  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 shrink-0 grid-cols-3 grid-rows-4 gap-[3px]"
    >
      <span style={{ background: empty }} />
      <span style={{ background: square }} />
      <span style={{ background: empty }} />
      <span style={{ background: square }} />
      <span style={{ background: empty }} />
      <span style={{ background: square }} />
      <span style={{ background: square }} />
      <span style={{ background: empty }} />
      <span style={{ background: square }} />
      <span style={{ background: square }} />
      <span style={{ background: square }} />
      <span style={{ background: empty }} />
    </span>
  );
}

function PixelTile() {
  return (
    <div
      aria-label="Tile visual do pixel com um relâmpago"
      className="relative mx-auto aspect-square w-[142px] overflow-hidden sm:w-[158px]"
      role="img"
      style={{
        background:
          "linear-gradient(140deg, #d6ff82 0%, #a8ed48 58%, #79c735 100%)",
        border: "1px solid #214a2b",
        boxShadow: "7px 7px 0 rgba(25,63,37,.14)",
      }}
    >
      {boltPieces.map((piece, index) => (
        <span
          aria-hidden="true"
          key={index}
          style={{
            background: "rgba(41,101,44,.2)",
            height: piece.height,
            left: piece.left,
            position: "absolute",
            top: piece.top,
            transform: piece.transform,
            width: piece.width,
          }}
        />
      ))}
      <span
        aria-hidden="true"
        className="absolute inset-[17%] border border-[#356c32]/30"
      />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[72px] w-[36px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "#f6b848",
          clipPath: "polygon(58% 0, 100% 0, 63% 39%, 90% 39%, 20% 100%, 39% 54%, 7% 54%)",
          filter: "drop-shadow(2px 3px 0 rgba(78,70,27,.22))",
        }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-3 right-3 font-mono text-[8px] font-bold tracking-[.2em] text-[#2c632e]/70"
      >
        999902
      </span>
    </div>
  );
}

function DetailRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 ${
        last ? "" : "border-b border-[#d7dfd0]"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#64746a]">
        {label}
      </span>
      <span className="break-all font-mono text-[12px] font-semibold tracking-[.02em] text-[#17231c] sm:text-right">
        {children}
      </span>
    </div>
  );
}

export function PixelpixHybrid() {
  return (
    <main
      className="min-h-[100dvh] w-full px-3 py-5 sm:px-5 sm:py-8"
      style={{
        backgroundColor: "#0b100e",
        backgroundImage:
          "radial-gradient(circle at 18% 3%, rgba(185,250,89,.08), transparent 28%), linear-gradient(135deg, #0b100e 0%, #111915 58%, #0b100e 100%)",
        color: "#eef4ea",
        fontFamily:
          "'DM Sans', 'Trebuchet MS', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="mx-auto w-full max-w-[560px]">
        <header
          className="border border-[#27332e] border-b-0 px-4 py-4 sm:px-5"
          style={{ background: "rgba(18,25,22,.96)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-[#f0a65a]" />
              <span className="h-2 w-2 rounded-full bg-[#d4d76d]" />
              <span className="h-2 w-2 rounded-full bg-[#65736d]" />
            </span>
            <span className="ml-2 text-[9px] font-bold uppercase tracking-[.2em] text-[#7d8c83]">
              mensagem / caixa de entrada
            </span>
          </div>
          <div className="grid grid-cols-[54px_1fr] gap-x-3 gap-y-2 text-[11px]">
            <span className="font-mono uppercase tracking-[.14em] text-[#68766f]">
              para
            </span>
            <span className="truncate text-[#d4ddd5]">você</span>
            <span className="font-mono uppercase tracking-[.14em] text-[#68766f]">
              assunto
            </span>
            <span className="truncate font-medium text-[#e7eee8]">
              Seu certificado PIXELPIX · pixel #999.902 revelado
            </span>
          </div>
        </header>

        <article
          aria-label="Certificado PIXELPIX do pixel 999.902"
          className="overflow-hidden border border-[#34413a]"
          style={{
            backgroundColor: "#f0f4ea",
            boxShadow: "8px 10px 0 rgba(3,8,5,.4)",
          }}
        >
          <div
            className="h-2 w-full"
            style={{
              background:
                "linear-gradient(90deg, #193c2b 0 34%, #b9fa59 34% 72%, #efb150 72% 100%)",
            }}
          />

          <div className="flex items-center justify-between border-b border-[#d6ded1] px-5 py-5 sm:px-7">
            <div className="flex items-center gap-2.5">
              <PixelpixMark light />
              <span className="text-[15px] font-black tracking-[.16em] text-[#17382a]">
                PIXELPIX
              </span>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[.2em] text-[#58705f]">
                certificado
              </div>
              <div className="font-mono text-[10px] font-bold text-[#244e35]">
                01 / 01
              </div>
            </div>
          </div>

          <div className="px-5 pb-7 pt-7 sm:px-7 sm:pb-8 sm:pt-8">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-7 bg-[#4e902d]" />
              <span className="text-[10px] font-black uppercase tracking-[.18em] text-[#3f7b2c]">
                prova de titularidade
              </span>
            </div>
            <h1
              className="max-w-[460px] text-[35px] leading-[.98] tracking-[-.055em] text-[#16251b] sm:text-[43px]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              O pixel <span className="text-[#2d7139]">#999.902</span> é seu.
            </h1>
            <p className="mt-5 max-w-[440px] text-[14px] leading-6 text-[#5d6d62] sm:text-[15px]">
              A revelação foi confirmada. Este documento é o registro
              consultável de que este pixel agora pertence a você.
            </p>

            <div className="mt-7 border border-[#c9d4c4] bg-[#e2eadc] p-4 sm:mt-8 sm:p-5">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
                <PixelTile />
                <div className="text-center sm:text-left">
                  <div className="text-[9px] font-bold uppercase tracking-[.18em] text-[#64776a]">
                    item visual
                  </div>
                  <div
                    className="mt-1 text-[26px] tracking-[-.04em] text-[#183621]"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    Relâmpago
                  </div>
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-[.14em] text-[#6d806f]">
                    uma revelação para guardar
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[#c4d0bd] pt-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#6f816e]">
                <span>fragmento de tela</span>
                <span>pixel #999.902</span>
              </div>
            </div>

            <div className="mt-7 border border-[#b6d99c] bg-[#e5f3d8] p-5 sm:mt-8 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#39752d]">
                    <span className="h-2 w-2 bg-[#70bf3d]" />
                    prêmio liberado
                  </div>
                  <div
                    className="mt-2 text-[38px] leading-none tracking-[-.06em] text-[#173b25]"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    R$ 10,00
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#5a7758]">
                  disponível para resgate
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
              <a
                className="flex min-h-12 flex-1 items-center justify-center bg-[#173b27] px-4 py-3 text-center text-[12px] font-extrabold tracking-[.02em] text-[#d9ff9c] transition-opacity hover:opacity-85"
                href="https://pixelpix.world/premio/PPX-2026-999902-4A52A7F8"
              >
                Resgatar prêmio
                <span className="ml-2 text-base" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a
                className="flex min-h-12 flex-1 items-center justify-center border border-[#31563a] px-4 py-3 text-center text-[12px] font-extrabold tracking-[.02em] text-[#285d36] transition-colors hover:bg-[#e1ebde]"
                href="https://pixelpix.world/pixel/999902"
              >
                Visualizar pixel
                <span className="ml-2 text-base" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>

            <div className="mt-8 border-t border-[#cdd8c8] pt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#365a3d]">
                    registro da titularidade
                  </div>
                  <div className="mt-1 text-[11px] text-[#768477]">
                    guarde estes dados para consulta
                  </div>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[#7c8c7c]">
                  verificado
                </span>
              </div>
              <div className="mt-3 border-t border-[#cdd8c8]">
                <DetailRow label="código do certificado">
                  PPX-2026-999902-4A52A7F8
                </DetailRow>
                <DetailRow label="token privado do certificado">
                  eyJ...token-do-certificado...
                </DetailRow>
                <DetailRow label="revelado em" last>
                  13 de setembro de 2026 às 14:30
                </DetailRow>
              </div>
            </div>
          </div>

          <footer className="border-t border-[#d6ded1] bg-[#e6ede1] px-5 py-5 text-center sm:px-7">
            <div className="flex items-center justify-center gap-2">
              <PixelpixMark light />
              <span className="text-[10px] font-black tracking-[.16em] text-[#3a5a42]">
                PIXELPIX
              </span>
            </div>
            <p className="mx-auto mt-3 max-w-[370px] text-[11px] leading-5 text-[#718076]">
              Guarde este e-mail para consultar o certificado. Ele comprova a
              titularidade do seu pixel.
            </p>
          </footer>
        </article>

        <p className="px-3 pt-4 text-center font-mono text-[9px] uppercase tracking-[.16em] text-[#64746b]">
          PIXELPIX · revele um pixel, guarde a história
        </p>
      </div>
    </main>
  );
}