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

export type SummaryItem = IdText;

export type SummaryGroup = { id: string; role_type: string; summaries: SummaryItem[] };

export type Profile = {
  meta: Meta;
  summary_pool: SummaryGroup[];
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

export type JobDescription = { raw: string; cleaned: string | null };

export type ApplicationSummary = {
  id: string;
  name: string;
  created_at: string;
  has_resume: boolean;
  has_cover_letter: boolean;
};

export type Application = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  job_description: JobDescription;
  resume: Resume | null;
  cover_letter: CoverLetter | null;
};
