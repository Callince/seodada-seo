import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  Paragraph,
  type Editor,
  type EditorConfig,
  type FileLoader,
  type UploadAdapter,
  type UploadResponse,
  Table,
  TableToolbar,
  Underline,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

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
    Essentials, Paragraph, Heading, Bold, Italic, Underline, Link, List, BlockQuote,
    Autoformat, Indent, HorizontalLine, Image, ImageToolbar, ImageCaption, ImageStyle,
    ImageResize, ImageUpload, Table, TableToolbar,
  ],
  extraPlugins: [UploadPlugin],
  toolbar: [
    "undo", "redo", "|", "heading", "|", "bold", "italic", "underline", "|",
    "link", "bulletedList", "numberedList", "blockQuote", "|",
    "insertImage", "insertTable", "horizontalLine",
  ],
  image: {
    toolbar: ["imageStyle:inline", "imageStyle:block", "imageStyle:side", "|", "toggleImageCaption", "imageTextAlternative"],
  },
  table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
};

/** Rich-text (HTML) editor for admin content. Emits HTML via onChange. */
export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  return (
    <div className="rich-editor text-text">
      <CKEditor
        editor={ClassicEditor}
        config={CONFIG}
        data={value}
        onChange={(_evt, editor) => onChange(editor.getData())}
      />
    </div>
  );
}
