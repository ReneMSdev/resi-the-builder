export type DemoSuggestion = {
  id: string
  label: string
  updates: { id: string; text: string }[]
}

// Pre-scripted before/after diffs standing in for a real /revise call in demo
// mode. Each targets a specific real id from demoApplication's resume/cover
// letter directly — independent of whatever's currently selected, so a chip
// always works regardless of selection state.
export const demoResumeSuggestions: DemoSuggestion[] = [
  {
    id: 'punchier-bullet',
    label: 'Make this bullet punchier',
    updates: [
      {
        id: 'b_salo_4',
        text: 'Containerized the app with a multi-stage Dockerfile, wiring the entrypoint to run database migrations automatically on every startup — zero manual deploy steps.',
      },
    ],
  },
  {
    id: 'more-cloud',
    label: 'Add more cloud experience',
    updates: [
      {
        id: 'skill_cloud',
        text: 'AWS, GCP (Cloud Run, Cloud SQL, GCS), Docker, Terraform, GitHub Actions CI/CD, Linux, Firebase, Cloud Monitoring, IAM',
      },
    ],
  },
  {
    id: 'emphasize-leadership',
    label: 'Emphasize leadership',
    updates: [
      {
        id: 'summary_jw_r1',
        text: "Software engineer with a B.S. in Computer Science and hands-on experience building, deploying, and maintaining production backend services using Python (FastAPI), Node.js, and cloud infrastructure on AWS and GCP. Known for taking full ownership of projects end-to-end and for mentoring other engineers along the way — from schema design and API development through CI/CD, containerization, and cloud deployment. Brings a track record of improving reliability and test coverage, paired with a genuine preference for solving real customer problems over chasing specific frameworks.",
      },
    ],
  },
]

export const demoCoverLetterSuggestions: DemoSuggestion[] = [
  {
    id: 'concise-opening',
    label: 'Make the opening more concise',
    updates: [
      {
        id: 'p1',
        text: "I'm writing to apply for the Software Engineer position at Justworks. I'm drawn to owning meaningful technical projects end-to-end, on a team that clearly cares about both the product and the people building it.",
      },
    ],
  },
  {
    id: 'more-enthusiasm',
    label: 'Add enthusiasm',
    updates: [
      {
        id: 'p3',
        text: "Beyond the technical work, I've gotten comfortable operating without a lot of hand-holding. Building LinkLeaf as a solo founder meant making architectural decisions, writing the tests, managing the CI/CD pipeline, and shipping to production, all without a team to fall back on. I'd be genuinely excited to bring that same ownership to Justworks' engineering team — this is exactly the kind of opportunity I've been hoping to find.",
      },
    ],
  },
]
