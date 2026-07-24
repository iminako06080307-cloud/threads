import path from "node:path";

// アップロード画像の保存先 (public外。配信は /api/media 経由)
export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
