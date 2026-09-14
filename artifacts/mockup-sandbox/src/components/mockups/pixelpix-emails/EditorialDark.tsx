import { useState } from "react";

type Action = "visualizar" | "resgatar" | null;

function PixelMark() {
  return (
    <span
      aria-hidden="true"
      className="grid grid-cols-3 gap-[3px]"
      style={{ width: 23, height: 23 }}
    >
      <span className="h-[5px] w-[5px] bg-[#b9ff58]" />
      <span className="h-[5px] w-[5px] bg-transparent" />
      <span className="h-[5px] w-[5px] bg-[#b9ff58]" />
      <span className="h-[5px] w-[5px] bg-transparent" />
      <span className="h-[5px] w-[5px] bg-[#b9ff58]" />
      <span className="h-[5px] w-[5px] bg-transparent" />
      <span className="h-[5px] w-[5px] bg-[#b9ff58]" />
      <span className="h-[5px] w-[5px] bg-transparent" />
      <span className="h-[5px] w-[5px] bg-[#b9ff58]" />
    </span>
  );
}

function BoltTile() {
  return (
    <div
      className="relative flex h-[142px] w-[142px] items-center justify-center overflow-hidden border border-[#4d743e] bg-[#223b2b]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(185,255,88,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(185,255,88,.08) 1px, transparent 1px), radial-gradient(circle at 45% 35%, rgba(185,255,88,.2), transparent 58%)",
        backgroundSize: "35px 35px, 35px 35px, 100% 100%",
        boxShadow: "inset 0 0 0 8px rgba(6, 13, 10, .16)",
      }}
    >
      <span
        aria-label="Relâmpago"
        className="relative z-10 block h-[82px] w-[48px] bg-[#d6ff77]"
        style={{
          clipPath:
            "polygon(57% 0%, 100% 0%, 69% 37%, 94% 37%, 21% 100%, 42% 55%, 10% 55%)",
          filter: "drop-shadow(5px 5px 0 rgba(8, 18, 12, .28))",
        }}
      />
      <span className="absolute inset-0 border border-[#b9ff58]/20" />
    </div>
  );
}

function Field({
  label,
  children,
  dim = false,
}: {
  label: string;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div className="border-b border-[#313d38] py-[15px] first:pt-0 last:border-b-0 last:pb-0">
      <div
        className="mb-[7px] font-mono text-[9px] font-bold uppercase tracking-[0.17em]"
        style={{ color: dim ? "#738078" : "#a3e45c" }}
      >
        {label}
      </div>
      <div className="font-mono text-[12px] leading-[1.45] text-[#e4eae4]">
        {children}
      </div>
    </div>
  );
}

export function EditorialDark() {
  const [action, setAction] = useState<Action>(null);

  const showAction = (nextAction: Exclude<Action, null>) => {
    setAction(nextAction);
  };

  return (
    <main
      className="min-h-[100dvh] px-3 py-4 sm:px-5 sm:py-7"
      style={{
        background:
          "radial-gradient(circle at 50% -5%, #25332d 0%, #111815 39%, #090d0c 100%)",
        color: "#e7eee8",
        fontFamily:
          "Georgia, 'Times New Roman', serif",
      }}
    >
      <section
        className="mx-auto w-full max-w-[560px] overflow-hidden border border-[#2d3934]"
        style={{
          background: "#151c19",
          boxShadow: "0 24px 60px rgba(0, 0, 0, .38)",
        }}
        aria-label="Prévia do e-mail de certificado PIXELPIX"
      >
        <header
          className="border-b border-[#2b3632] px-5 py-4 sm:px-6"
          style={{ background: "#111715" }}
        >
          <div className="mb-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.19em] text-[#69756e]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#455049]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[#455049]" />
            <span className="h-[7px] w-[7px] rounded-full bg-[#455049]" />
            <span className="ml-2">mensagens / caixa de entrada</span>
          </div>
          <div className="grid grid-cols-[52px_1fr] gap-y-2 text-[11px] leading-[1.35]">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#69756e]">
              de
            </span>
            <span className="text-[#dfe8e0]">
              PIXELPIX{" "}
              <span className="font-mono text-[10px] text-[#79867d]">
                &lt;hello@pixelpix.world&gt;
              </span>
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#69756e]">
              para
            </span>
            <span className="text-[#dfe8e0]">você</span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#69756e]">
              assunto
            </span>
            <span className="font-semibold text-[#f0f4ee]">
              Seu certificado PIXELPIX · pixel #999.902 revelado
            </span>
          </div>
        </header>

        <article className="relative">
          <div
            className="flex items-center justify-between border-b border-[#2d3934] px-5 py-5 sm:px-7"
            style={{ background: "#1a231f" }}
          >
            <div className="flex items-center gap-3">
              <PixelMark />
              <span className="font-mono text-[16px] font-bold tracking-[0.16em] text-[#ecf2ec]">
                PIXELPIX
              </span>
            </div>
            <span className="font-mono text-[9px] font-bold uppercase leading-[1.35] tracking-[0.16em] text-[#b9ff58]">
              certificado
              <br />
              01 / 01
            </span>
          </div>

          <div className="px-5 pb-7 pt-8 sm:px-7 sm:pb-9 sm:pt-10">
            <div className="mb-5 flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9ff58]">
              <span className="h-px w-7 bg-[#b9ff58]" />
              certificado de revelação
            </div>
            <h1
              className="max-w-[450px] text-[37px] leading-[0.99] tracking-[-0.045em] text-[#f0f3ed] sm:text-[45px]"
              style={{ fontWeight: 400 }}
            >
              O pixel <span className="text-[#b9ff58]">#999.902</span> é seu.
            </h1>
            <p className="mt-5 max-w-[445px] text-[15px] leading-[1.65] text-[#aab5ad] sm:text-[16px]">
              A revelação foi confirmada. Este registro é a prova digital de
              que este pixel agora pertence a você.
            </p>

            <div className="my-8 h-px bg-[#313d38]" />

            <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="shrink-0">
                <BoltTile />
              </div>
              <div>
                <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#738078]">
                  seu fragmento da tela
                </div>
                <h2
                  className="text-[27px] leading-none tracking-[-0.03em] text-[#edf3ed]"
                  style={{ fontWeight: 400 }}
                >
                  Pixel #999.902
                </h2>
                <p className="mt-3 max-w-[245px] text-[12px] leading-[1.5] text-[#8e9c92]">
                  Uma coordenada. Uma revelação. Uma história para guardar.
                </p>
              </div>
            </section>

            <div className="my-8 h-px bg-[#313d38]" />

            <section>
              <div className="mb-5 flex items-end justify-between">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-[#b9ff58]">
                  registro do certificado
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#69766d]">
                  verificado
                </div>
              </div>
              <div
                className="border-y border-[#313d38] px-4 py-4 sm:px-5"
                style={{ background: "#19211e" }}
              >
                <Field label="código do certificado">
                  <span className="break-all tracking-[0.025em]">
                    PPX-2026-999902-4A52A7F8
                  </span>
                </Field>
                <Field label="token privado do certificado">
                  <span className="break-all text-[#b6c3ba]">
                    eyJ...token-do-certificado...
                  </span>
                </Field>
                <Field label="revelado em" dim>
                  13 de setembro de 2026 às 14:30
                </Field>
              </div>
            </section>

            <section
              className="mt-6 flex items-center justify-between border border-[#4d743e] px-4 py-4"
              style={{
                background:
                  "linear-gradient(100deg, rgba(185,255,88,.12), rgba(185,255,88,.035))",
              }}
            >
              <div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#a3e45c]">
                  prêmio liberado
                </div>
                <div className="mt-1 text-[26px] leading-none text-[#eff8ea]">
                  R$ 10,00
                </div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#879b85]">
                disponível
              </span>
            </section>

            <div className="mt-7 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => showAction("resgatar")}
                className="w-full border border-[#b9ff58] bg-[#b9ff58] px-5 py-4 text-center font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#122015] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                Resgatar prêmio <span className="ml-2 text-[15px]">↗</span>
              </button>
              <button
                type="button"
                onClick={() => showAction("visualizar")}
                className="w-full border border-[#52625a] bg-transparent px-5 py-4 text-center font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-[#e1ebe2] transition-colors duration-200 hover:border-[#b9ff58] hover:text-[#b9ff58]"
              >
                Visualizar pixel <span className="ml-2 text-[15px]">↗</span>
              </button>
            </div>
            {action && (
              <p
                role="status"
                className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[#8fa596]"
              >
                {action === "resgatar"
                  ? "Link de resgate pronto para abrir"
                  : "Link de visualização pronto para abrir"}
              </p>
            )}
          </div>

          <footer
            className="border-t border-[#2d3934] px-5 py-5 text-center sm:px-7"
            style={{ background: "#101614" }}
          >
            <p className="font-mono text-[10px] leading-[1.6] text-[#76847b]">
              Guarde este e-mail para consultar os dados do certificado.
              <br />
              O certificado comprova a titularidade do seu pixel.
            </p>
          </footer>
        </article>
      </section>
      <p className="mx-auto mt-4 max-w-[560px] text-center font-mono text-[9px] uppercase tracking-[0.16em] text-[#536159]">
        PIXELPIX · revele um pixel
      </p>
    </main>
  );
}