import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  AutoImage,
  AutoMediaEmbed,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  FindAndReplace,
  FontBackgroundColor,
  FontColor,
  FontSize,
  Fullscreen,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageInsert,
  ImageInsertViaUrl,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  LinkImage,
  List,
  ListProperties,
  MediaEmbed,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SourceEditing,
  SpecialCharacters,
  SpecialCharactersEssentials,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableToolbar,
  TodoList,
  Underline,
  WordCount,
  type Editor,
  type EditorConfig,
  type FileLoader,
  type UploadAdapter,
  type UploadResponse,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import { useRef } from "react";

import { api } from "@/api/client";
import { assetUrl } from "@/api/hooks/useContentPublic";

/** Uploads pasted/inserted images through the admin endpoint (JWT-authed via the
 *  shared axios client) and hands CKEditor back the public /content-assets URL. */
class AdminUploadAdapter implements UploadAdapter {
  private loader: FileLoader;
  constructor(loader: FileLoader) {
    this.loader = loader;
  }
  async upload(): Promise<UploadResponse> {
    const file = await this.loader.file;
    const fd = new FormData();
    fd.append("file", file as Blob);
    const { data } = await api.post<{ url: string }>("/admin/blogs/upload-image", fd);
    return { default: assetUrl(data.url) };
  }
  abort() {}
}

function UploadPlugin(editor: Editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => new AdminUploadAdapter(loader);
}

const CONFIG: EditorConfig = {
  licenseKey: "GPL",
  plugins: [
    Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Code, RemoveFormat,
    Subscript, Superscript, FontColor, FontBackgroundColor, FontSize, Highlight, Alignment,
    Link, LinkImage, List, ListProperties, TodoList, BlockQuote, CodeBlock, Autoformat, Indent,
    HorizontalLine, SpecialCharacters, SpecialCharactersEssentials, FindAndReplace, SourceEditing,
    Fullscreen, WordCount, PasteFromOffice, GeneralHtmlSupport,
    Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageUpload, ImageInsert,
    ImageInsertViaUrl, AutoImage, MediaEmbed, AutoMediaEmbed, Table, TableToolbar,
  ],
  extraPlugins: [UploadPlugin],
  toolbar: {
    items: [
      "undo", "redo", "|", "sourceEditing", "fullscreen", "findAndReplace", "|",
      "heading", "|", "bold", "italic", "underline", "strikethrough", "code", "removeFormat", "|",
      "fontColor", "fontBackgroundColor", "fontSize", "highlight", "|",
      "alignment", "bulletedList", "numberedList", "todoList", "outdent", "indent", "|",
      "link", "insertImage", "mediaEmbed", "insertTable", "blockQuote", "codeBlock",
      "horizontalLine", "specialCharacters", "subscript", "superscript",
    ],
    shouldNotGroupWhenFull: true,
  },
  heading: {
    options: [
      { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
      { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
      { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" },
    ],
  },
  link: {
    defaultProtocol: "https://",
    addTargetToExternalLinks: true,
  },
  image: {
    insert: { integrations: ["url", "upload"] },
    toolbar: [
      "imageStyle:inline", "imageStyle:block", "imageStyle:side", "|",
      "toggleImageCaption", "imageTextAlternative", "linkImage",
    ],
  },
  mediaEmbed: { previewsInData: true },
  table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
  // Keep pasted/authored HTML (embeds, ids, classes, iframes) intact on round-trip.
  htmlSupport: {
    allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  },
};

/** Rich-text (HTML) editor for admin content. Emits HTML via onChange, and shows
 *  a live word/character count under the editor. */
export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const countRef = useRef<HTMLDivElement>(null);

  return (
    <div className="rich-editor text-text">
      <CKEditor
        editor={ClassicEditor}
        config={CONFIG}
        data={value}
        onReady={(editor) => {
          const wc = editor.plugins.get("WordCount");
          if (countRef.current && wc.wordCountContainer) {
            countRef.current.innerHTML = "";
            countRef.current.appendChild(wc.wordCountContainer);
          }
        }}
        onChange={(_evt, editor) => onChange(editor.getData())}
      />
      <div ref={countRef} className="rich-editor__count mt-1 text-xs text-text-muted" />
    </div>
  );
}
