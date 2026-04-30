import { ExcelTopicCard } from './ExcelTopicCard';

interface Topic {
  id: string;
  title: string;
  description: string;
}

interface Category {
  title: string;
  topics: Topic[];
}

interface ExcelCategorySectionProps {
  category: Category;
}

export function ExcelCategorySection({ category }: ExcelCategorySectionProps) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-8">{category.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {category.topics.map((topic) => (
          <ExcelTopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </section>
  );
}