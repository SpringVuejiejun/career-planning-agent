export type JobProfile = {
  id: number
  code: string
  name: string
  category?: string | null
  level?: string | null
  description?: string | null
  skills?: any
  certificates?: any
  competencies?: any
  internship?: any
  other_requirements?: any
}

export type JobRelation = {
  id: number
  relation_type: "vertical" | "transition" | string
  from_job_id: number
  to_job_id: number
  title?: string | null
  rationale?: string | null
  requirements_gap?: any
}

export type JobGraph = {
  jobs: JobProfile[]
  relations: JobRelation[]
}

export type StudentProfile = {
  id: number
  source_type: string
  source_filename?: string | null
  skills?: any
  certificates?: any
  competencies?: any
  internship?: any
  projects?: any
  education?: any
  awards?: any
  completeness_score?: number | null
  competitiveness_score?: number | null
  scoring_detail?: any
  created_at?: string | null
}

export type CareerReport = {
  id: number
  title: string
  status: string
  content_markdown: string
  content_json?: any
  match_summary?: any
  overall_match_score?: number | null
  action_plan?: any
  created_at?: string | null
  updated_at?: string | null
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function seedCareerData(): Promise<void> {
  await jsonFetch("/api/career/seed", { method: "POST" })
}

export async function listJobs(): Promise<JobProfile[]> {
  return await jsonFetch<JobProfile[]>("/api/career/jobs")
}

export async function getJobGraph(relationType?: "vertical" | "transition"): Promise<JobGraph> {
  const qs = relationType ? `?relation_type=${encodeURIComponent(relationType)}` : ""
  return await jsonFetch<JobGraph>(`/api/career/graph${qs}`)
}

export async function createStudentProfileManual(text: string): Promise<StudentProfile> {
  return await jsonFetch<StudentProfile>("/api/career/student-profiles/manual", {
    method: "POST",
    body: JSON.stringify({ text }),
  })
}

export async function uploadResume(file: File, textHint?: string): Promise<StudentProfile> {
  const form = new FormData()
  form.append("file", file)
  if (textHint) form.append("text_hint", textHint)
  const res = await fetch("/api/career/student-profiles/resume", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(errText || `HTTP ${res.status}`)
  }
  return (await res.json()) as StudentProfile
}

export async function listStudentProfiles(): Promise<StudentProfile[]> {
  return await jsonFetch<StudentProfile[]>("/api/career/student-profiles")
}

export async function createReport(
  student_profile_id: number,
  target_job_id: number,
  intention?: string
): Promise<CareerReport> {
  return await jsonFetch<CareerReport>("/api/career/reports", {
    method: "POST",
    body: JSON.stringify({ student_profile_id, target_job_id, intention }),
  })
}

export async function listReports(): Promise<CareerReport[]> {
  return await jsonFetch<CareerReport[]>("/api/career/reports")
}

export async function getReport(reportId: number): Promise<CareerReport> {
  return await jsonFetch<CareerReport>(`/api/career/reports/${reportId}`)
}

export async function updateReport(
  reportId: number,
  patch: { title?: string; content_markdown?: string; status?: string }
): Promise<CareerReport> {
  return await jsonFetch<CareerReport>(`/api/career/reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  })
}

export async function polishReport(reportId: number): Promise<CareerReport> {
  return await jsonFetch<CareerReport>(`/api/career/reports/${reportId}/polish`, {
    method: "POST",
  })
}

export async function exportReport(
  reportId: number,
  fmt: "txt" | "md" | "html" = "txt"
): Promise<{ format: string; content: string }> {
  return await jsonFetch<{ format: string; content: string }>(
    `/api/career/reports/${reportId}/export?fmt=${fmt}`
  )
}
