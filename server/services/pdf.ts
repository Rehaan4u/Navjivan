import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import type { Newsletter, Article } from "@shared/schema";

const PDF_DIR = path.join(process.cwd(), "pdfs");

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

export async function generateNewsletterPDF(newsletterId: string): Promise<string> {
  try {
    const newsletter = await storage.getNewsletter(newsletterId);
    if (!newsletter) {
      throw new Error(`Newsletter ${newsletterId} not found`);
    }

    const articles = await storage.getNewsletterArticles(newsletterId);
    if (articles.length === 0) {
      throw new Error(`No articles found for newsletter ${newsletterId}`);
    }

    const pdfPath = path.join(PDF_DIR, `newsletter-${newsletterId}.pdf`);
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      size: "A4",
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).font("Helvetica-Bold").text("Payment Chronicle by Gajanan", {
      align: "center",
    });

    const date = new Date(newsletter.generatedAt!);
    const formattedDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc.fontSize(12).font("Helvetica").fillColor("#666666").text(formattedDate, {
      align: "center",
    });

    doc.moveDown();
    doc.fontSize(10).fillColor("#999999").text(
      `Companies: ${newsletter.companies}`,
      { align: "center" }
    );

    doc.moveDown(2);
    doc.strokeColor("#217BF4").lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Articles
    articles.forEach((article, index) => {
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage();
      }

      // Article number
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#217BF4").text(
        `Article ${index + 1}`,
        { continued: false }
      );

      doc.moveDown(0.5);

      // Headline
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000").text(article.headline, {
        align: "left",
      });

      doc.moveDown(0.5);

      // Summary
      doc.fontSize(11).font("Helvetica").fillColor("#333333").text(article.summary, {
        align: "left",
        lineGap: 4,
      });

      doc.moveDown(0.5);

      // Source
      doc.fontSize(9).font("Helvetica").fillColor("#666666").text(
        `Source: ${article.sourceName}`,
        { continued: false }
      );

      doc.fontSize(9).fillColor("#217BF4").text(article.sourceUrl, {
        link: article.sourceUrl,
        underline: true,
      });

      doc.moveDown(1.5);

      // Separator line
      if (index < articles.length - 1) {
        doc.strokeColor("#E0E0E0").lineWidth(0.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();
      }
    });

    // Footer
    doc.fontSize(8).fillColor("#999999").text(
      "© 2025 Payment Chronicle by Gajanan. All rights reserved.",
      50,
      doc.page.height - 50,
      { align: "center" }
    );

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => {
        console.log(`PDF generated: ${pdfPath}`);
        resolve(pdfPath);
      });
      stream.on("error", reject);
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}
