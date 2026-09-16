export type Bullet = { id: string; text: string; tags?: string[] };

export type Entry = {
  id: string;
  title: string;
  organization: string;
  location?: string;
  dates?: string;
  bullets?: Bullet[];
};

export type SkillItem = { id: string; text: string };

export type SkillGroup = { id: string; label: string; items: SkillItem[] };

export type Section = {
  id: string;
  title: string;
  type: string;
  entries?: Entry[];
  groups?: SkillGroup[];
};

export type Meta = {
  name: string;
  email: string;
  phone: string;
  links?: { id: string; label: string; url: string }[];
};

export type Resume = {
  type: string;
  meta: Meta;
  summary: { id: string; text: string };
  sections: Section[];
};

export type CoverLetterMeta = {
  name: string;
  email: string;
  phone: string;
  date?: string;
  company?: string;
  role?: string;
};

export type Paragraph = { id: string; text: string };

export type CoverLetter = {
  type: string;
  meta: CoverLetterMeta;
  paragraphs: Paragraph[];
};

export type SavedItemSummary = {
  id: string;
  name: string;
  type: "resume" | "cover_letter";
  created_at: string;
};

export type SavedItem = SavedItemSummary & {
  data: Resume | CoverLetter;
};
