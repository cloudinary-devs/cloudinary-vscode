import * as vscode from "vscode";

export class CldtCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    const linePrefix = document.lineAt(position).text.substr(0, position.character);

    // Only provide completions if there's a non-empty prefix (not just whitespace)
    const trimmedPrefix = linePrefix.trim();
    if (trimmedPrefix.length === 0) {
      return [];
    }

    const items: vscode.CompletionItem[] = [];

    // Transformation properties
    const transformations = [
      { name: "width", shorthand: "w", desc: "Width of the image in pixels" },
      { name: "height", shorthand: "h", desc: "Height of the image in pixels" },
      { name: "crop", shorthand: "c", desc: "Crop/resize mode" },
      { name: "gravity", shorthand: "g", desc: "Focus point for cropping" },
      { name: "quality", shorthand: "q", desc: "Image quality (1-100 or auto)" },
      { name: "format", shorthand: "f", desc: "Output format (jpg, png, webp, etc.)" },
      { name: "angle", shorthand: "a", desc: "Rotation angle" },
      { name: "border", shorthand: "bo", desc: "Border style" },
      { name: "radius", shorthand: "r", desc: "Rounded corners radius" },
      { name: "effect", shorthand: "e", desc: "Image effect to apply" },
      { name: "opacity", shorthand: "o", desc: "Opacity level (0-100)" },
      { name: "overlay", shorthand: "l", desc: "Add overlay layer" },
      { name: "underlay", shorthand: "u", desc: "Add underlay layer" },
      { name: "color", shorthand: "co", desc: "Color value" },
      { name: "background", shorthand: "b", desc: "Background color" },
      { name: "zoom", shorthand: "z", desc: "Zoom level" },
      { name: "aspect_ratio", shorthand: "ar", desc: "Aspect ratio" },
      { name: "dpr", shorthand: "dpr", desc: "Device pixel ratio" },
      { name: "flags", shorthand: "fl", desc: "Special flags" },
    ];

    transformations.forEach((t) => {
      const item = new vscode.CompletionItem(t.name, vscode.CompletionItemKind.Property);
      item.detail = t.desc;
      item.documentation = new vscode.MarkdownString(`**${t.name}** (shorthand: \`${t.shorthand}\`)\n\n${t.desc}`);
      item.insertText = new vscode.SnippetString(`${t.name}: \${1}`);
      items.push(item);
    });

    // Crop modes
    const cropModes = ["scale", "fit", "limit", "mfit", "fill", "lfill", "fill_pad", "crop", "thumb", "auto", "imagga_crop", "imagga_scale"];
    cropModes.forEach((mode) => {
      const item = new vscode.CompletionItem(mode, vscode.CompletionItemKind.Value);
      item.detail = `Crop mode: ${mode}`;
      items.push(item);
    });

    // Gravity options
    const gravityOptions = [
      "north_west",
      "north",
      "north_east",
      "west",
      "center",
      "east",
      "south_west",
      "south",
      "south_east",
      "auto",
      "face",
      "faces",
      "body",
      "auto:face",
      "auto:faces",
      "auto:subject",
      "auto:classic",
      "ocr_text",
    ];
    gravityOptions.forEach((g) => {
      const item = new vscode.CompletionItem(g, vscode.CompletionItemKind.Value);
      item.detail = `Gravity: ${g}`;
      items.push(item);
    });

    // Effects
    const effects = [
      "blur",
      "pixelate",
      "sepia",
      "grayscale",
      "oil_paint",
      "vignette",
      "cartoonify",
      "brightness",
      "contrast",
      "saturation",
      "hue",
      "gamma",
      "sharpen",
      "improve",
      "auto_brightness",
      "auto_contrast",
      "auto_color",
      "red",
      "green",
      "blue",
      "negate",
      "screen",
      "multiply",
      "trim",
      "shadow",
      "gradient_fade",
      "vectorize",
      "outline",
      "background_removal",
      "generative_fill",
      "generative_replace",
      "generative_remove",
    ];
    effects.forEach((e) => {
      const item = new vscode.CompletionItem(e, vscode.CompletionItemKind.Function);
      item.detail = `Effect: ${e}`;
      items.push(item);
    });

    // Format options
    const formats = ["auto", "jpg", "png", "webp", "gif", "svg", "avif", "pdf", "bmp", "ico"];
    formats.forEach((f) => {
      const item = new vscode.CompletionItem(f, vscode.CompletionItemKind.Value);
      item.detail = `Format: ${f}`;
      items.push(item);
    });

    return items;
  }
}
