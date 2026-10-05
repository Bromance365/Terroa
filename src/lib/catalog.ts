import productsData from "@data/products.json";
import categoriesData from "@data/categories.json";
import projectsData from "@data/projects.json";
import type { Locale, Pathname } from "@/i18n/routing";

export type CategoryId = "vinyl" | "coverings" | "panels";
export type ProductKind = "floor" | "panel";
export type Tone = "pale" | "medium" | "dark" | "grey";
export type ProductFormat = "plank" | "large-tile" | "panel";
export type Install = "click" | "glue" | "screw";
export type Usage = "residential" | "light-commercial" | "commercial";
export type PriceMode = "hidden" | "from" | "exact";

export interface Product {
  id: string;
  category: CategoryId;
  kind: ProductKind;
  name_fr: string;
  name_en: string;
  slug_fr: string;
  slug_en: string;
  tone: Tone;
  tone_fr: string;
  tone_en: string;
  image: string;
  scene?: string;
  format: ProductFormat;
  install: Install;
  collection: string;
  price_mode: PriceMode;
  price_cad: number | null;
  coverage_sqft_per_box: number | null;
  panel_width_in: number | null;
  panel_height_in: number | null;
  usage: Usage[];
  published: boolean;
  is_new: boolean;
}

export interface Category {
  id: CategoryId;
  key: "/flooring/vinyl" | "/floor-coverings" | "/acoustic-panels";
  kind: ProductKind;
  name_fr: string;
  name_en: string;
  image: string;
  sort: number;
}

export type ProjectType = "residential" | "commercial" | "office";

export interface Project {
  id: string;
  slug: string;
  title_fr: string;
  title_en: string;
  city: string;
  year: string;
  type: ProjectType;
  image: string;
  desc_fr: string;
  desc_en: string;
  products: string[];
  consent_on_file: boolean;
  published: boolean;
  featured: boolean;
}

const products = (productsData.products as Product[]).filter((p) => p.published);
const categories = [...(categoriesData.categories as Category[])].sort((a, b) => a.sort - b.sort);
// Only projects with written consent on file may be shown (HANDOFF.md section 11).
const projects = (projectsData.projects as Project[]).filter((p) => p.published && p.consent_on_file);

export const getProducts = () => products;
export const getCategories = () => categories;
export const getProjects = () => projects;
export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id);
export const getProduct = (id: string) => products.find((p) => p.id === id);
export const getProductsByCategory = (id: CategoryId) => products.filter((p) => p.category === id);
export const getProject = (id: string) => projects.find((p) => p.id === id);
export const getProjectsForProduct = (productId: string) => projects.filter((p) => p.products.includes(productId));

export const productName = (p: Product, locale: Locale) => (locale === "fr" ? p.name_fr : p.name_en);
export const productSlug = (p: Product, locale: Locale) => (locale === "fr" ? p.slug_fr : p.slug_en);
export const productTone = (p: Product, locale: Locale) => (locale === "fr" ? p.tone_fr : p.tone_en);
export const categoryName = (c: Category, locale: Locale) => (locale === "fr" ? c.name_fr : c.name_en);
export const projectTitle = (p: Project, locale: Locale) => (locale === "fr" ? p.title_fr : p.title_en);
export const projectDesc = (p: Project, locale: Locale) => (locale === "fr" ? p.desc_fr : p.desc_en);

export function findProductBySlug(category: CategoryId, locale: Locale, slug: string) {
  return products.find((p) => p.category === category && productSlug(p, locale) === slug);
}

const PRODUCT_PATH = {
  vinyl: "/flooring/vinyl/[slug]",
  coverings: "/floor-coverings/[slug]",
  panels: "/acoustic-panels/[slug]",
} as const satisfies Record<CategoryId, Pathname>;

/** Typed href object for next-intl's Link / getPathname. */
export function productHref(p: Product, locale: Locale) {
  return { pathname: PRODUCT_PATH[p.category], params: { slug: productSlug(p, locale) } } as const;
}

export const categoryHref = (c: Category) => c.key;

export const imgSrc = (file: string) => `/images/${file}`;

/** Sibling tones: other products in the same category (stand-in for "collection" until the catalogue is real). */
export const siblingProducts = (p: Product) => products.filter((x) => x.category === p.category && x.id !== p.id);

export const FILTER_FACETS = {
  tone: ["pale", "medium", "dark", "grey"] as Tone[],
  format: ["plank", "large-tile"] as ProductFormat[],
  install: ["click", "glue"] as Install[],
  usage: ["residential", "light-commercial", "commercial"] as Usage[],
};
