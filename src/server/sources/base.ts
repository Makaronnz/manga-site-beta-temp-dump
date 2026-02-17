// /src/server/sources/base.ts
export type SeriesMeta = {
  slug?: string;
  title: string;
  altTitles?: string[];
  description?: string;
  coverUrl?: string;
  year?: number;
  status?: string;
  lang?: string;
  externalId: string;
  externalUrl: string;
};

export type ChapterMeta = {
  number: number;
  title?: string;
  lang?: string;
  publishedAt?: string | Date | null;
  externalId: string;
  externalUrl: string;
};

export type PageMeta = {
  page: number;
  remoteUrl: string;
  width?: number;
  height?: number;
};

export interface SourceAdapter {
  key: string;
  fetchSeriesMeta(seriesExternalId: string): Promise<SeriesMeta>;
  fetchChapters(seriesExternalId: string): Promise<ChapterMeta[]>;
  fetchPages(chapterExternalId: string): Promise<PageMeta[]>;
}
