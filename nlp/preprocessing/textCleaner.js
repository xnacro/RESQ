// Text Preprocessing and Sanitization Utilities
// Cleans raw news and RSS feeds, decodes HTML entities, removes script/HTML tags, and extracts clean sentences

// Decodes common HTML entities into clean Unicode characters
export function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "--");
}

// Strips HTML and script tags safely
export function stripHtml(html) {
  if (!html) return "";
  // Remove script and style blocks first
  const noScripts = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  const noStyles = noScripts.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  // Remove remaining HTML tags
  const textOnly = noStyles.replace(/<[^>]+>/g, " ");
  // Decode entities and collapse multiple whitespace
  return decodeHtmlEntities(textOnly).replace(/\s+/g, " ").trim();
}

// Cleans and prepares article text for NLP processing
export function cleanArticleText(title, description, content) {
  const cleanTitle = stripHtml(title || "");
  const cleanDesc = stripHtml(description || "");
  const cleanContent = stripHtml(content || "");

  // Combine title and description with high priority
  let fullText = cleanTitle;
  if (cleanDesc && cleanDesc !== cleanTitle) {
    fullText += ". " + cleanDesc;
  }
  if (cleanContent && !cleanDesc.includes(cleanContent) && cleanContent.length > cleanDesc.length) {
    fullText += " " + cleanContent;
  }

  return {
    title: cleanTitle,
    description: cleanDesc,
    fullText: fullText.trim(),
  };
}

// Splits clean text into individual sentences
export function splitSentences(text) {
  if (!text) return [];
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

export default {
  decodeHtmlEntities,
  stripHtml,
  cleanArticleText,
  splitSentences,
};
