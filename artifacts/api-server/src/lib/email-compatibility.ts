const EMAIL_COMPATIBILITY_STYLES = `
    <style>
      html, body {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #000000 !important;
        background-color: #000000 !important;
        color: #e5e7eb !important;
      }
      .email-body,
      .email-outer,
      .email-outer-cell {
        background: #000000 !important;
        background-color: #000000 !important;
        color: #e5e7eb !important;
      }
      .email-card {
        background: #000000 !important;
        background-color: #000000 !important;
      }
      html[data-ogsc],
      html[data-ogsb],
      body[data-ogsc],
      body[data-ogsb],
      [data-ogsc].email-body,
      [data-ogsb].email-body,
      [data-ogsc] .email-body,
      [data-ogsc] .email-outer,
      [data-ogsc] .email-outer-cell,
      [data-ogsb] .email-body,
      [data-ogsb] .email-outer,
      [data-ogsb] .email-outer-cell {
        background: #000000 !important;
        background-color: #000000 !important;
        color: #e5e7eb !important;
      }
      [data-ogsc].email-card,
      [data-ogsb].email-card,
      [data-ogsc] .email-card,
      [data-ogsb] .email-card {
        background: #000000 !important;
        background-color: #000000 !important;
      }
      [data-ogsc] .email-pixel-tile,
      [data-ogsb] .email-pixel-tile {
        background: #000000 !important;
        background-color: #000000 !important;
        border: 1px solid #00b85c !important;
      }
      table {
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
      a {
        color: inherit;
      }
    </style>
  `;

export function makeEmailClientSafe(html: string) {
  return html
    .replaceAll('content="light"', 'content="dark"')
    .replaceAll('bgcolor="#0b0d10"', 'bgcolor="#000000"')
    .replaceAll('bgcolor="#14171b"', 'bgcolor="#000000"')
    .replaceAll("background:#0b0d10", "background:#000000")
    .replaceAll("background-color:#0b0d10", "background-color:#000000")
    .replaceAll("background:#0f1f16", "background:#000000")
    .replaceAll("background-color:#0f1f16", "background-color:#000000")
    .replaceAll("background:#15181d", "background:#000000")
    .replaceAll("background-color:#15181d", "background-color:#000000")
    .replaceAll("background:#0b0d10 !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#0b0d10 !important",
      "background-color:#000000 !important",
    )
    .replaceAll("background:#14171b !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#14171b !important",
      "background-color:#000000 !important",
    )
    .replaceAll('bgcolor="#171b20"', 'bgcolor="#000000"')
    .replaceAll('bgcolor="#20262d"', 'bgcolor="#000000"')
    .replaceAll('bgcolor="#11161a"', 'bgcolor="#000000"')
    .replaceAll('bgcolor="#0f1316"', 'bgcolor="#000000"')
    .replaceAll("background:#171b20 !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#171b20 !important",
      "background-color:#000000 !important",
    )
    .replaceAll("background:#20262d !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#20262d !important",
      "background-color:#000000 !important",
    )
    .replaceAll("background:#11161a !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#11161a !important",
      "background-color:#000000 !important",
    )
    .replaceAll("background:#0f1316 !important", "background:#000000 !important")
    .replaceAll(
      "background-color:#0f1316 !important",
      "background-color:#000000 !important",
    )
    .replace(/<html(\s[^>]*)?>/i, (tag) =>
      tag.includes("data-ogsc")
        ? tag
        : tag.replace(
            "<html",
            '<html data-ogsc="true" data-ogsb="true"',
          ),
    )
    .replace("</head>", `${EMAIL_COMPATIBILITY_STYLES}</head>`);
}