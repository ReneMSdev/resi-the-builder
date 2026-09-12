export type Bullet = { id: string; text: string; tags?: string[] };

export type Entry = {
  id: string;
  title: string;
  organization: string;
  location?: string;
  dates?: string;
  bullets?: Bullet[];
};

export type SkillGroup = { id: string; label: string; items: string[] };

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
  links?: { label: string; url: string }[];
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
