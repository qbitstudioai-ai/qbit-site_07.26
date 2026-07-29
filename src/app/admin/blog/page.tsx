import { BlogEditor } from "@/features/admin/BlogEditor";
import { listAllArticles } from "@/server/repositories/articles";

/** Раздел «Блог»: список статей, создание, редактирование, публикация и удаление. */
export default function AdminBlogPage() {
  return <BlogEditor articles={listAllArticles()} />;
}
