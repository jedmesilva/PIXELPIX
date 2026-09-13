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