export function normalizeLatexForMarkdown(text) {
  if (!text) {
    return "";
  }

  let converted = text.replace(
    /\\\[\s*([\s\S]+?)\s*\\\]/g,
    (_match, content) => `\n$$\n${content.trim()}\n$$\n`
  );

  converted = converted.replace(
    /\\\(\s*([\s\S]+?)\s*\\\)/g,
    (_match, content) => `$${content.trim()}$`
  );

  return converted;
}
