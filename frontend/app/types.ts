export type IdText = { id: string; text: string };

export type Bullet = { id: string; text: string; tags?: string[] };

export type Entry = {
  id: string;
  title: IdText;
  organization: IdText;
  location: IdText;
  dates: IdText;
  bullets?: Bullet[];
};

export type SkillItem = IdText;

export type SkillGroup = { id: string; label: string; items: SkillItem[] };

export type Section = {
  id: string;
  title: string;
  type: string;
  entries?: Entry[];
  groups?: SkillGroup[];
};

export type Meta = {
  name: IdText;
  email: IdText;
  phone: IdText;
  links?: { id: string; label: string; url: string }[];
};

export type Resume = {
  type: string;
  meta: Meta;
  summary: { id: string; text: string };
  sections: Section[];
};

export type CoverLetterMeta = {
  name: IdText;
  email: IdText;
  phone: IdText;
  date: IdText;
  company: IdText;
  role: IdText;
};

export type Paragraph = { id: string; text: string };

export type CoverLetter = {
  type: string;
  meta: CoverLetterMeta;
  salutation: IdText;
  sign_off: IdText;
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
