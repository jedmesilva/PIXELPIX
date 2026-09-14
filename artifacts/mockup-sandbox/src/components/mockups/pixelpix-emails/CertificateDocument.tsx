import { useState } from "react";

const certificateCode = "PPX-2026-999902-4A52A7F8";
const privateToken = "eyJ...token-do-certificado...";

function PixelMark({ dark = false }: { dark?: boolean }) {
  const color = dark ? "#b7f45e" : "#276b46";
  return (
    <span
      aria-hidden="true"
      className="grid h-5 w-5 shrink-0 grid-cols-3 grid-rows-4 gap-[2px]"
    >
      <i className="col-start-2 row-start-1 block" style={{ backgroundColor: color }} />
      <i className="col-start-3 row-start-1 block" style={{ backgroundColor: color }} />
      <i className="col-start-1 row-start-2 block" style={{ backgroundColor: color }} />
      <i className="col-start-3 row-start-2 block" style={{ backgroundColor: color }} />
      <i className="col-start-1 row-start-3 block" style={{ backgroundColor: color }} />
      <i className="col-start-2 row-start-3 block" style={{ backgroundColor: color }} />
      <i className="col-start-1 row-start-4 block" style={{ backgroundColor: color }} />
    </span>
  );
}

function LightningTile() {
  return (
    <div
      aria-label="Tile visual do item relâmpago"
      className="relative flex aspect-square w-[148px] items-center justify-center overflow-hidden border border-[#83b858] bg-[#c0f36b] shadow-[8px_8px_0_rgba(38,75,48,0.14)]"
      role="img"
    >
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(40,91,61,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(40,91,61,0.22)_1px,transparent_1px)] [background-size:37px_37px]" />
      <div
        className="relative z-10 h-[76px] w-[43px] -skew-x-[7deg] border border-[#f8d57c] bg-[#efaa42] shadow-[3px_4px_0_#809f52]"
        style={{
          clipPath:
            "polygon(52% 0%, 100% 0%, 65% 37%, 92% 37%, 31% 100%, 42% 57%, 8% 57%)",
        }}
      />
      <div className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#50704b]">
        999902
      </div>
    </div>
  );
}

function RegistryRow({
  label,
  value,
  mono = false,
  accent = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.25fr)] gap-4 border-t border-[#d3d9cd] py-4 first:border-t-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#708075]">
        {label}
      </dt>
      <dd
        className={`min-w-0 break-words text-right text-[13px] leading-5 ${
          mono ? "font-mono tracking-[-0.02em]" : "font-medium"
        } ${accent ? "text-[#277149]" : "text-[#27352c]"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function CertificateDocument() {
  const [message, setMessage] = useState("");

  const acknowledge = (copy: string) => {
    setMessage(copy);
    window.setTimeout(() => setMessage(""), 3000);
  };

  return (
    <main
      className="min-h-[100dvh] w-full bg-[#101614] px-3 py-5 text-[#e7eee7] sm:px-5 sm:py-8"
      style={{ fontFamily: "'Trebuchet MS', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[560px]">
        <div className="mb-3 flex items-center gap-2 px-1 text-[9px] font-bold uppercase tracking-[0.17em] text-[#77877c]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#b7f45e]" />
          <span>Mensagem recebida</span>
          <span className="text-[#4a574e]">/</span>
          <span>Registro digital</span>
        </div>

        <section
          aria-label="E-mail de certificado PIXELPIX"
          className="overflow-hidden border border-[#33413a] bg-[#f3f5ed] text-[#27352c] shadow-[10px_12px_0_rgba(0,0,0,0.28)]"
        >
          <header className="border-b border-[#303b34] bg-[#1a221f] px-5 py-5 text-[#edf4eb] sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <PixelMark dark />
                <span className="text-[16px] font-black tracking-[0.14em]">PIXELPIX</span>
              </div>
              <div className="border border-[#557260] px-2.5 py-1.5 text-right font-mono text-[8px] uppercase leading-3 tracking-[0.14em] text-[#b7f45e]">
                <div>Certificado</div>
                <div>01 / 01</div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#91a197]">
              <span className="h-px w-5 bg-[#b7f45e]" />
              Documento de titularidade
            </div>
          </header>

          <div className="relative px-5 pb-7 pt-7 sm:px-8 sm:pb-9 sm:pt-8">
            <div className="pointer-events-none absolute right-0 top-0 h-14 w-14 border-b border-l border-[#d1d8ca] [clip-path:polygon(0_0,100%_100%,100%_0)]" />
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#4c8054]">
              <span className="h-1.5 w-1.5 bg-[#79b44e]" />
              Prova de titularidade
            </div>
            <h1
              className="max-w-[450px] text-[35px] leading-[0.98] tracking-[-0.045em] text-[#26382d] sm:text-[42px]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              O pixel <span className="text-[#2e774a]">#999.902</span> é seu.
            </h1>
            <p className="mt-4 max-w-[445px] text-[13px] leading-6 text-[#657169]">
              A revelação foi confirmada. Este documento é a prova consultável de que este
              pixel agora pertence a você.
            </p>

            <div className="mt-7 border border-[#c5d0c1] bg-[#e7eee1] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.15em] text-[#708174]">
                <span>Seu fragmento da tela</span>
                <span className="font-mono text-[#829180]">objeto revelado</span>
              </div>
              <div className="flex flex-col items-center justify-between gap-5 min-[390px]:flex-row">
                <LightningTile />
                <div className="min-w-0 flex-1 min-[390px]:pl-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#6c7e70]">
                    Item visual
                  </div>
                  <div
                    className="mt-1 text-[28px] leading-none text-[#27382d]"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    Relâmpago
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-[#738075]">
                    Uma coordenada. Uma revelação. Uma história para guardar.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t-2 border-[#32453a] pt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#26382d]">
                    Registro da titularidade
                  </div>
                  <div className="mt-1 text-[10px] text-[#7d8a80]">Dados deste certificado</div>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#538449]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#78b650]" />
                  Verificado
                </div>
              </div>

              <dl className="border-y border-[#d3d9cd]">
                <RegistryRow label="Código do certificado" value={certificateCode} mono accent />
                <RegistryRow label="Revelado em" value="13 de setembro de 2026 às 14:30" />
                <RegistryRow label="Prêmio liberado" value="R$ 10,00" accent />
                <RegistryRow label="Token privado" value={privateToken} mono />
              </dl>
            </div>

            <div className="mt-6 border border-[#a6cf7c] bg-[#e0f3c9] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-[#5d994e] font-mono text-[12px] font-bold text-[#2b713f]">
                  R$
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#316a3c]">
                    Prêmio liberado
                  </div>
                  <div className="mt-1 text-[24px] font-bold tracking-[-0.04em] text-[#1f5e39]">
                    R$ 10,00
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-[#547052]">
                    O resgate está disponível enquanto este certificado for válido.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-2.5">
              <button
                className="w-full border border-[#286e45] bg-[#2e774a] px-4 py-3.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#f2f8ee] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                onClick={() => acknowledge("Pixel #999.902 pronto para visualização.")}
                type="button"
              >
                Visualizar pixel <span className="ml-2 text-[#b7f45e]">↗</span>
              </button>
              <button
                className="w-full border border-[#7fb55e] bg-[#c4f56f] px-4 py-3.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#1e4d31] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                onClick={() => acknowledge("Link de resgate do prêmio aberto.")}
                type="button"
              >
                Resgatar prêmio <span className="ml-2">↗</span>
              </button>
            </div>

            {message ? (
              <div
                aria-live="polite"
                className="mt-3 border border-[#aac692] bg-[#f0f6e9] px-3 py-2 text-center text-[11px] font-semibold text-[#3f6d48]"
              >
                {message}
              </div>
            ) : null}

            <div className="mt-7 border-t border-[#d3d9cd] pt-5 text-center">
              <p className="mx-auto max-w-[390px] text-[10px] leading-5 text-[#7b877d]">
                Guarde este e-mail para consultar os dados da revelação. O código acima
                identifica este certificado e comprova a titularidade do seu pixel.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#5e7662]">
                <PixelMark />
                PIXELPIX · revele um pixel
              </div>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-[#59685e]">
          assunto · Seu certificado PIXELPIX · pixel #999.902 revelado
        </p>
      </div>
    </main>
  );
}