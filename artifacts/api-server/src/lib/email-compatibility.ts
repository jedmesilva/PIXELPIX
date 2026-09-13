const LIGHT_EMAIL_COLORS = [
  ["#0b0d10", "#f3f6f4"],
  ["#14171b", "#ffffff"],
  ["#171b20", "#f7faf8"],
  ["#20262d", "#eef5f0"],
  ["#11161a", "#e8f0eb"],
  ["#0f1316", "#e9f1ec"],
  ["#2b333c", "#cbd8d0"],
  ["#34423a", "#9bb5a4"],
  ["#3b4b42", "#8fb09b"],
  ["#aeb8b2", "#526158"],
  ["#8b93a1", "#66766c"],
  ["#5f6c65", "#6b7a70"],
  ["#e5e7eb", "#17241b"],
  ["#f4f7f5", "#112018"],
  ["#dce8df", "#274631"],
] as const;

const EMAIL_COMPATIBILITY_STYLES = `
    <style>
      html, body {
        width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #f3f6f4 !important;
        color: #17241b !important;
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
  let safeHtml = html.replaceAll('content="dark"', 'content="light"');

  for (const [darkColor, lightColor] of LIGHT_EMAIL_COLORS) {
    safeHtml = safeHtml.replaceAll(darkColor, lightColor);
  }

  return safeHtml.replace("</head>", `${EMAIL_COMPATIBILITY_STYLES}</head>`);
}