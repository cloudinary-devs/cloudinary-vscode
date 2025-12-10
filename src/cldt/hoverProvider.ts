import * as vscode from "vscode";

export class CldtHoverProvider implements vscode.HoverProvider {
  private documentation: Map<string, { desc: string; example?: string; alias?: string; anchor?: string }>;

  constructor() {
    this.documentation = new Map([
      // Main transformation parameters (with abbreviations)
      ["width", { desc: "Sets the width of the transformed asset in pixels", example: "w_300", alias: "w", anchor: "w_width" }],
      ["w", { desc: "Sets the width of the transformed asset in pixels (abbreviation for width)", example: "w_300", alias: "width", anchor: "w_width" }],

      ["height", { desc: "Sets the height of the transformed asset in pixels", example: "h_200", alias: "h", anchor: "h_height" }],
      ["h", { desc: "Sets the height of the transformed asset in pixels (abbreviation for height)", example: "h_200", alias: "height", anchor: "h_height" }],

      ["crop", { desc: "Determines how to crop or resize the image", example: "c_fill", alias: "c", anchor: "c_crop_resize" }],
      ["c", { desc: "Determines how to crop or resize the image (abbreviation for crop)", example: "c_fill", alias: "crop", anchor: "c_crop_resize" }],

      ["gravity", { desc: "Determines which part of the image to focus on when cropping", example: "g_face", alias: "g", anchor: "g_gravity" }],
      [
        "g",
        {
          desc: "Determines which part of the image to focus on when cropping (abbreviation for gravity)",
          example: "g_face",
          alias: "gravity",
          anchor: "g_gravity",
        },
      ],

      ["quality", { desc: "Controls the compression quality (1-100 or auto)", example: "q_auto:best", alias: "q", anchor: "q_quality" }],
      ["q", { desc: "Controls the compression quality (abbreviation for quality)", example: "q_auto:best", alias: "quality", anchor: "q_quality" }],

      ["format", { desc: "Sets the output format of the asset", example: "f_webp", alias: "f", anchor: "f_format" }],
      ["f", { desc: "Sets the output format of the asset (abbreviation for format)", example: "f_webp", alias: "format", anchor: "f_format" }],

      ["angle", { desc: "Rotates or flips the asset by the specified degrees", example: "a_90", alias: "a", anchor: "a_angle" }],
      ["a", { desc: "Rotates or flips the asset by the specified degrees (abbreviation for angle)", example: "a_90", alias: "angle", anchor: "a_angle" }],

      ["border", { desc: "Adds a border around the image", example: "bo_5px_solid_black", alias: "bo", anchor: "bo_border" }],
      ["bo", { desc: "Adds a border around the image (abbreviation for border)", example: "bo_5px_solid_black", alias: "border", anchor: "bo_border" }],

      ["radius", { desc: "Rounds the corners of the image or makes it circular", example: "r_20", alias: "r", anchor: "r_radius" }],
      ["r", { desc: "Rounds the corners of the image (abbreviation for radius)", example: "r_20", alias: "radius", anchor: "r_radius" }],

      ["effect", { desc: "Applies various effects and filters to the asset", example: "e_blur:300", alias: "e", anchor: "e_effect" }],
      ["e", { desc: "Applies various effects and filters (abbreviation for effect)", example: "e_blur:300", alias: "effect", anchor: "e_effect" }],

      ["opacity", { desc: "Sets the opacity level (0-100)", example: "o_50", alias: "o", anchor: "o_opacity" }],
      ["o", { desc: "Sets the opacity level (abbreviation for opacity)", example: "o_50", alias: "opacity", anchor: "o_opacity" }],

      ["overlay", { desc: "Adds an overlay layer on top of the image", example: "l_logo", alias: "l", anchor: "l_layer" }],
      ["l", { desc: "Adds a layer (overlay) on top of the image (abbreviation for overlay)", example: "l_logo", alias: "overlay", anchor: "l_layer" }],
      ["fl_layer_apply", { desc: "Applies the layer to the image", example: "fl_layer_apply", anchor: "fl_layer_apply" }],

      ["underlay", { desc: "Adds an underlay layer beneath the image", example: "u_background", alias: "u", anchor: "u_underlay" }],
      ["u", { desc: "Adds an underlay layer beneath the image (abbreviation for underlay)", example: "u_background", alias: "underlay", anchor: "u_underlay" }],

      ["color", { desc: "Sets a color value (for text, border, background, etc.)", example: "co_rgb:FF0000", alias: "co", anchor: "co_color" }],
      ["co", { desc: "Sets a color value (abbreviation for color)", example: "co_rgb:FF0000", alias: "color", anchor: "co_color" }],

      ["background", { desc: "Sets the background color for transparent areas", example: "b_white", alias: "b", anchor: "b_background" }],
      ["b", { desc: "Sets the background color (abbreviation for background)", example: "b_white", alias: "background", anchor: "b_background" }],

      ["zoom", { desc: "Controls zoom level for face/custom coordinate detection", example: "z_2.0", alias: "z", anchor: "z_zoom" }],
      ["z", { desc: "Controls zoom level (abbreviation for zoom)", example: "z_2.0", alias: "zoom", anchor: "z_zoom" }],

      ["aspect_ratio", { desc: "Sets the aspect ratio of the asset", example: "ar_16:9", alias: "ar", anchor: "ar_aspect_ratio" }],
      ["ar", { desc: "Sets the aspect ratio (abbreviation for aspect_ratio)", example: "ar_16:9", alias: "aspect_ratio", anchor: "ar_aspect_ratio" }],

      ["dpr", { desc: "Device pixel ratio for high-DPI displays (1.0-3.0 or auto)", example: "dpr_2.0", anchor: "dpr" }],

      ["x", { desc: "X-coordinate for cropping or overlay positioning", example: "x_100", anchor: "x_y_x_y_coordinates" }],
      ["y", { desc: "Y-coordinate for cropping or overlay positioning", example: "y_100", anchor: "x_y_x_y_coordinates" }],

      ["fetch_format", { desc: "Automatically delivers the format best suited for the browser", example: "f_auto", alias: "f_auto", anchor: "f_format" }],
      ["f_auto", { desc: "Automatically delivers optimal format (abbreviation)", example: "f_auto", alias: "fetch_format", anchor: "f_format" }],

      ["density", { desc: "Controls the DPI for converting vector files to raster", example: "dn_150", alias: "dn", anchor: "dn_density" }],
      ["dn", { desc: "Controls the DPI for vector conversions (abbreviation for density)", example: "dn_150", alias: "density", anchor: "dn_density" }],

      ["page", { desc: "Specifies which page/layer to extract from multi-page documents", example: "pg_2", alias: "pg", anchor: "pg_page" }],
      ["pg", { desc: "Specifies page/layer to extract (abbreviation for page)", example: "pg_2", alias: "page", anchor: "pg_page" }],

      ["delay", { desc: "Controls the delay between frames in animated images (in ms)", example: "dl_100", alias: "dl", anchor: "dl_delay" }],
      ["dl", { desc: "Controls delay between frames (abbreviation for delay)", example: "dl_100", alias: "delay", anchor: "dl_delay" }],

      ["duration", { desc: "Controls the total duration of a video or animated image", example: "du_5.0", alias: "du", anchor: "du_duration" }],
      ["du", { desc: "Controls total duration (abbreviation for duration)", example: "du_5.0", alias: "duration", anchor: "du_duration" }],

      ["start_offset", { desc: "Specifies the start time offset for video trimming", example: "so_2.5", alias: "so", anchor: "so_start_offset" }],
      ["so", { desc: "Specifies start time offset (abbreviation for start_offset)", example: "so_2.5", alias: "start_offset", anchor: "so_start_offset" }],

      ["end_offset", { desc: "Specifies the end time offset for video trimming", example: "eo_10.5", alias: "eo", anchor: "eo_end_offset" }],
      ["eo", { desc: "Specifies end time offset (abbreviation for end_offset)", example: "eo_10.5", alias: "end_offset", anchor: "eo_end_offset" }],

      ["audio_codec", { desc: "Sets the audio codec for video transcoding", example: "ac_aac", alias: "ac", anchor: "ac_audio_codec" }],
      ["ac", { desc: "Sets audio codec (abbreviation for audio_codec)", example: "ac_aac", alias: "audio_codec", anchor: "ac_audio_codec" }],

      ["audio_frequency", { desc: "Sets the audio sampling frequency in Hz", example: "af_44100", alias: "af", anchor: "af_audio_frequency" }],
      [
        "af",
        {
          desc: "Sets audio sampling frequency (abbreviation for audio_frequency)",
          example: "af_44100",
          alias: "audio_frequency",
          anchor: "af_audio_frequency",
        },
      ],

      ["bit_rate", { desc: "Sets the total bit rate for video", example: "br_1m", alias: "br", anchor: "br_bit_rate" }],
      ["br", { desc: "Sets total bit rate (abbreviation for bit_rate)", example: "br_1m", alias: "bit_rate", anchor: "br_bit_rate" }],

      ["video_codec", { desc: "Sets the video codec for transcoding", example: "vc_h264", alias: "vc", anchor: "vc_video_codec" }],
      ["vc", { desc: "Sets video codec (abbreviation for video_codec)", example: "vc_h264", alias: "video_codec", anchor: "vc_video_codec" }],

      ["fps", { desc: "Sets frames per second for video", example: "fps_30", anchor: "fps" }],
      ["keyframe_interval", { desc: "Sets the keyframe interval for video encoding", example: "ki_2.0", alias: "ki", anchor: "ki_keyframe_interval" }],
      [
        "ki",
        { desc: "Sets keyframe interval (abbreviation for keyframe_interval)", example: "ki_2.0", alias: "keyframe_interval", anchor: "ki_keyframe_interval" },
      ],

      ["streaming_profile", { desc: "Applies a predefined streaming profile", example: "sp_hd", alias: "sp", anchor: "sp_streaming_profile" }],
      [
        "sp",
        {
          desc: "Applies streaming profile (abbreviation for streaming_profile)",
          example: "sp_hd",
          alias: "streaming_profile",
          anchor: "sp_streaming_profile",
        },
      ],

      [
        "default_image",
        {
          desc: "Specifies a fallback image if the requested image doesn't exist",
          example: "d_placeholder.jpg",
          alias: "d",
          anchor: "d_default_image",
        },
      ],
      [
        "d",
        { desc: "Specifies fallback image (abbreviation for default_image)", example: "d_placeholder.jpg", alias: "default_image", anchor: "d_default_image" },
      ],

      // Crop/Resize modes
      ["scale", { desc: "Scales the asset to fit within specified dimensions (changes aspect ratio)", example: "c_scale" }],
      ["fit", { desc: "Fits the asset within specified dimensions without cropping (maintains aspect ratio)", example: "c_fit" }],
      ["fill", { desc: "Fills the specified dimensions, cropping if necessary", example: "c_fill" }],
      ["limit", { desc: "Limits the asset size without upscaling", example: "c_limit" }],
      ["thumb", { desc: "Creates a thumbnail with automatic face detection", example: "c_thumb" }],
      ["pad", { desc: "Pads the asset to exact dimensions with a background color", example: "c_pad" }],
      ["lpad", { desc: "Limits padding - only pads if original is larger", example: "c_lpad" }],
      ["mpad", { desc: "Pads with minimum padding needed", example: "c_mpad" }],
      ["lfill", { desc: "Limits fill - only fills if original is smaller", example: "c_lfill" }],
      ["mfit", { desc: "Fits with minimum size", example: "c_mfit" }],
      ["imagga_crop", { desc: "Crops using Imagga's content-aware algorithm", example: "c_imagga_crop" }],
      ["imagga_scale", { desc: "Scales using Imagga's content-aware algorithm", example: "c_imagga_scale" }],

      // Gravity options
      ["center", { desc: "Centers the image when cropping", example: "g_center" }],
      ["north", { desc: "Top center", example: "g_north" }],
      ["south", { desc: "Bottom center", example: "g_south" }],
      ["east", { desc: "Right center", example: "g_east" }],
      ["west", { desc: "Left center", example: "g_west" }],
      ["north_east", { desc: "Top right corner", example: "g_north_east" }],
      ["north_west", { desc: "Top left corner", example: "g_north_west" }],
      ["south_east", { desc: "Bottom right corner", example: "g_south_east" }],
      ["south_west", { desc: "Bottom left corner", example: "g_south_west" }],
      ["face", { desc: "Focuses on detected faces in the image", example: "g_face" }],
      ["faces", { desc: "Focuses on all detected faces", example: "g_faces" }],
      ["auto", { desc: "Automatically determines the best gravity based on content", example: "g_auto" }],
      ["auto_subject", { desc: "Automatically detects the main subject", example: "g_auto:subject" }],
      ["custom", { desc: "Uses custom coordinates specified by x and y", example: "g_custom" }],
      ["ocr_text", { desc: "Focuses on detected text in the image", example: "g_ocr_text" }],

      // Common Effects (these would be used as effect values)
      ["blur", { desc: "Applies a blur effect (strength 1-2000)", example: "e_blur:400" }],
      ["grayscale", { desc: "Converts the image to grayscale", example: "e_grayscale" }],
      ["sepia", { desc: "Applies a sepia tone effect (1-100)", example: "e_sepia:50" }],
      ["pixelate", { desc: "Pixelates the image (1-200)", example: "e_pixelate:10" }],
      ["pixelate_faces", { desc: "Pixelates detected faces", example: "e_pixelate_faces:10" }],
      ["blur_faces", { desc: "Blurs detected faces", example: "e_blur_faces:1000" }],
      ["blur_region", { desc: "Blurs a specific region", example: "e_blur_region:1000" }],
      ["cartoonify", { desc: "Applies a cartoon effect", example: "e_cartoonify" }],
      ["brightness", { desc: "Adjusts the brightness (-99 to 100)", example: "e_brightness:50" }],
      ["contrast", { desc: "Adjusts the contrast (-100 to 100)", example: "e_contrast:30" }],
      ["saturation", { desc: "Adjusts color saturation (-100 to 100)", example: "e_saturation:50" }],
      ["hue", { desc: "Adjusts the hue (-100 to 100)", example: "e_hue:40" }],
      ["vibrance", { desc: "Adjusts color vibrance (-100 to 100)", example: "e_vibrance:50" }],
      ["auto_brightness", { desc: "Automatically adjusts brightness", example: "e_auto_brightness" }],
      ["auto_contrast", { desc: "Automatically adjusts contrast", example: "e_auto_contrast" }],
      ["auto_color", { desc: "Automatically adjusts colors", example: "e_auto_color" }],
      ["sharpen", { desc: "Sharpens the image (1-2000)", example: "e_sharpen:100" }],
      ["unsharp_mask", { desc: "Applies unsharp mask filter (strength 1-2000)", example: "e_unsharp_mask:200" }],
      ["oil_paint", { desc: "Applies an oil painting effect (1-100)", example: "e_oil_paint:50" }],
      ["vignette", { desc: "Applies a vignette effect (0-100)", example: "e_vignette:50" }],
      ["blackwhite", { desc: "Converts to black and white with threshold (0-100)", example: "e_blackwhite:50" }],
      ["negate", { desc: "Negates all colors in the image", example: "e_negate" }],
      ["red", { desc: "Adjusts red channel (-100 to 100)", example: "e_red:50" }],
      ["green", { desc: "Adjusts green channel (-100 to 100)", example: "e_green:50" }],
      ["blue", { desc: "Adjusts blue channel (-100 to 100)", example: "e_blue:50" }],
      ["gamma", { desc: "Adjusts gamma levels (-50 to 150)", example: "e_gamma:50" }],
      ["tint", { desc: "Applies a tint effect with color blending", example: "e_tint:100:red" }],
      ["colorize", { desc: "Colorizes the image (0-100)", example: "e_colorize:50" }],
      ["trim", { desc: "Removes edges that match the background color", example: "e_trim" }],
      ["shadow", { desc: "Applies a shadow effect", example: "e_shadow:50" }],
      ["outline", { desc: "Applies an outline effect", example: "e_outline" }],
      ["gradient_fade", { desc: "Applies a gradient fade", example: "e_gradient_fade:20" }],
      ["vectorize", { desc: "Converts raster image to vector", example: "e_vectorize" }],
      ["background_removal", { desc: "Removes the background from the image (AI-powered)", example: "e_background_removal" }],
      ["generative_fill", { desc: "Uses AI to fill in missing parts of an image", example: "e_generative_fill" }],
      ["generative_replace", { desc: "Uses AI to replace objects in an image", example: "e_generative_replace:from_car;to_truck" }],
      ["generative_restore", { desc: "Uses AI to restore and enhance image quality", example: "e_generative_restore" }],
      ["generative_recolor", { desc: "Uses AI to recolor objects", example: "e_generative_recolor:prompt_(blue car)" }],
      ["upscale", { desc: "Upscales image using AI", example: "e_upscale" }],
      ["improve", { desc: "Automatically improves image quality", example: "e_improve" }],
      ["preview", { desc: "Generates a preview version optimized for speed", example: "e_preview" }],

      // Format options
      ["jpg", { desc: "JPEG format - lossy compression, good for photos", example: "f_jpg" }],
      ["jpeg", { desc: "JPEG format - lossy compression, good for photos", example: "f_jpeg" }],
      ["png", { desc: "PNG format - lossless with transparency support", example: "f_png" }],
      ["webp", { desc: "WebP format - modern efficient format with transparency", example: "f_webp" }],
      ["avif", { desc: "AVIF format - next-gen image format with excellent compression", example: "f_avif" }],
      ["gif", { desc: "GIF format - for animations and simple graphics", example: "f_gif" }],
      ["bmp", { desc: "BMP format - uncompressed bitmap", example: "f_bmp" }],
      ["tiff", { desc: "TIFF format - high-quality uncompressed", example: "f_tiff" }],
      ["svg", { desc: "SVG format - vector graphics", example: "f_svg" }],
      ["pdf", { desc: "PDF format - document format", example: "f_pdf" }],
      ["mp4", { desc: "MP4 format - video format", example: "f_mp4" }],
      ["webm", { desc: "WebM format - web video format", example: "f_webm" }],
      ["flv", { desc: "FLV format - Flash video", example: "f_flv" }],
      ["mov", { desc: "MOV format - QuickTime video", example: "f_mov" }],
      ["ogv", { desc: "OGV format - Ogg video", example: "f_ogv" }],
      ["m3u8", { desc: "HLS format - adaptive streaming", example: "f_m3u8" }],
      ["mpd", { desc: "MPEG-DASH format - adaptive streaming", example: "f_mpd" }],

      // Video codecs
      ["h264", { desc: "H.264/AVC video codec - widely supported", example: "vc_h264" }],
      ["h265", { desc: "H.265/HEVC video codec - better compression", example: "vc_h265" }],
      ["vp8", { desc: "VP8 video codec - WebM format", example: "vc_vp8" }],
      ["vp9", { desc: "VP9 video codec - improved WebM", example: "vc_vp9" }],
      ["theora", { desc: "Theora video codec - Ogg format", example: "vc_theora" }],

      // Audio codecs
      ["aac", { desc: "AAC audio codec - high quality", example: "ac_aac" }],
      ["mp3", { desc: "MP3 audio codec - widely supported", example: "ac_mp3" }],
      ["vorbis", { desc: "Vorbis audio codec - Ogg format", example: "ac_vorbis" }],
      ["opus", { desc: "Opus audio codec - modern efficient codec", example: "ac_opus" }],
    ]);
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
      return undefined;
    }

    let word = document.getText(wordRange);
    const keywords = Array.from(this.documentation.keys());
    word = keywords.find((keyword) => word.startsWith(`${keyword}_`)) || word;

    const doc = this.documentation.get(word);

    if (doc) {
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**${word}**\n\n`);

      // Show alias information if available
      if (doc.alias) {
        markdown.appendMarkdown(`*Also available as: \`${doc.alias}\`*\n\n`);
      }

      markdown.appendMarkdown(`${doc.desc}\n\n`);

      if (doc.example) {
        markdown.appendCodeblock(doc.example, "cldt");
      }

      // Add link to documentation with anchor if available
      const baseUrl = "https://cloudinary.com/documentation/transformation_reference";
      const docUrl = doc.anchor ? `${baseUrl}#${doc.anchor}` : baseUrl;
      markdown.appendMarkdown(`\n\n[Cloudinary Transformation Reference](${docUrl})`);
      return new vscode.Hover(markdown, wordRange);
    }

    return undefined;
  }
}
