import { DocumentsAdmin } from "@/features/admin/DocumentsAdmin";
import { listAllDocuments, listDocumentCategories } from "@/server/repositories/documents";

/** Раздел «Документы»: загрузка файлов, предпросмотр, порядок и публикация. */
export default function AdminDocumentsPage() {
  return <DocumentsAdmin documents={listAllDocuments()} categories={listDocumentCategories()} />;
}
