const EMAIL_COMPATIBILITY_STYLES = `
    <style>
      html, body {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #0b0d10 !important;
        color: #e5e7eb !important;
      }
      .email-body,
      .email-outer,
      .email-outer-cell {
        background-color: #0b0d10 !important;
        color: #e5e7eb !important;
      }
      .email-card {
        background-color: #14171b !important;
      }
      [data-ogsc] .email-body,
      [data-ogsc] .email-outer,
      [data-ogsc] .email-outer-cell,
      [data-ogsb] .email-body,
      [data-ogsb] .email-outer,
      [data-ogsb] .email-outer-cell {
        background-color: #0b0d10 !important;
        color: #e5e7eb !important;
      }
      [data-ogsc] .email-card,
      [data-ogsb] .email-card {
        background-color: #14171b !important;
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
    .replace("</head>", `${EMAIL_COMPATIBILITY_STYLES}</head>`);
}