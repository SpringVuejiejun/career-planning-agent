import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { listJobs, listStudentProfiles, createReport, listReports, getReport, updateReport, polishReport, exportReport, type JobProfile, type StudentProfile, type CareerReport } from "@/lib/career-api"
import { FileText, Wand2, Download, Save } from "lucide-react"

function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function CareerReportsPage() {
  const [jobs, setJobs] = useState<JobProfile[]>([])
  const [profiles, setProfiles] = useState<StudentProfile[]>([])
  const [reports, setReports] = useState<CareerReport[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [intention, setIntention] = useState("")
  const [activeReportId, setActiveReportId] = useState<number | null>(null)
  const [editorTitle, setEditorTitle] = useState("")
  const [editorMd, setEditorMd] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportFmt, setExportFmt] = useState<"txt" | "md" | "html">("txt")

  const activeReport = useMemo(() => reports.find((r) => r.id === activeReportId) || null, [reports, activeReportId])

  const refresh = async () => {
    setError(null)
    const [jobRows, profileRows, reportRows] = await Promise.all([
      listJobs(),
      listStudentProfiles(),
      listReports(),
    ])
    setJobs(jobRows)
    setProfiles(profileRows)
    setReports(reportRows)
    if (!selectedProfileId && profileRows[0]) setSelectedProfileId(profileRows[0].id)
    if (!selectedJobId && jobRows[0]) setSelectedJobId(jobRows[0].id)
    if (!activeReportId && reportRows[0]) {
      setActiveReportId(reportRows[0].id)
    }
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeReportId) return
    const load = async () => {
      try {
        const r = await getReport(activeReportId)
        setEditorTitle(r.title)
        setEditorMd(r.content_markdown)
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载报告失败")
      }
    }
    void load()
  }, [activeReportId])

  const generate = async () => {
    if (!selectedProfileId || !selectedJobId) return
    setLoading(true)
    setError(null)
    try {
      const r = await createReport(selectedProfileId, selectedJobId, intention.trim() || undefined)
      await refresh()
      setActiveReportId(r.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败")
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!activeReportId) return
    setLoading(true)
    setError(null)
    try {
      const updated = await updateReport(activeReportId, {
        title: editorTitle,
        content_markdown: editorMd,
      })
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setLoading(false)
    }
  }

  const polish = async () => {
    if (!activeReportId) return
    setLoading(true)
    setError(null)
    try {
      const updated = await polishReport(activeReportId)
      setEditorTitle(updated.title)
      setEditorMd(updated.content_markdown)
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : "润色失败")
    } finally {
      setLoading(false)
    }
  }

  const doExport = async () => {
    if (!activeReportId) return
    setLoading(true)
    setError(null)
    try {
      const out = await exportReport(activeReportId, exportFmt)
      const name =
        exportFmt === "html"
          ? `report-${activeReportId}.html`
          : exportFmt === "md"
            ? `report-${activeReportId}.md`
            : `report-${activeReportId}.txt`
      const mime =
        exportFmt === "html"
          ? "text/html;charset=utf-8"
          : exportFmt === "md"
            ? "text/markdown;charset=utf-8"
            : "text/plain;charset=utf-8"
      downloadText(name, out.content, mime)
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-1 p-4">
      <Card className="flex h-full w-full min-w-0 flex-col border-border/80 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/60 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-lg">职业生涯发展报告</CardTitle>
          </div>
          <CardDescription>
            选择学生画像与目标岗位生成报告；支持编辑保存、智能润色、导出（纯文本/HTML）。
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 min-h-0 gap-4 overflow-hidden p-4">
          <div className="w-[35%] min-w-[320px] overflow-y-auto pr-2 space-y-4">
            {error && <div className="text-sm text-destructive">{error}</div>}
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <div className="text-sm font-semibold">生成新报告</div>
              <div className="mt-2 text-xs text-muted-foreground">步骤：选择画像 → 选择岗位 → 填写意愿（可选） → 生成</div>
              <div className="mt-2 space-y-2">
                <div className="text-xs text-muted-foreground">学生画像</div>
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={selectedProfileId ?? ""}
                  onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    请选择画像
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.id}（完整度 {p.completeness_score ?? "—"} / 竞争力 {p.competitiveness_score ?? "—"}）
                    </option>
                  ))}
                </select>

                <div className="text-xs text-muted-foreground">目标岗位</div>
                <select
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={selectedJobId ?? ""}
                  onChange={(e) => setSelectedJobId(Number(e.target.value))}
                >
                  <option value="" disabled>
                    请选择岗位
                  </option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}（{j.category || "—"}）
                    </option>
                  ))}
                </select>

                <div className="text-xs text-muted-foreground">个人意愿/约束（可选）</div>
                <Textarea
                  value={intention}
                  onChange={(e) => setIntention(e.target.value)}
                  className="min-h-[80px]"
                  placeholder="例如：希望城市在北京/上海；偏向互联网；更喜欢偏设计/偏工程..."
                />

                <div className="flex justify-end">
                  <Button onClick={() => void generate()} disabled={loading || !selectedProfileId || !selectedJobId}>
                    生成报告
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <div className="text-sm font-semibold">历史报告</div>
              <div className="mt-2 space-y-2">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveReportId(r.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      activeReportId === r.id ? "border-primary bg-background" : "border-border bg-background/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{r.title}</div>
                      <span className="ml-auto text-xs text-muted-foreground">#{r.id}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      匹配度：{r.overall_match_score ?? "—"} / 状态：{r.status}
                    </div>
                  </button>
                ))}
                {reports.length === 0 && <div className="text-sm text-muted-foreground">暂无报告，请先生成一份。</div>}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden pl-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input value={editorTitle} onChange={(e) => setEditorTitle(e.target.value)} placeholder="报告标题" />
              <Button variant="secondary" onClick={() => void save()} disabled={loading || !activeReportId}>
                <Save className="mr-1 size-4" /> 保存
              </Button>
              <Button variant="secondary" onClick={() => void polish()} disabled={loading || !activeReportId}>
                <Wand2 className="mr-1 size-4" /> 智能润色
              </Button>
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={exportFmt}
              onChange={(e) => setExportFmt(e.target.value as any)}
              disabled={loading || !activeReportId}
              aria-label="导出格式"
            >
              <option value="txt">TXT（默认）</option>
              <option value="md">MD</option>
              <option value="html">HTML</option>
            </select>
            <Button variant="outline" onClick={() => void doExport()} disabled={loading || !activeReportId}>
              <Download className="mr-1 size-4" /> 导出
            </Button>
            </div>

            {activeReport && (
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                当前报告：#{activeReport.id} / 匹配度：{activeReport.overall_match_score ?? "—"} / 更新时间：
                {activeReport.updated_at
                  ? new Date(activeReport.updated_at).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "—"}
              </div>
            )}

            <Textarea
              value={editorMd}
              onChange={(e) => setEditorMd(e.target.value)}
              className="flex-1 min-h-0 resize-none"
              placeholder="生成后会在这里出现结构化自然语言报告，你可以手动编辑后保存。"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

