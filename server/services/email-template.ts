export function buildEmailHtml(
  formattedDate: string,
  articles: any[],
  articleImages: string[],
  newsletter: any
): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Navjivan</title>
</head>
<body style="margin:0;padding:0;background-color:#F0F4F8;font-family:'Helvetica Neue',Arial,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F4F8;padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:linear-gradient(135deg,#0A0F2E 0%,#1a237e 100%);border-radius:16px 16px 0 0;padding:48px 48px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:4px;color:#90CAF9;text-transform:uppercase;font-family:Arial,sans-serif;">Daily Cloud Intelligence</p>
            <h1 style="margin:0 0 6px;font-size:48px;font-weight:900;color:#FFFFFF;font-family:Georgia,serif;letter-spacing:-2px;">Navjivan</h1>
            <p style="margin:0 0 20px;font-size:11px;color:#90CAF9;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">Est. 1919 · Reborn in the Cloud</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:8px 20px;">
                  <p style="margin:0;font-size:12px;color:#E3F2FD;font-family:Arial,sans-serif;">
                    <strong>${formattedDate}</strong> &nbsp;·&nbsp; ${articles.length} stories &nbsp;·&nbsp; ${newsletter.companies}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ INTRO BAR ═══ -->
        <tr>
          <td style="background:#1565C0;padding:14px 48px;">
            <p style="margin:0;font-size:12px;color:#BBDEFB;font-family:Arial,sans-serif;text-align:center;letter-spacing:0.5px;">
              ☁️ Your personalised cloud briefing — curated by AI, delivered with care
            </p>
          </td>
        </tr>

        <!-- ═══ ARTICLES ═══ -->
        <tr>
          <td style="background:#FFFFFF;padding:8px 0;">

            ${articles.map((article, index) => {
              const imageUrl = articleImages[index] || "";

              // Split summary into paragraphs on ||PARA|| delimiter
              const paragraphs = article.summary
                .split(/\|\|PARA\|\|/)
                .filter((p: string) => p.trim().length > 0);

              // Separate "How is this useful" paragraph
              const mainParas = paragraphs.filter(
                (p: string) => !p.toLowerCase().includes("how is this useful")
              );
              const usefulPara = paragraphs.find(
                (p: string) => p.toLowerCase().includes("how is this useful")
              );

              const isEven = index % 2 === 0;
              const accentColor = isEven ? "#1565C0" : "#6A1B9A";
              const lightBg = isEven ? "#E3F2FD" : "#F3E5F5";
              const badgeColor = isEven ? "#1565C0" : "#6A1B9A";

              // "How is this useful" gets its own bold highlight colors
              const usefulBg = isEven ? "#FFF8E1" : "#F3E5F5";
              const usefulBorder = isEven ? "#F9A825" : "#8E24AA";
              const usefulHeaderColor = isEven ? "#E65100" : "#6A1B9A";
              const usefulLabelBg = isEven ? "#F9A825" : "#8E24AA";

              return `
              <!-- ARTICLE ${index + 1} -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                style="border-bottom:3px solid ${lightBg};margin-bottom:0;">
                <tr>
                  <td style="padding:40px 48px 36px;">

                    <!-- Story badge -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                      <tr>
                        <td style="background:${badgeColor};border-radius:20px;padding:5px 16px;">
                          <span style="font-size:10px;font-weight:700;letter-spacing:2px;color:#FFFFFF;text-transform:uppercase;font-family:Arial,sans-serif;">
                            Story ${index + 1} of ${articles.length}
                          </span>
                        </td>
                        <td style="padding-left:10px;">
                          <span style="font-size:11px;color:#9E9E9E;font-family:Arial,sans-serif;">${article.sourceName || ""}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Headline -->
                    <h2 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#0A0F2E;font-family:Georgia,serif;line-height:1.35;">
                      ${article.headline}
                    </h2>

                    <!-- Article image -->
                    ${imageUrl ? `
                    <div style="margin-bottom:24px;border-radius:12px;overflow:hidden;border:1px solid #E0E0E0;">
                      <img
                        src="${imageUrl}"
                        alt="${article.headline.replace(/"/g, "&quot;")}"
                        width="584"
                        style="width:100%;max-width:584px;height:260px;object-fit:cover;display:block;"
                      />
                    </div>` : ""}

                    <!-- Main paragraphs (Story + Ripple Effect) -->
                    ${mainParas.map((para: string) => `
                    <p style="margin:0 0 16px;font-size:15px;line-height:1.9;color:#212121;font-family:Georgia,serif;">
                      ${para.trim()}
                    </p>`).join("")}

                    <!-- ═══ HOW IS THIS USEFUL — boldly highlighted box ═══ -->
                    ${usefulPara ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                      style="margin-top:28px;margin-bottom:8px;border-radius:12px;overflow:hidden;">
                      <tr>
                        <!-- Thick colored left bar -->
                        <td width="6" style="background:${usefulBorder};border-radius:12px 0 0 12px;">&nbsp;</td>
                        <td style="background:${usefulBg};padding:0;">

                          <!-- Label bar at top -->
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background:${usefulLabelBg};padding:10px 20px;border-radius:0 8px 0 0;">
                                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2.5px;color:#FFFFFF;text-transform:uppercase;font-family:Arial,sans-serif;">
                                  🎯 &nbsp;How Is This Useful To You?
                                </p>
                              </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                              <td style="padding:18px 20px 20px;">
                                <p style="margin:0;font-size:15px;line-height:1.9;color:#212121;font-family:Georgia,serif;">
                                  ${usefulPara.replace(/how is this useful to you\??:?/i, "").trim()}
                                </p>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>
                    </table>` : ""}

                    <!-- Read more -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                      <tr>
                        <td style="background:${accentColor};border-radius:6px;padding:10px 24px;">
                          <a href="${article.sourceUrl}" target="_blank"
                            style="font-size:13px;color:#FFFFFF;text-decoration:none;font-weight:700;font-family:Arial,sans-serif;letter-spacing:0.5px;">
                            Read Full Story →
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>`;
            }).join("")}

          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="background:#0A0F2E;border-radius:0 0 16px 16px;padding:32px 48px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#90CAF9;font-family:Georgia,serif;font-style:italic;">
              "The future belongs to those who understand the cloud today."
            </p>
            <p style="margin:0 0 12px;font-size:11px;color:#546E7A;font-family:Arial,sans-serif;">
              © ${new Date().getFullYear()} Navjivan · CloudSutra &nbsp;·&nbsp; Inspired by Gandhi's newspaper of 1919
            </p>
            <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;">
              <a href="#" style="color:#64B5F6;text-decoration:none;">Unsubscribe</a>
              &nbsp;·&nbsp;
              <a href="#" style="color:#64B5F6;text-decoration:none;">Privacy Policy</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
